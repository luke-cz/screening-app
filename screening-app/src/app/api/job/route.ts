import { NextRequest, NextResponse } from "next/server";
import { fetchJobDescription } from "@/lib/ashby";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") ?? "";
  const jobTitle = searchParams.get("jobTitle") ?? "";
  if (!jobId || !jobTitle) {
    return NextResponse.json({ error: "Missing jobId or jobTitle" }, { status: 400 });
  }

  const description = await fetchJobDescription(jobId, jobTitle);
  return NextResponse.json({ description });
}
