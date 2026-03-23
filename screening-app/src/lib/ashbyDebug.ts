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
