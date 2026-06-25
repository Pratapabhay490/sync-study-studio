// Enqueues a personalized motivational notification for every active user.
// Called by pg_cron 5 times per day. Looks at today's completed topics to pick tone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LOW = [
  { t: "Let's open the first one", b: "A blank day is the easiest to fix — tick just one topic." },
  { t: "One topic, that's it", b: "Future-you remembers this moment. Pick a quick win." },
  { t: "Tiny effort > zero effort", b: "Open a subject and ride the first 10 minutes." },
];
const MID = [
  { t: "Don't break the rhythm", b: "You're rolling. Two more topics and today's a win." },
  { t: "Momentum check ✅", b: "Keep syncing with your partner — they can feel it." },
  { t: "Halfway through the grind", b: "Don't slow down now, you're closer than you think." },
];
const HIGH = [
  { t: "Beast mode unlocked", b: "Cap the day strong — your partner is watching the streak." },
  { t: "Closing strong", b: "This is the version of you NEET PG fears. Continue." },
  { t: "Lead the streak", b: "Big day so far. One more and you go to bed proud." },
];

function pick(arr: { t: string; b: string }[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

  const { data: users } = await supabase.from("profiles").select("id, name");
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  let queued = 0;
  for (const u of users ?? []) {
    const { count } = await supabase
      .from("topic_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id)
      .eq("completed", true)
      .gte("completed_at", start.toISOString());
    const done = count ?? 0;
    const pool = done === 0 ? LOW : done < 4 ? MID : HIGH;
    const m = pick(pool);
    const { error } = await supabase.from("notification_queue").insert({
      user_id: u.id,
      kind: "motivation",
      title: m.t,
      body: m.b,
      url: "/dashboard",
      data: { done_today: done },
    });
    if (!error) queued++;
  }

  return new Response(JSON.stringify({ queued }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
