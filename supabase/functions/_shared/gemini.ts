// Centralized Gemini model configuration for all Edge Functions.
// Change the model in ONE place. Override per-deployment with the
// GEMINI_MODEL env var if you ever need to A/B another model.
//
// Currently using gemini-2.5-flash (stable, supports v1beta generateContent
// with systemInstruction + JSON response mime type).

export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
export const GEMINI_API_VERSION = "v1beta";
export const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}`;

export function geminiGenerateContentUrl(apiKey: string, model: string = GEMINI_MODEL) {
  return `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
}

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
    api_version: GEMINI_API_VERSION,
    lovable_gateway_model: LOVABLE_GATEWAY_MODEL,
    timestamp: new Date().toISOString(),
  }));
}
