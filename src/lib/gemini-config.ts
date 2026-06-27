// Centralized Gemini model configuration for the frontend / server functions
// that run in the app runtime (not Supabase Edge Functions — those use
// supabase/functions/_shared/gemini.ts).
//
// Keep this in sync with supabase/functions/_shared/gemini.ts.

export const GEMINI_MODEL = "gemini-2.5-flash";
export const LOVABLE_AI_GATEWAY_ENDPOINT = "/v1/chat/completions";
export const LOVABLE_GATEWAY_MODEL = `google/${GEMINI_MODEL}`;

let _logged = false;
export function logGeminiStartup(where: string) {
  if (_logged || typeof console === "undefined") return;
  _logged = true;
  console.log("[gemini_config]", {
    where,
    model: GEMINI_MODEL,
    provider: "lovable_ai_gateway",
    endpoint: LOVABLE_AI_GATEWAY_ENDPOINT,
    lovable_gateway_model: LOVABLE_GATEWAY_MODEL,
  });
}
