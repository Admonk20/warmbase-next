import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSendPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_send_preferences")
      .select("*").eq("user_id", context.userId).maybeSingle();
    return { prefs: data ?? null };
  });

export const saveSendPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    send_start_hour: z.number().int().min(0).max(23),
    send_end_hour: z.number().int().min(1).max(24),
    skip_weekends: z.boolean(),
    holiday_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
    default_timezone: z.string().min(1).max(64),
    throttle_seconds: z.number().int().min(0).max(3600),
  }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_send_preferences").upsert({
      user_id: context.userId, ...data,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
