import type { Rubric } from "@/types";

// ─── Default rubrics (replace with DB in production) ──────────────────────────
// In production: swap these with a DB read (e.g. Prisma, Supabase, etc.)

const DEFAULT_RUBRICS: Record<string, Rubric> = {
  "default-frontend": {
    jobId: "default-frontend",
    jobTitle: "Frontend Engineer",
    department: "Engineering",
    criteria: {
      mustHaves: ["3+ years React", "TypeScript", "CSS/Tailwind"],
      niceToHaves: ["Next.js", "GraphQL", "Figma"],
      dealbreakers: [],
    },
    passThreshold: 70,
    reviewThreshold: 40,
  },
};

// In-memory store (survives hot reload in dev; use Redis/DB in prod)
const rubricStore = new Map<string, Rubric>(
  Object.entries(DEFAULT_RUBRICS)
);

export function getRubric(jobId: string): Rubric | null {
  return rubricStore.get(jobId) ?? null;
}

export function getAllRubrics(): Rubric[] {
  return Array.from(rubricStore.values());
}

export function upsertRubric(rubric: Rubric): void {
  rubricStore.set(rubric.jobId, rubric);
}

export function getOrCreateRubric(jobId: string, jobTitle: string): Rubric {
  const existing = getRubric(jobId);
  if (existing) return existing;

  // Auto-create a blank rubric for unknown jobs
  const blank: Rubric = {
    jobId,
    jobTitle,
    criteria: { mustHaves: [], niceToHaves: [], dealbreakers: [] },
    passThreshold: 70,
    reviewThreshold: 40,
  };
  upsertRubric(blank);
  return blank;
}
