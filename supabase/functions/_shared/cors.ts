// Origin-restricted CORS. Only the app's own surfaces may call these functions
// from a browser; unknown origins get no CORS grant (server-to-server callers
// such as pg_cron are unaffected, since they don't enforce CORS).
const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-request-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

const EXTRA_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  if (EXTRA_ORIGINS.includes(origin)) return true;
  let host: string;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return false;
    }
    host = u.hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1") return true;
  return (
    host === "lovable.dev" ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com")
  );
}

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!origin) return { ...BASE_HEADERS }; // non-browser caller (cron, server)
  if (!isAllowed(origin)) return { ...BASE_HEADERS };
  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
}

// Backwards-compatible default (no origin grant).
export const corsHeaders: Record<string, string> = { ...BASE_HEADERS };
