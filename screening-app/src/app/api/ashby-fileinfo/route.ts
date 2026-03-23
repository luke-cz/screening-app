import { NextRequest, NextResponse } from "next/server";
import { fetchFileInfoForDebug } from "@/lib/ashbyDebug";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId") ?? "";
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  const info = await fetchFileInfoForDebug(fileId);
  return NextResponse.json(info);
}
