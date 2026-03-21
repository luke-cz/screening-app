import type { ScreeningResult } from "@/types";

// In-memory results store.
// Production: replace with DB (Postgres, Supabase, etc.)

const resultsStore: ScreeningResult[] = [];

export function saveResult(result: ScreeningResult): void {
  // Remove duplicate if re-screening the same candidate
  const idx = resultsStore.findIndex(
    (r) => r.candidateId === result.candidateId
  );
  if (idx !== -1) resultsStore.splice(idx, 1);
  resultsStore.unshift(result); // newest first
}

export function getResults(): ScreeningResult[] {
  return [...resultsStore];
}

export function getResultById(candidateId: string): ScreeningResult | null {
  return resultsStore.find((r) => r.candidateId === candidateId) ?? null;
}

export function getResultsByJob(jobId: string): ScreeningResult[] {
  return resultsStore.filter((r) => r.jobId === jobId);
}
