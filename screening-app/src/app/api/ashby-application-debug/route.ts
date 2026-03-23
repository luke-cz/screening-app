import { NextRequest, NextResponse } from "next/server";
import { fetchApplicationDebug } from "@/lib/ashbyDebug";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId") ?? "";
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const info = await fetchApplicationDebug(applicationId);
  return NextResponse.json(info);
}
