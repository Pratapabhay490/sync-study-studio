import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StudyStatsSchema = z.object({
  name: z.string().optional(),
  done: z.number().optional(),
  today: z.number().optional(),
  week: z.number().optional(),
  streak: z.number().optional(),
  pct: z.number().optional(),
});

const AnalyticsPayloadSchema = z.object({
  you: StudyStatsSchema,
  partner: StudyStatsSchema,
  total_topics: z.number(),
  total_subjects: z.number(),
  top_subjects: z.array(z.record(z.unknown())).optional(),
  weak_subjects: z.array(z.record(z.unknown())).optional(),
  last_7_days: z.array(z.record(z.unknown())).optional(),
});

const AnalyzeInputSchema = z.object({
  kind: z.string().default("insights"),
  payload: AnalyticsPayloadSchema,
});

export interface AIInsight {
  headline: string;
  summary: string;
  bullets: string[];
  next_actions: string[];
  _provider?: string;
}

const SYSTEM_PROMPT = `You are an encouraging MBBS study coach for two study partners using the "Let's be in sync" app.
Return only valid JSON with exactly these keys:
{
  "headline": "one short punchy sentence under 90 characters",
  "summary": "2-3 warm, honest, data-grounded sentences",
  "bullets": ["3-5 specific study patterns from the numbers"],
  "next_actions": ["2-3 concrete next steps for today or tomorrow"]
}
Do not use markdown or code fences.`;

function fallbackInsight(payload: z.infer<typeof AnalyticsPayloadSchema>): AIInsight {
  const you = payload.you.name || "You";
  const partner = payload.partner.name || "your partner";
  const weak = payload.weak_subjects?.[0];
  const weakName = typeof weak?.name === "string" ? weak.name : "your lowest-progress subject";

  return {
    headline: "Keep the momentum small and consistent.",
    summary: `${you} has completed ${payload.you.done ?? 0} topics and ${partner} has completed ${payload.partner.done ?? 0}. The fastest improvement now is not a huge reset, but a focused daily target that both of you can repeat.`,
    bullets: [
      `Your current completion gap is ${Math.abs((payload.you.done ?? 0) - (payload.partner.done ?? 0))} topics, so a short sync session can rebalance the plan.`,
      `${weakName} should get the next focused revision block because it is currently trailing the rest.`,
      `A daily target of 3–5 ticked topics will move the progress bar without making the schedule feel heavy.`,
    ],
    next_actions: [
      `Pick 2 pending topics from ${weakName} and finish them before the next break.`,
      "Do a 10-minute partner recap after marking topics complete.",
      "Keep tomorrow's first task small enough to protect the streak.",
    ],
    _provider: "local-fallback",
  };
}

function normalizeInsight(value: unknown, fallback: AIInsight): AIInsight {
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<AIInsight>;
  return {
    headline: typeof data.headline === "string" && data.headline.trim() ? data.headline : fallback.headline,
    summary: typeof data.summary === "string" && data.summary.trim() ? data.summary : fallback.summary,
    bullets: Array.isArray(data.bullets) && data.bullets.length
      ? data.bullets.filter((item): item is string => typeof item === "string").slice(0, 5)
      : fallback.bullets,
    next_actions: Array.isArray(data.next_actions) && data.next_actions.length
      ? data.next_actions.filter((item): item is string => typeof item === "string").slice(0, 3)
      : fallback.next_actions,
    _provider: data._provider,
  };
}

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

export const analyzeStudyProgress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInputSchema.parse(input))
  .handler(async ({ data }) => {
    const fallback = fallbackInsight(data.payload);
    const lovableApiKey = process.env.LOVABLE_API_KEY;

    if (!lovableApiKey) return fallback;

    try {
      const prompt = `Analysis kind: ${data.kind}\nStudy data:\n${JSON.stringify(data.payload, null, 2)}\n\nReturn the JSON now.`;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableApiKey,
          "X-Lovable-AIG-SDK": "tanstack-server-fn",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        console.warn("AI analysis failed", response.status, await response.text());
        return fallback;
      }

      const result = await response.json();
      const text = result?.choices?.[0]?.message?.content;
      if (typeof text !== "string") return fallback;

      return normalizeInsight({ ...extractJson(text), _provider: "lovable-ai" }, fallback);
    } catch (error) {
      console.warn("AI analysis unavailable", error);
      return fallback;
    }
  });