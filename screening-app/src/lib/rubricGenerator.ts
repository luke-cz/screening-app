import Anthropic from "@anthropic-ai/sdk";
import type { RubricCriteria } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RawRubricResponse {
  must_haves: string[];
  nice_to_haves: string[];
  dealbreakers: string[];
}

function buildRubricSystemPrompt(): string {
  return `You are a recruiting assistant. Extract a concise rubric from a job description.
Return ONLY valid JSON with this shape:
{
  "must_haves": ["short tag", "..."],
  "nice_to_haves": ["short tag", "..."],
  "dealbreakers": ["short tag", "..."]
}

Rules:
- Must-haves are the hard requirements mentioned explicitly.
- Nice-to-haves are optional skills or bonus experience.
- Dealbreakers should be empty unless the description explicitly states a hard exclusion.
- Keep each tag under 6 words.
- Use plain text (no markdown).`;
}

export async function generateRubricFromJobDescription(
  jobTitle: string,
  jobDescription: string
): Promise<RubricCriteria | null> {
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: buildRubricSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Job title: ${jobTitle}\n\nJob description:\n${jobDescription}`,
        },
      ],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as RawRubricResponse;

    return {
      mustHaves: parsed.must_haves ?? [],
      niceToHaves: parsed.nice_to_haves ?? [],
      dealbreakers: parsed.dealbreakers ?? [],
    };
  } catch (err) {
    console.error("[RubricGenerator] Failed to generate rubric:", err);
    return null;
  }
}
