import { NextRequest, NextResponse } from "next/server";
import {
  fetchApplicationInfo,
  fetchJobDescription,
  fetchResumeText,
  listRecentApplications,
  pushVerdictToAshby,
} from "@/lib/ashby";
import { screenCandidate } from "@/lib/screener";
import { getOrCreateRubric, upsertRubric } from "@/lib/rubrics";
import { saveResult, hasProcessedAshbyApplication } from "@/lib/results";
import { generateRubricFromJobDescription } from "@/lib/rubricGenerator";
import type { Candidate } from "@/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const limitRaw = typeof body?.limit === "number" ? body.limit : 10;
    const force = Boolean(body?.force);
    const limit = Math.max(1, Math.min(limitRaw, 25));

    const list = await listRecentApplications(limit);

    const sorted = list
      .map((a) => ({
        id: a?.id ?? a?.applicationId,
        createdAt: a?.createdAt ?? a?.submittedAt ?? a?.appliedAt,
      }))
      .filter((a) => typeof a.id === "string")
      .sort((a, b) => {
        const ta = new Date(a.createdAt ?? 0).getTime();
        const tb = new Date(b.createdAt ?? 0).getTime();
        return tb - ta;
      });

    let screened = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of sorted) {
      const app = await fetchApplicationInfo(item.id);
      if (!app?.id || !app?.candidate || !app?.job?.id || !app?.job?.title) {
        failed += 1;
        continue;
      }

      if (!force && hasProcessedAshbyApplication(app.id)) {
        skipped += 1;
        continue;
      }

      const resumeText = await fetchResumeText(
        app.id,
        app?.resumeFileHandle?.downloadUrl
      );
      if (!resumeText) {
        failed += 1;
        continue;
      }

      const jobDescription = await fetchJobDescription(
        app.job.id,
        app.job.title
      );

      const rubric = getOrCreateRubric(app.job.id, app.job.title);
      let rubricToUse = rubric;
      if (
        jobDescription &&
        rubric.criteria.mustHaves.length === 0 &&
        rubric.criteria.niceToHaves.length === 0 &&
        rubric.criteria.dealbreakers.length === 0
      ) {
        const generated = await generateRubricFromJobDescription(
          app.job.title,
          jobDescription
        );
        if (generated) {
          rubricToUse = { ...rubric, criteria: generated };
          upsertRubric(rubricToUse);
        }
      }

      const candidate: Candidate = {
        id: app.id,
        name: app.candidate.name ?? "Unknown",
        email: app.candidate.email ?? "",
        resumeText,
        jobId: app.job.id,
        jobTitle: app.job.title,
        jobDescription: jobDescription ?? undefined,
        source: "ashby",
        submittedAt: app.createdAt ?? new Date().toISOString(),
        ashbyApplicationId: app.id,
      };

      const result = await screenCandidate(
        candidate,
        rubricToUse.criteria,
        rubricToUse.passThreshold,
        rubricToUse.reviewThreshold
      );

      saveResult(result);
      await pushVerdictToAshby(
        app.id,
        result.verdict,
        result.overallScore,
        result.summary
      );

      screened += 1;
    }

    return NextResponse.json({
      success: true,
      screened,
      skipped,
      failed,
    });
  } catch (err) {
    console.error("[/api/ashby-rescreen]", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
