import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateAccountConfirmation } from "./account-actions";

export const restartFresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => ({
    confirmation: validateAccountConfirmation("reset", input.confirmation),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reset_own_study_progress", { p_confirmation: data.confirmation });
    if (error) throw new Error("Couldn't restart fresh. Please try again.");
    return { ok: true };
  });

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => ({
    confirmation: validateAccountConfirmation("delete", input.confirmation),
  }))
  .handler(async ({ data, context }) => {
    // Revalidate the account, not just the token, before deleting only its owner.
    const { data: account, error: authError } = await context.supabase.auth.getUser();
    if (authError || account.user?.id !== context.userId) throw new Error("Please sign in again before deleting your account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: cleanupError } = await supabaseAdmin.rpc("prepare_own_account_deletion", {
      p_user_id: context.userId, p_confirmation: data.confirmation,
    });
    if (cleanupError) throw new Error("Couldn't remove your data. Your account has not been deleted. Please try again.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId, false);
    if (error) throw new Error("Your study data was removed, but account deletion did not finish. Please retry Delete account.");
    return { ok: true };
  });