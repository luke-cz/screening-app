import { NextRequest, NextResponse } from "next/server";
import {
  verifyAshbySignature,
  fetchResumeText,
  pushVerdictToAshby,
  fetchJobDescription,
} from "@/lib/ashby";
import { screenCandidate } from "@/lib/screener";
import { getOrCreateRubric, upsertRubric } from "@/lib/rubrics";
import { saveResult, hasProcessedAshbyApplication } from "@/lib/results";
import { generateRubricFromJobDescription } from "@/lib/rubricGenerator";
import {
  recordWebhookReceived,
  recordWebhookSuccess,
  recordWebhookError,
} from "@/lib/webhookStatus";
import type { AshbyWebhookPayload, Candidate } from "@/types";
import { randomUUID } from "crypto";

// Ashby sends: POST /api/ashby-webhook
// Events we care about: applicationSubmitted, applicationCreated

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  recordWebhookReceived();

  // 1. Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("ashby-signature") ?? req.headers.get("x-ashby-signature");

  if (!verifyAshbySignature(rawBody, signature)) {
    console.warn(`[Ashby Webhook] Invalid signature (req ${requestId})`);
    recordWebhookError("invalid_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: AshbyWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    recordWebhookError("invalid_json");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Only process new application events
  const triggerEvents = ["applicationSubmitted", "applicationCreated"];
  if (!triggerEvents.includes(payload.action)) {
    recordWebhookSuccess();
    return NextResponse.json({ ignored: true, action: payload.action });
  }

  const ashbyApp = payload.data?.application;
  if (!ashbyApp) {
    recordWebhookError("missing_application");
    return NextResponse.json({ error: "No application in payload" }, { status: 400 });
  }

  console.log(
    `[Ashby Webhook] New application: ${ashbyApp.candidate.name} → ${ashbyApp.job.title} (req ${requestId})`
  );

  if (hasProcessedAshbyApplication(ashbyApp.id)) {
    console.log(
      `[Ashby Webhook] Duplicate application ${ashbyApp.id} ignored (req ${requestId})`
    );
    recordWebhookSuccess();
    return NextResponse.json({ ignored: true, reason: "already_processed" });
  }

  // 3. Fetch resume text from Ashby
  const resumeText = await fetchResumeText(ashbyApp.id);

  if (!resumeText) {
    console.warn(
      `[Ashby Webhook] Could not extract resume text for application ${ashbyApp.id} (req ${requestId})`
    );
    recordWebhookError("resume_text_missing");
    // Still return 200 so Ashby doesn't retry — we just skip screening
    return NextResponse.json({
      screened: false,
      reason: "Could not extract resume text",
    });
  }

  // 4. Get job description (if available) and build rubric
  const jobDescription = await fetchJobDescription(
    ashbyApp.job.id,
    ashbyApp.job.title
  );

  const rubric = getOrCreateRubric(ashbyApp.job.id, ashbyApp.job.title);
  let rubricToUse = rubric;
  if (
    jobDescription &&
    rubric.criteria.mustHaves.length === 0 &&
    rubric.criteria.niceToHaves.length === 0 &&
    rubric.criteria.dealbreakers.length === 0
  ) {
    const generated = await generateRubricFromJobDescription(
      ashbyApp.job.title,
      jobDescription
    );
    if (generated) {
      rubricToUse = { ...rubric, criteria: generated };
      upsertRubric(rubricToUse);
    }
  }

  // 5. Build candidate object
  const candidate: Candidate = {
    id: randomUUID(),
    name: ashbyApp.candidate.name,
    email: ashbyApp.candidate.email,
    resumeText,
    jobId: ashbyApp.job.id,
    jobTitle: ashbyApp.job.title,
    jobDescription: jobDescription ?? undefined,
    source: "ashby",
    submittedAt: ashbyApp.createdAt,
    ashbyApplicationId: ashbyApp.id,
  };

  // 6. Run AI screening
  const result = await screenCandidate(
    candidate,
    rubricToUse.criteria,
    rubricToUse.passThreshold,
    rubricToUse.reviewThreshold
  );

  // 7. Save result locally
  saveResult(result);

  // 8. Push verdict back to Ashby (note + stage change)
  await pushVerdictToAshby(
    ashbyApp.id,
    result.verdict,
    result.overallScore,
    result.summary
  );

  console.log(
    `[Ashby Webhook] Screened ${candidate.name}: ${result.verdict} (${result.overallScore}/100) (req ${requestId})`
  );

  recordWebhookSuccess();
  return NextResponse.json({
    screened: true,
    candidateId: result.candidateId,
    verdict: result.verdict,
    score: result.overallScore,
  });
}
