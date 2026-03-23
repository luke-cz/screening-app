// Ashby REST API wrapper
// Docs: https://developers.ashbyhq.com/reference

const ASHBY_BASE = "https://api.ashbyhq.com";
const ASHBY_PUBLIC_BASE = "https://api.ashbyhq.com/posting-api";

async function ashbyPost<T>(endpoint: string, body: unknown): Promise<T> {
  const apiKey = process.env.ASHBY_API_KEY;
  if (!apiKey) throw new Error("ASHBY_API_KEY is not set");

  const res = await fetch(`${ASHBY_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json; version=1",
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

export async function listRecentApplications(limit = 10): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(limit, 25));
  const res = await ashbyPost<{ results?: any[] }>(
    "/application.list",
    { limit: safeLimit }
  );
  return Array.isArray(res?.results) ? res.results : [];
}

export async function fetchApplicationInfo(
  applicationId: string
): Promise<any | null> {
  try {
    const app = await ashbyPost<{ results?: any }>(
      "/application.info",
      { applicationId }
    );
    if (!app?.results) return null;
    return app.results.application ?? app.results;
  } catch (err) {
    console.error("[Ashby] fetchApplicationInfo error:", err);
    return null;
  }
}
// ─── Fetch resume text from an application ───────────────────────────────────

async function fetchFileDownloadUrl(fileId: string): Promise<string | null> {
  try {
    const info = await ashbyPost<{ results?: { downloadUrl?: string } }>(
      "/file.info",
      { fileId }
    );
    return info?.results?.downloadUrl ?? null;
  } catch (err) {
    console.warn("[Ashby] file.info fetch failed:", { fileId, err });
    return null;
  }
}

function extractResumeHandle(source: any): { downloadUrl?: string; fileId?: string } | null {
  if (!source || typeof source !== "object") return null;
  const s = source as any;
  const handle =
    s?.resumeFileHandle ??
    s?.resumeFile ??
    s?.resume ??
    s?.candidateResume ??
    null;

  if (handle?.downloadUrl || handle?.fileId) return handle;

  // Some responses nest the application or candidate object
  const nested = s?.application ?? s?.candidate ?? null;
  if (nested) {
    const nestedHandle = extractResumeHandle(nested);
    if (nestedHandle) return nestedHandle;
  }

  const fileId =
    s?.resumeFileId ??
    s?.resumeId ??
    s?.candidateResumeFileId ??
    s?.candidateResumeId ??
    null;

  if (fileId) return { fileId };
  return null;
}

function collectFileIds(value: any, ids: Set<string>, depth = 0): void {
  if (!value || depth > 6) return;
  if (typeof value === "string") return;

  if (Array.isArray(value)) {
    for (const item of value) collectFileIds(item, ids, depth + 1);
    return;
  }

  if (typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === "string" && /fileId/i.test(key) && v.trim()) {
        ids.add(v);
      } else if (v && typeof v === "object") {
        if (typeof (v as any).fileId === "string" && (v as any).fileId.trim()) {
          ids.add((v as any).fileId);
        }
        // Some file objects use "id" instead of "fileId"
        if (
          typeof (v as any).id === "string" &&
          (v as any).id.trim() &&
          (typeof (v as any).contentType === "string" ||
            typeof (v as any).filename === "string" ||
            typeof (v as any).name === "string" ||
            typeof (v as any).size === "number" ||
            typeof (v as any).downloadUrl === "string")
        ) {
          ids.add((v as any).id);
        }
        collectFileIds(v, ids, depth + 1);
      }
    }
  }
}

export function findFileIds(source: any): string[] {
  const ids = new Set<string>();
  collectFileIds(source, ids);
  return Array.from(ids);
}

type FileHandle = { fileId?: string; downloadUrl?: string; name?: string };

function collectFileHandles(value: any, out: FileHandle[], depth = 0): void {
  if (!value || depth > 6) return;
  if (typeof value === "string") return;

  if (Array.isArray(value)) {
    for (const item of value) collectFileHandles(item, out, depth + 1);
    return;
  }

  if (typeof value === "object") {
    const v: any = value;
    if (typeof v.downloadUrl === "string" || typeof v.fileId === "string") {
      out.push({
        downloadUrl: typeof v.downloadUrl === "string" ? v.downloadUrl : undefined,
        fileId: typeof v.fileId === "string" ? v.fileId : undefined,
        name: typeof v.name === "string" ? v.name : typeof v.filename === "string" ? v.filename : undefined,
      });
    } else if (
      typeof v.id === "string" &&
      (typeof v.contentType === "string" ||
        typeof v.filename === "string" ||
        typeof v.name === "string" ||
        typeof v.size === "number")
    ) {
      out.push({
        fileId: v.id,
        name: typeof v.name === "string" ? v.name : typeof v.filename === "string" ? v.filename : undefined,
      });
    }

    for (const child of Object.values(v)) {
      if (child && typeof child === "object") collectFileHandles(child, out, depth + 1);
    }
  }
}

function pickBestHandle(handles: FileHandle[]): FileHandle | null {
  if (!handles.length) return null;
  const byName = handles.find((h) =>
    typeof h.name === "string" && /resume|cv/i.test(h.name)
  );
  return byName ?? handles[0];
}

async function fetchCandidateResumeDownloadUrl(candidateId: string): Promise<string | null> {
  try {
    const info = await ashbyPost<{ results?: any }>(
      "/candidate.info",
      { candidateId }
    );
    const handle = extractResumeHandle(info?.results);
    if (handle?.downloadUrl) return handle.downloadUrl;
    if (handle?.fileId) return await fetchFileDownloadUrl(handle.fileId);
    const handles = [] as FileHandle[];
    collectFileHandles(info?.results, handles);
    const best = pickBestHandle(handles);
    if (best?.downloadUrl) return best.downloadUrl;
    if (best?.fileId) return await fetchFileDownloadUrl(best.fileId);
    return null;
  } catch (err) {
    console.warn("[Ashby] candidate.info fetch failed:", err);
    return null;
  }
}

export async function fetchResumeText(
  applicationId: string,
  downloadUrl?: string,
  candidateId?: string
): Promise<string | null> {
  try {
    // 1. Get application details (includes resume file URL) if not provided
    let resumeUrl: string | null = downloadUrl ?? null;
    if (!resumeUrl) {
      const app = await ashbyPost<{
        results: {
          resumeFileHandle?: { downloadUrl?: string; fileId?: string };
          candidate?: { id?: string };
          candidateId?: string;
        };
      }>("/application.info", { applicationId });
      const handle = extractResumeHandle(app?.results);
      resumeUrl = handle?.downloadUrl ?? null;
      if (!resumeUrl && handle?.fileId) {
        resumeUrl = await fetchFileDownloadUrl(handle.fileId);
      }
      if (!resumeUrl) {
        const handles = [] as FileHandle[];
        collectFileHandles(app?.results, handles);
        const best = pickBestHandle(handles);
        if (best?.downloadUrl) {
          resumeUrl = best.downloadUrl;
        } else if (best?.fileId) {
          resumeUrl = await fetchFileDownloadUrl(best.fileId);
        }
      }
      const cid =
        candidateId ??
        app?.results?.candidate?.id ??
        app?.results?.candidateId ??
        null;
      if (!resumeUrl && cid) {
        resumeUrl = await fetchCandidateResumeDownloadUrl(cid);
      }
    }
    if (!resumeUrl) return null;

    // 2. Fetch the resume file (PDF or plain text)
    const fileRes = await fetch(resumeUrl);
    if (!fileRes.ok) {
      console.warn("[Ashby] Resume download failed", {
        applicationId,
        status: fileRes.status,
        statusText: fileRes.statusText,
      });
      return null;
    }

    const contentType = fileRes.headers.get("content-type") ?? "";

    // Plain text resume
    if (contentType.includes("text/plain")) {
      return fileRes.text();
    }

    // DOCX resume
    if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) ||
      contentType.includes("application/vnd.ms-word") ||
      resumeUrl.toLowerCase().endsWith(".docx")
    ) {
      try {
        const mammothModule = await import("mammoth");
        const mammoth =
          (mammothModule as { default?: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> } })
            .default ?? (mammothModule as unknown as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> });

        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        const text = result?.value?.trim();
        return text && text.length > 0 ? text : null;
      } catch (err) {
        console.error("[Ashby] DOCX parse failed:", err);
        return null;
      }
    }

    if (contentType.includes("pdf")) {
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse =
          (pdfParseModule as { default?: (b: Buffer) => Promise<{ text: string }> })
            .default ?? (pdfParseModule as unknown as (b: Buffer) => Promise<{ text: string }>);

        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const data = await pdfParse(buffer);
        const text = data?.text?.trim();
        return text && text.length > 0 ? text : null;
      } catch (err) {
        console.error("[Ashby] PDF parse failed:", err);
        return null;
      }
    }

    return null;
  } catch (err) {
    console.error("[Ashby] fetchResumeText error:", err);
    return null;
  }
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractDescription(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const s = source as Record<string, unknown>;
  const candidates = [
    s.descriptionPlain,
    s.description,
    s.descriptionText,
    s.jobDescription,
    s.jobDescriptionPlain,
    s.descriptionHtml,
    (s.descriptionParts as { descriptionBody?: string } | undefined)?.descriptionBody,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.includes("<") ? stripHtml(c) : c.trim();
    }
  }
  return null;
}

export async function fetchJobDescription(
  jobId: string,
  jobTitle: string
): Promise<string | null> {
  const jobBoard = process.env.ASHBY_JOB_BOARD_NAME;

  // 1) Try public job postings API (no auth) if job board name is configured
  if (jobBoard) {
    try {
      const res = await fetch(
        `${ASHBY_PUBLIC_BASE}/job-board/${jobBoard}?includeCompensation=false`
      );
      if (res.ok) {
        const data = await res.json();
        const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
        const match = jobs.find(
          (j: { title?: string }) =>
            typeof j?.title === "string" &&
            j.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
        );
        const desc = extractDescription(match);
        if (desc) return desc;
      }
    } catch (err) {
      console.warn("[Ashby] Public job board fetch failed:", err);
    }
  }

  // 2) Try Ashby API job.info (requires jobsRead)
  try {
    const info = await ashbyPost<{ results: Record<string, unknown> }>(
      "/job.info",
      { jobId }
    );
    const desc = extractDescription(info?.results);
    if (desc) return desc;
  } catch (err) {
    console.warn("[Ashby] job.info fetch failed:", err);
  }

  return null;
}

export async function listPublicJobs(): Promise<
  { id: string; title: string; location?: string }[]
> {
  const jobBoard = process.env.ASHBY_JOB_BOARD_NAME;
  if (!jobBoard) return [];

  try {
    const res = await fetch(
      `${ASHBY_PUBLIC_BASE}/job-board/${jobBoard}?includeCompensation=false`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

    const formatLocation = (j: any): string => {
      if (typeof j?.location === "string" && j.location.trim()) return j.location.trim();
      const addr = j?.address?.postalAddress;
      const parts = [
        addr?.addressLocality,
        addr?.addressRegion,
        addr?.addressCountry,
      ].filter(Boolean);
      if (parts.length) return parts.join(", ");
      if (j?.isRemote === true) return "Remote";
      if (typeof j?.workplaceType === "string" && j.workplaceType) return j.workplaceType;
      return "";
    };

    return jobs
      .map((j: any) => ({
        id: String(j?.id ?? ""),
        title: String(j?.title ?? ""),
        location: formatLocation(j),
      }))
      .filter((j: { id: string; title: string }) => j.id && j.title);
  } catch (err) {
    console.warn("[Ashby] Public job board list failed:", err);
    return [];
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
    pass: "AI Screen",
    review: "Application Review",
    reject: "Archived",
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
