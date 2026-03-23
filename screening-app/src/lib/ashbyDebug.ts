import { Buffer } from "buffer";

const ASHBY_BASE = "https://api.ashbyhq.com";

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

export async function fetchFileInfoForDebug(fileId: string): Promise<{
  fileId: string;
  downloadUrl: string | null;
  contentType: string | null;
  filename: string | null;
}> {
  try {
    const info = await ashbyPost<{
      results?: {
        downloadUrl?: string;
        contentType?: string;
        filename?: string;
        name?: string;
      };
    }>("/file.info", { fileId });

    const results = info?.results ?? {};
    return {
      fileId,
      downloadUrl: results.downloadUrl ?? null,
      contentType: results.contentType ?? null,
      filename: results.filename ?? results.name ?? null,
    };
  } catch (err) {
    return {
      fileId,
      downloadUrl: null,
      contentType: null,
      filename: `ERROR: ${String(err)}`,
    };
  }
}

type DebugEntry = { path: string; valueType: string; value: string };

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function walkForDebug(value: any, path: string, out: DebugEntry[], depth = 0): void {
  if (!value || depth > 6) return;
  if (typeof value === "string") {
    if (/file|resume|attachment|upload/i.test(path) || isUuidLike(value)) {
      out.push({ path, valueType: "string", value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => walkForDebug(v, `${path}[${i}]`, out, depth + 1));
    return;
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const nextPath = path ? `${path}.${k}` : k;
      if (typeof v === "string") {
        if (/file|resume|attachment|upload/i.test(k) || isUuidLike(v)) {
          out.push({ path: nextPath, valueType: "string", value: v });
        }
      } else if (v && typeof v === "object") {
        if (
          typeof (v as any).downloadUrl === "string" ||
          typeof (v as any).fileId === "string" ||
          typeof (v as any).id === "string"
        ) {
          out.push({
            path: nextPath,
            valueType: "object",
            value: JSON.stringify({
              downloadUrl: (v as any).downloadUrl ?? null,
              fileId: (v as any).fileId ?? null,
              id: (v as any).id ?? null,
              name: (v as any).name ?? (v as any).filename ?? null,
              contentType: (v as any).contentType ?? null,
            }),
          });
        }
        walkForDebug(v, nextPath, out, depth + 1);
      }
    }
  }
}

export async function fetchApplicationDebug(applicationId: string): Promise<{
  applicationId: string;
  debug: DebugEntry[];
}> {
  const app = await ashbyPost<{ results?: any }>(
    "/application.info",
    { applicationId }
  );
  const out: DebugEntry[] = [];
  walkForDebug(app?.results ?? {}, "", out, 0);
  return {
    applicationId,
    debug: out,
  };
}
