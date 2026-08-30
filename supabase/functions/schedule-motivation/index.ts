// Enqueues a personalized motivational notification for every active user.
// Called by pg_cron 5 times per day. Looks at today's completed topics to pick tone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fallback when a user hasn't set their own countdown
const DEFAULT_EXAM_DATE = "2026-08-30T00:00:00+05:30";
const DEFAULT_LABEL = "NEET PG";
function daysTo(dateIso: string) {
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86400000));
}
const LOW = (d: number, e: string) => [
  { t: `${d} days to ${e} — start with one`, b: "A blank day is the easiest to fix. Tick just one topic." },
  { t: "One topic, that's it", b: `Only ${d} days left for ${e}. Future-you remembers this moment.` },
  { t: "Tiny effort > zero effort", b: `${d} days on the clock. Open a subject and ride the first 10 minutes.` },
];
const MID = (d: number, e: string) => [
  { t: "Don't break the rhythm", b: `${d} days to ${e}. Two more topics and today's a win.` },
  { t: `Momentum check ✅ · ${d} days left`, b: "Keep syncing with your partner — they can feel it." },
  { t: "Halfway through today", b: `${d} days until ${e}. Don't slow down now.` },
];
const HIGH = (d: number, e: string) => [
  { t: "Beast mode unlocked", b: `${d} days out — cap the day strong. Your partner is watching the streak.` },
  { t: "Closing strong", b: `This is the version of you ${e} fears. ${d} days to prove it.` },
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

  const { data: users } = await supabase
    .from("profiles")
    .select("id, name, countdown_label, countdown_date, countdown_sync, countdown_updated_at");
  const { data: pairs } = await supabase.from("study_partners").select("user_id, partner_id");
  const byId = new Map((users ?? []).map((u: any) => [u.id, u]));
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

    // Resolve this user's own countdown; if they enabled sync, use the most
    // recently updated countdown shared with their partner.
    let src: any = u;
    if (u.countdown_sync) {
      const partnerIds = (pairs ?? [])
        .filter((p: any) => p.user_id === u.id || p.partner_id === u.id)
        .map((p: any) => (p.user_id === u.id ? p.partner_id : p.user_id));
      const candidates = [u, ...partnerIds.map((id: string) => byId.get(id))]
        .filter((c: any) => c && c.countdown_sync && c.countdown_date)
        .sort(
          (a: any, b: any) =>
            new Date(b.countdown_updated_at ?? 0).getTime() -
            new Date(a.countdown_updated_at ?? 0).getTime(),
        );
      if (candidates.length) src = candidates[0];
    }
    const examDate = src?.countdown_date ?? DEFAULT_EXAM_DATE;
    const examLabel = src?.countdown_label || DEFAULT_LABEL;

    const d = daysTo(examDate);
    const pool = done === 0 ? LOW(d, examLabel) : done < 4 ? MID(d, examLabel) : HIGH(d, examLabel);
    const m = pick(pool);
    const { error } = await supabase.from("notification_queue").insert({
      user_id: u.id,
      kind: "motivation",
      title: m.t,
      body: m.b,
      url: "/dashboard",
      data: { done_today: done, exam_label: examLabel, days_left: d },
    });
    if (!error) queued++;
  }


  return new Response(JSON.stringify({ queued }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
