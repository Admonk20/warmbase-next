import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptSecret } from "./crypto.server";

const ALLOWED_PROVIDERS = ["openai", "resend", "hunter", "serper", "brave"] as const;

export const saveUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      provider: z.enum(ALLOWED_PROVIDERS),
      value: z.string().min(8).max(500),
      label: z.string().max(100).optional().nullable(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const enc = await encryptSecret(data.value.trim());
    const { error } = await context.supabase.from("user_api_keys").insert({
      user_id: context.userId,
      provider: data.provider,
      label: data.label ?? null,
      value_enc: enc,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
