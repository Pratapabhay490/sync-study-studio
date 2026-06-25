// Drains notification_queue and sends Web Push to every subscription of each recipient.
// Triggered by pg_cron every minute, and also callable on-demand.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "https://esm.sh/web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@sync-study.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const CRON_SECRET = Deno.env.get("CRON_SECRET");

function authorized(req: Request) {
  if (!CRON_SECRET) return false;
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  return token === CRON_SECRET;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pull up to 100 unprocessed
  const { data: items, error } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;
  const deadEndpoints: string[] = [];

  for (const item of items ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", item.user_id);

    const payload = JSON.stringify({
      title: item.title,
      body: item.body,
      url: item.url ?? "/dashboard",
      kind: item.kind,
      tag: `${item.kind}:${item.id}`,
      data: item.data ?? {},
    });

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        failed++;
        const code = e?.statusCode;
        if (code === 404 || code === 410) deadEndpoints.push(s.endpoint);
      }
    }

    await supabase
      .from("notification_queue")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", item.id);
  }

  if (deadEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return new Response(
    JSON.stringify({ processed: items?.length ?? 0, sent, failed, pruned: deadEndpoints.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
