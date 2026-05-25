import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSeedInboxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("seed_inboxes")
      .select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    return { inboxes: data ?? [] };
  });

export const addSeedInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    email: z.string().email().max(255),
    provider: z.string().max(40).optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("seed_inboxes").upsert({
      user_id: context.userId,
      email: data.email.toLowerCase(),
      provider: data.provider ?? null,
    }, { onConflict: "user_id,email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSeedInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("seed_inboxes")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Latest placement summary for the current user. */
export const inboxHealthSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("seed_inboxes")
      .select("last_inbox, last_spam, last_missing, last_checked_at")
      .eq("user_id", context.userId);
    const rows = data ?? [];
    const checked = rows.filter((r: any) => r.last_checked_at);
    const inbox = checked.filter((r: any) => r.last_inbox).length;
    const spam = checked.filter((r: any) => r.last_spam).length;
    const missing = checked.filter((r: any) => r.last_missing).length;
    const total = checked.length || 1;
    return {
      total_checked: checked.length,
      inbox_pct: Math.round((inbox / total) * 100),
      spam_pct: Math.round((spam / total) * 100),
      missing_pct: Math.round((missing / total) * 100),
      last_run: checked.map((r: any) => r.last_checked_at).sort().slice(-1)[0] ?? null,
    };
  });
