import Anthropic from "@anthropic-ai/sdk";
import type {
  Candidate,
  RubricCriteria,
  ScreeningResult,
  ScoringDimension,
  Verdict,
} from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a recruiting AI that screens job candidates against a role rubric.
Your job is to be consistent, objective, and explainable — not harsh or lenient.
Write in a professional-but-casual human tone. Avoid AI fluff and hype.

Respond ONLY with valid JSON. No markdown fences, no preamble, no explanation outside JSON.

Return exactly this structure:
{
  "overall_score": <integer 0-100>,
  "dimensions": [
    { "name": "Must-haves match",   "score": <integer 0-100>, "note": "<max 12 words>" },
    { "name": "Nice-to-haves match","score": <integer 0-100>, "note": "<max 12 words>" },
    { "name": "Experience level",   "score": <integer 0-100>, "note": "<max 12 words>" },
    { "name": "Career trajectory",  "score": <integer 0-100>, "note": "<max 12 words>" }
  ],
  "dealbreaker_hit": <true | false>,
  "dealbreaker_detail": "<which dealbreaker was hit, or null>",
  "summary": "<1 short paragraph: key strengths and gaps>",
  "rejection_reason": "<1 candidate-facing sentence explaining why, or null if not rejected>"
}

Scoring guide:
- overall_score: weighted average — must-haves 50%, nice-to-haves 20%, experience 20%, trajectory 10%
- A dealbreaker_hit forces overall_score to 0 regardless of other scores
- Be specific in notes — mention actual skills/years from the resume`;
}

function buildUserMessage(
  candidate: Pick<Candidate, "name" | "resumeText" | "jobTitle">,
  rubric: RubricCriteria
): string {
  return `Job title: ${candidate.jobTitle}

Must-haves: ${rubric.mustHaves.length ? rubric.mustHaves.join("; ") : "none specified"}
Nice-to-haves: ${rubric.niceToHaves.length ? rubric.niceToHaves.join("; ") : "none specified"}
Dealbreakers: ${rubric.dealbreakers.length ? rubric.dealbreakers.join("; ") : "none specified"}

Candidate name: ${candidate.name}

Resume:
${candidate.resumeText.trim()}`;
}

// ─── Verdict logic ────────────────────────────────────────────────────────────

function deriveVerdict(
  score: number,
  dealbreakerHit: boolean,
  passThreshold = 70,
  reviewThreshold = 40
): Verdict {
  if (dealbreakerHit) return "reject";
  if (score >= passThreshold) return "pass";
  if (score >= reviewThreshold) return "review";
  return "reject";
}

// ─── Main screening function ──────────────────────────────────────────────────

interface RawAIResponse {
  overall_score: number;
  dimensions: ScoringDimension[];
  dealbreaker_hit: boolean;
  dealbreaker_detail: string | null;
  summary: string;
  rejection_reason: string | null;
}

export async function screenCandidate(
  candidate: Candidate,
  rubric: RubricCriteria,
  passThreshold = 70,
  reviewThreshold = 40
): Promise<ScreeningResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildUserMessage(candidate, rubric),
      },
    ],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: RawAIResponse;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error(`Failed to parse AI response: ${raw.slice(0, 200)}`);
  }

  const verdict = deriveVerdict(
    parsed.overall_score,
    parsed.dealbreaker_hit,
    passThreshold,
    reviewThreshold
  );

  let rejectionReason = parsed.rejection_reason;
  if (verdict === "reject" && !rejectionReason) {
    rejectionReason =
      "Thanks for your time — we’re moving ahead with candidates who are a closer fit right now.";
  }

  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    jobId: candidate.jobId,
    jobTitle: candidate.jobTitle,
    overallScore: parsed.dealbreaker_hit ? 0 : parsed.overall_score,
    verdict,
    dealbreakerHit: parsed.dealbreaker_hit,
    dimensions: parsed.dimensions,
    summary: parsed.summary,
    rejectionReason,
    screened_at: new Date().toISOString(),
    ashbyApplicationId: candidate.ashbyApplicationId,
  };
}
