import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

// Every admin call re-checks the admin role as the caller before using privileged access.
async function adminClient(context: Ctx) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !isAdmin) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: authData }, profiles, progress, focus, answers, presence, partners] = await Promise.all([
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      db.from("profiles").select("id,name,email,created_at"),
      db.from("topic_progress").select("user_id").eq("completed", true),
      db.from("focus_sessions").select("host_id,partner_id,duration_min,state"),
      db.from("quiz_answers").select("user_id"),
      db.from("presence").select("user_id,updated_at"),
      db.from("study_partners").select("user_id,partner_id"),
    ]);
    const count = (rows: any[] | null, key: string) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
      return m;
    };
    const topics = count(progress.data, "user_id");
    const quiz = count(answers.data, "user_id");
    const focusMin = new Map<string, number>();
    for (const s of focus.data ?? []) for (const u of [s.host_id, s.partner_id]) if (u) focusMin.set(u, (focusMin.get(u) ?? 0) + (s.duration_min ?? 0));
    const seen = new Map<string, string>((presence.data ?? []).map((p: any) => [p.user_id, p.updated_at]));
    const partnerOf = new Map<string, string>((partners.data ?? []).map((p: any) => [p.user_id, p.partner_id]));
    const names = new Map<string, string>((profiles.data ?? []).map((p: any) => [p.id, p.name]));
    const users = (authData?.users ?? []).map((u: any) => ({
      id: u.id,
      name: names.get(u.id) ?? "",
      email: u.email ?? "",
      createdAt: u.created_at,
      lastActive: seen.get(u.id) ?? u.last_sign_in_at ?? null,
      topics: topics.get(u.id) ?? 0,
      focusMinutes: focusMin.get(u.id) ?? 0,
      quizAnswers: quiz.get(u.id) ?? 0,
      partnerName: partnerOf.has(u.id) ? names.get(partnerOf.get(u.id)!) ?? "Partner" : null,
    }));
    const weekAgo = Date.now() - 7 * 864e5;
    return {
      users,
      totals: {
        users: users.length,
        activeWeek: users.filter((u: any) => u.lastActive && new Date(u.lastActive).getTime() > weekAgo).length,
        topics: users.reduce((a: number, u: any) => a + u.topics, 0),
        focusMinutes: users.reduce((a: number, u: any) => a + u.focusMinutes, 0),
        quizAnswers: users.reduce((a: number, u: any) => a + u.quizAnswers, 0),
      },
    };
  });

export const adminUnlinkPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => ({ userId: String(i.userId) }))
  .handler(async ({ data, context }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("study_partners").delete().or(`user_id.eq.${data.userId},partner_id.eq.${data.userId}`);
    if (error) throw new Error("Couldn't unlink partner.");
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; confirmation: string }) => {
    if (i.confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");
    return { userId: String(i.userId), confirmation: "DELETE" };
  })
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You can't delete your own admin account here.");
    const db = await adminClient(context as Ctx);
    const { error: e1 } = await db.rpc("prepare_own_account_deletion", { p_user_id: data.userId, p_confirmation: "DELETE" });
    if (e1) throw new Error("Couldn't remove this user's data.");
    const { error } = await db.auth.admin.deleteUser(data.userId, false);
    if (error) throw new Error("Data removed, but account deletion did not finish.");
    return { ok: true };
  });

export const adminAnnounce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { title: string; body: string }) => {
    const title = String(i.title ?? "").trim().slice(0, 80);
    const body = String(i.body ?? "").trim().slice(0, 300);
    if (!title || !body) throw new Error("Add a title and a message.");
    return { title, body };
  })
  .handler(async ({ data, context }) => {
    const db = await adminClient(context as Ctx);
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const rows = (list?.users ?? []).map((u: any) => ({ user_id: u.id, kind: "announcement", title: data.title, body: data.body, url: "/dashboard", data: {} }));
    if (rows.length) {
      const { error } = await db.from("notification_queue").insert(rows);
      if (error) throw new Error("Couldn't send the announcement.");
    }
    return { sent: rows.length };
  });
