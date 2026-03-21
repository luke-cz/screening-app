import { NextRequest, NextResponse } from "next/server";
import { verifyAshbySignature, fetchResumeText, pushVerdictToAshby } from "@/lib/ashby";
import { screenCandidate } from "@/lib/screener";
import { getOrCreateRubric } from "@/lib/rubrics";
import { saveResult } from "@/lib/results";
import type { AshbyWebhookPayload, Candidate } from "@/types";
import { randomUUID } from "crypto";

// Ashby sends: POST /api/ashby-webhook
// Events we care about: applicationSubmitted, applicationCreated

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-ashby-signature");

  if (!verifyAshbySignature(rawBody, signature)) {
    console.warn("[Ashby Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: AshbyWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Only process new application events
  const triggerEvents = ["applicationSubmitted", "applicationCreated"];
  if (!triggerEvents.includes(payload.action)) {
    return NextResponse.json({ ignored: true, action: payload.action });
  }

  const ashbyApp = payload.data?.application;
  if (!ashbyApp) {
    return NextResponse.json({ error: "No application in payload" }, { status: 400 });
  }

  console.log(
    `[Ashby Webhook] New application: ${ashbyApp.candidate.name} → ${ashbyApp.job.title}`
  );

  // 3. Fetch resume text from Ashby
  const resumeText = await fetchResumeText(ashbyApp.id);

  if (!resumeText) {
    console.warn(
      `[Ashby Webhook] Could not extract resume text for application ${ashbyApp.id}`
    );
    // Still return 200 so Ashby doesn't retry — we just skip screening
    return NextResponse.json({
      screened: false,
      reason: "Could not extract resume text",
    });
  }

  // 4. Get or create rubric for this job
  const rubric = getOrCreateRubric(ashbyApp.job.id, ashbyApp.job.title);

  // 5. Build candidate object
  const candidate: Candidate = {
    id: randomUUID(),
    name: ashbyApp.candidate.name,
    email: ashbyApp.candidate.email,
    resumeText,
    jobId: ashbyApp.job.id,
    jobTitle: ashbyApp.job.title,
    source: "ashby",
    submittedAt: ashbyApp.createdAt,
    ashbyApplicationId: ashbyApp.id,
  };

  // 6. Run AI screening
  const result = await screenCandidate(
    candidate,
    rubric.criteria,
    rubric.passThreshold,
    rubric.reviewThreshold
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
    `[Ashby Webhook] Screened ${candidate.name}: ${result.verdict} (${result.overallScore}/100)`
  );

  return NextResponse.json({
    screened: true,
    candidateId: result.candidateId,
    verdict: result.verdict,
    score: result.overallScore,
  });
}
