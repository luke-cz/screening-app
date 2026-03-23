import { NextResponse } from "next/server";
import { listPublicJobs } from "@/lib/ashby";

export async function GET(): Promise<NextResponse> {
  const jobs = await listPublicJobs();
  return NextResponse.json({ jobs });
}
