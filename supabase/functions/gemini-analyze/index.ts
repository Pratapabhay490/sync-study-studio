// AI study analyzer via Lovable AI Gateway (Gemini under the hood).
// POST { kind: "insights" | "weekly" | "compare", payload: any } -> { headline, summary, bullets, next_actions }
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const SYS = `You are an encouraging MBBS study coach for two partners using the "Let's be in sync" app.
Always respond as STRICT JSON with this shape:
{
  "headline": "one short punchy sentence (max 90 chars)",
  "summary": "2-3 sentence overview, warm and honest",
  "bullets": ["3-5 specific, actionable, data-grounded insights"],
  "next_actions": ["2-3 concrete next steps for today/tomorrow"]
}
No markdown, no code fences. Be specific to the numbers given.`;

async function callLovable(prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY ?? "",
      "X-Lovable-AIG-SDK": "supabase-edge-function",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`lovable_ai ${res.status}: ${detail}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "{}";
}

async function callGeminiDirect(prompt: string) {
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastErr = "";
  for (const m of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYS }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
      },
    );
    if (res.ok) {
      const j = await res.json();
      return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    }
    lastErr = `${m} -> ${res.status} ${await res.text()}`;
  }
  throw new Error(`gemini ${lastErr}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { kind, payload } = await req.json();
    const prompt = `Kind: ${kind}\nData:\n${JSON.stringify(payload, null, 2)}\n\nReturn the JSON now.`;

    let text = "{}";
    let usedProvider = "lovable";
    try {
      if (!LOVABLE_API_KEY) throw new Error("no_lovable_key");
      text = await callLovable(prompt);
    } catch (e) {
      console.warn("lovable failed, fallback to gemini direct:", String(e));
      usedProvider = "gemini";
      if (!GEMINI_API_KEY) throw e;
      text = await callGeminiDirect(prompt);
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { headline: "AI insight", summary: String(text).slice(0, 400), bullets: [], next_actions: [] };
    }
    return new Response(JSON.stringify({ ...parsed, _provider: usedProvider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gemini-analyze error:", e);
    return new Response(
      JSON.stringify({
        headline: "AI is taking a quick break",
        summary: "Couldn't reach the AI service right now. Try again in a moment.",
        bullets: [],
        next_actions: [],
        error: String((e as Error)?.message ?? e),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
