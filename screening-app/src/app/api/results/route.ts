import { NextResponse } from "next/server";
import { getResults } from "@/lib/results";

export async function GET() {
  const results = getResults();
  return NextResponse.json({ results });
}
