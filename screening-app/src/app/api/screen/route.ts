import { NextRequest, NextResponse } from "next/server";
import { screenCandidate } from "@/lib/screener";
import { saveResult } from "@/lib/results";
import type { ScreenApiRequest, ScreenApiResponse, Candidate } from "@/types";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: ScreenApiRequest = await req.json();

    if (!body.candidate?.resumeText || !body.candidate?.jobTitle) {
      return NextResponse.json<ScreenApiResponse>(
        { success: false, error: "Missing required fields: resumeText, jobTitle" },
        { status: 400 }
      );
    }

    const candidate: Candidate = {
      id: randomUUID(),
      name: body.candidate.name || "Unknown",
      email: body.candidate.email || "",
      resumeText: body.candidate.resumeText,
      jobId: body.candidate.jobId || "manual",
      jobTitle: body.candidate.jobTitle,
      source: "manual",
      submittedAt: new Date().toISOString(),
    };

    const passThreshold = typeof body.passThreshold === "number" ? body.passThreshold : 70;
    const reviewThreshold = typeof body.reviewThreshold === "number" ? body.reviewThreshold : 40;

    const result = await screenCandidate(
      candidate,
      body.rubric,
      passThreshold,
      reviewThreshold
    );

    saveResult(result);

    return NextResponse.json<ScreenApiResponse>({ success: true, result });
  } catch (err) {
    console.error("[/api/screen]", err);
    return NextResponse.json<ScreenApiResponse>(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
