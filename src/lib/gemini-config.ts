// Centralized Gemini model configuration for the frontend / server functions
// that run in the app runtime (not Supabase Edge Functions — those use
// supabase/functions/_shared/gemini.ts).
//
// Keep this in sync with supabase/functions/_shared/gemini.ts.

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_API_VERSION = "v1beta";
export const LOVABLE_GATEWAY_MODEL = `google/${GEMINI_MODEL}`;

let _logged = false;
export function logGeminiStartup(where: string) {
  if (_logged || typeof console === "undefined") return;
  _logged = true;
  console.log("[gemini_config]", {
    where,
    model: GEMINI_MODEL,
    api_version: GEMINI_API_VERSION,
    lovable_gateway_model: LOVABLE_GATEWAY_MODEL,
  });
}
