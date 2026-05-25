import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("suppressions")
      .select("id, email, reason, source, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { suppressions: data ?? [] };
  });

export const addSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    email: z.string().email().max(255),
    reason: z.enum(["manual", "bounced", "complained", "unsubscribed"]).default("manual"),
    source: z.string().max(120).optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    const { error } = await context.supabase.from("suppressions").upsert({
      user_id: context.userId, email, reason: data.reason, source: data.source ?? null,
    }, { onConflict: "user_id,email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("suppressions")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
