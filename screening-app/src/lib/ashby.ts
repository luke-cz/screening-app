// Ashby REST API wrapper
// Docs: https://developers.ashbyhq.com/reference

const ASHBY_BASE = "https://api.ashbyhq.com";

async function ashbyPost<T>(endpoint: string, body: unknown): Promise<T> {
  const apiKey = process.env.ASHBY_API_KEY;
  if (!apiKey) throw new Error("ASHBY_API_KEY is not set");

  const res = await fetch(`${ASHBY_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ashby API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Fetch resume text from an application ───────────────────────────────────

export async function fetchResumeText(
  applicationId: string
): Promise<string | null> {
  try {
    // 1. Get application details (includes resume file URL)
    const app = await ashbyPost<{
      results: { resumeFileHandle?: { downloadUrl: string } };
    }>("/application.info", { applicationId });

    const downloadUrl = app?.results?.resumeFileHandle?.downloadUrl;
    if (!downloadUrl) return null;

    // 2. Fetch the resume file (PDF or plain text)
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) return null;

    const contentType = fileRes.headers.get("content-type") ?? "";

    // Plain text resume
    if (contentType.includes("text/plain")) {
      return fileRes.text();
    }

    // For PDFs you'd run a parser here (e.g. pdf-parse).
    // Returning null for now — the webhook handler falls back gracefully.
    if (contentType.includes("pdf")) {
      console.warn(
        `[Ashby] PDF resume for application ${applicationId} — add pdf-parse to extract text`
      );
      return null;
    }

    return null;
  } catch (err) {
    console.error("[Ashby] fetchResumeText error:", err);
    return null;
  }
}

// ─── Push verdict back to Ashby ──────────────────────────────────────────────

export async function pushVerdictToAshby(
  applicationId: string,
  verdict: "pass" | "review" | "reject",
  score: number,
  summary: string
): Promise<void> {
  const stageMap: Record<string, string> = {
    pass: "Review",
    review: "Review",
    reject: "Rejected",
  };

  // Add a note to the application in Ashby
  await ashbyPost("/applicationNote.create", {
    applicationId,
    note: `[AI Screening] Score: ${score}/100 — ${verdict.toUpperCase()}\n\n${summary}`,
    isPrivate: true,
  });

  // Move to appropriate stage
  const targetStage = stageMap[verdict];
  await ashbyPost("/application.changeStage", {
    applicationId,
    interviewStageName: targetStage,
  });
}

// ─── Verify Ashby webhook signature ──────────────────────────────────────────

export function verifyAshbySignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.ASHBY_WEBHOOK_SECRET;

  // If no secret configured, skip verification in dev
  if (!secret) {
    console.warn("[Ashby] No ASHBY_WEBHOOK_SECRET set — skipping verification");
    return true;
  }

  if (!signature) return false;

  // Ashby signs with HMAC-SHA256
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const decodeSignature = (sig: string): Buffer | null => {
    const trimmed = sig.trim();
    const cleaned = trimmed.startsWith("sha256=")
      ? trimmed.slice("sha256=".length)
      : trimmed;

    if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
      return Buffer.from(cleaned, "hex");
    }

    try {
      const b64 = Buffer.from(cleaned, "base64");
      if (b64.length > 0) return b64;
    } catch {
      // fall through
    }

    // Fallback to raw string comparison buffer
    return Buffer.from(cleaned, "utf8");
  };

  const sigBuf = decodeSignature(signature);
  const expBuf = Buffer.from(expected, "hex");

  if (!sigBuf || sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}
