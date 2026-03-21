// ─── Rubric ───────────────────────────────────────────────────────────────────

export interface RubricCriteria {
  mustHaves: string[];
  niceToHaves: string[];
  dealbreakers: string[];
}

export interface Rubric {
  jobId: string;
  jobTitle: string;
  department?: string;
  criteria: RubricCriteria;
  passThreshold: number;   // 0-100, default 70
  reviewThreshold: number; // 0-100, default 40
}

// ─── Candidate ────────────────────────────────────────────────────────────────

export interface Candidate {
  id: string;
  name: string;
  email: string;
  resumeText: string;
  jobId: string;
  jobTitle: string;
  source: "ashby" | "manual";
  submittedAt: string;
  ashbyApplicationId?: string;
}

// ─── Screening Result ─────────────────────────────────────────────────────────

export type Verdict = "pass" | "review" | "reject";

export interface ScoringDimension {
  name: string;
  score: number; // 0-100
  note: string;
}

export interface ScreeningResult {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  overallScore: number; // 0-100
  verdict: Verdict;
  dealbreakerHit: boolean;
  dimensions: ScoringDimension[];
  summary: string;
  rejectionReason: string | null;
  screened_at: string;
  ashbyApplicationId?: string;
}

// ─── Ashby Webhook ────────────────────────────────────────────────────────────

export interface AshbyApplication {
  id: string;
  status: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    resumeFileUrl?: string;
  };
  job: {
    id: string;
    title: string;
    departmentName?: string;
  };
  createdAt: string;
}

export interface AshbyWebhookPayload {
  action: string;
  data: {
    application: AshbyApplication;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ScreenApiRequest {
  candidate: Omit<Candidate, "id" | "source" | "submittedAt">;
  rubric: RubricCriteria;
  passThreshold?: number;
  reviewThreshold?: number;
}

export interface ScreenApiResponse {
  success: boolean;
  result?: ScreeningResult;
  error?: string;
}
