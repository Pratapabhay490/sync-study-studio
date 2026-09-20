// Per-user rate limiting backed by the public.check_rate_limit database function.
// Fails open only when the database call itself errors, so a transient DB
// hiccup can never lock users out of the app.
export async function allowRequest(
  sb: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  bucket: string,
  limit: number,
  windowSeconds = 3600,
): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export function tooManyRequests(corsHeaders: Record<string, string>, retryAfterSeconds = 600) {
  return new Response(
    JSON.stringify({ error: "rate_limited", message: "Too many requests. Please try again a bit later." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
