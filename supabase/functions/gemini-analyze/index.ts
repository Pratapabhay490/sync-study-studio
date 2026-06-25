// Gemini-powered study analyzer.
// POST { kind: "insights" | "weekly" | "compare", payload: any } -> { text, bullets }
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYS = `You are an encouraging MBBS study coach for two partners using the "Let's be in sync" app.
Always respond as STRICT JSON with this shape:
{
  "headline": "one short punchy sentence (max 90 chars)",
  "summary": "2-3 sentence overview, warm and honest",
  "bullets": ["3-5 specific, actionable, data-grounded insights"],
  "next_actions": ["2-3 concrete next steps for today/tomorrow"]
}
No markdown, no code fences. Be specific to the numbers given.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { kind, payload } = await req.json();
    const prompt = `Kind: ${kind}\nData:\n${JSON.stringify(payload, null, 2)}\n\nReturn the JSON now.`;
    const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "gemini_failed", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await res.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: unknown = {};
    try { parsed = JSON.parse(text); } catch { parsed = { headline: "AI insight", summary: text }; }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
