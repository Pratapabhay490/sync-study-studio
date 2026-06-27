// Centralized Gemini-on-Lovable-AI configuration for all Edge Functions.
// Change the Gemini model in ONE place. Override per-deployment with the
// GEMINI_MODEL env var if you ever need to A/B another supported Gemini model.
//
// All app AI calls should go through Lovable AI Gateway using OpenAI-compatible
// chat bodies.

export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
export const LOVABLE_AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Lovable AI Gateway equivalent (OpenAI-compatible). Prefix with `google/`.
export const LOVABLE_GATEWAY_MODEL = `google/${GEMINI_MODEL.startsWith("gemini-") ? GEMINI_MODEL : "gemini-2.5-flash"}`;

// One-time startup log so config mismatches are obvious in function logs.
let _logged = false;
export function logGeminiStartup(fnName: string) {
  if (_logged) return;
  _logged = true;
  console.log(JSON.stringify({
    evt: "gemini_config",
    function: fnName,
    model: GEMINI_MODEL,
    provider: "lovable_ai_gateway",
    endpoint: "/v1/chat/completions",
    lovable_gateway_model: LOVABLE_GATEWAY_MODEL,
    timestamp: new Date().toISOString(),
  }));
}
