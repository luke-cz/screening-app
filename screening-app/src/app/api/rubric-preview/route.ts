import { NextRequest, NextResponse } from "next/server";
import { generateRubricFromJobDescription } from "@/lib/rubricGenerator";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const jobTitle = body?.jobTitle ?? "";
    const description = body?.description ?? "";

    if (!jobTitle || !description) {
      return NextResponse.json({ error: "Missing jobTitle or description" }, { status: 400 });
    }

    const rubric = await generateRubricFromJobDescription(jobTitle, description);
    return NextResponse.json({ rubric });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
