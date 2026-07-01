// Enqueues a personalized motivational notification for every active user.
// Called by pg_cron 5 times per day. Looks at today's completed topics to pick tone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// NEET PG 2026 exam date
const EXAM_DATE = new Date("2026-08-30T00:00:00+05:30");
function daysToExam() {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - Date.now()) / 86400000));
}
const LOW = (d: number) => [
  { t: `${d} days to NEET PG — start with one`, b: "A blank day is the easiest to fix. Tick just one topic." },
  { t: "One topic, that's it", b: `Only ${d} days left. Future-you remembers this moment.` },
  { t: "Tiny effort > zero effort", b: `${d} days on the clock. Open a subject and ride the first 10 minutes.` },
];
const MID = (d: number) => [
  { t: "Don't break the rhythm", b: `${d} days to exam. Two more topics and today's a win.` },
  { t: `Momentum check ✅ · ${d} days left`, b: "Keep syncing with your partner — they can feel it." },
  { t: "Halfway through today", b: `${d} days until NEET PG. Don't slow down now.` },
];
const HIGH = (d: number) => [
  { t: "Beast mode unlocked", b: `${d} days out — cap the day strong. Your partner is watching the streak.` },
  { t: "Closing strong", b: `This is the version of you NEET PG fears. ${d} days to prove it.` },
  { t: `Lead the streak · ${d} days`, b: "Big day so far. One more and you go to bed proud." },
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
    const d = daysToExam();
    const pool = done === 0 ? LOW(d) : done < 4 ? MID(d) : HIGH(d);
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
