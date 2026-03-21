import type { ScreeningResult } from "@/types";

// In-memory results store.
// Production: replace with DB (Postgres, Supabase, etc.)

const resultsStore: ScreeningResult[] = [];

// Track processed Ashby application IDs for idempotency
const processedAshbyApps = new Set<string>();

export function saveResult(result: ScreeningResult): void {
  // Remove duplicate if re-screening the same candidate
  const idx = resultsStore.findIndex(
    (r) => r.candidateId === result.candidateId
  );
  if (idx !== -1) resultsStore.splice(idx, 1);
  resultsStore.unshift(result); // newest first

  if (result.ashbyApplicationId) {
    processedAshbyApps.add(result.ashbyApplicationId);
  }
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

export function hasProcessedAshbyApplication(
  ashbyApplicationId: string
): boolean {
  return processedAshbyApps.has(ashbyApplicationId);
}
