import { NextResponse } from "next/server";
import { getWebhookStatus } from "@/lib/webhookStatus";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: getWebhookStatus() });
}
