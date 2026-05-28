import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptSecret } from "./crypto.server";
import { assertSafeMailEndpoint } from "./mail-host-guard.server";
import { verifyTransport } from "./smtp.server";

const SmtpInput = z.object({
  host: z.string().min(3).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(500).optional(), // omit on update keeps existing
  from_email: z.string().email().max(255),
  from_name: z.string().max(120).optional().nullable(),
  reply_to: z.string().email().max(255).optional().nullable().or(z.literal("")),
  daily_cap: z.number().int().min(1).max(2000).optional(),
  warmup_enabled: z.boolean().optional(),
  imap_host: z.string().max(255).optional().nullable().or(z.literal("")),
  imap_port: z.number().int().min(1).max(65535).optional().nullable(),
  imap_username: z.string().max(255).optional().nullable().or(z.literal("")),
  imap_password: z.string().max(500).optional(),
  imap_enabled: z.boolean().optional(),
});

export const getSmtpSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_smtp_settings")
      .select("id, host, port, secure, username, from_email, from_name, reply_to, daily_cap, sent_today, warmup_day, warmup_enabled, verified_at, last_error, imap_host, imap_port, imap_username, imap_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

export const saveSmtpSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(SmtpInput.parse)
  .handler(async ({ data, context }) => {
    const smtpHost = await assertSafeMailEndpoint(data.host, data.port, "smtp");
    const imapEnabled = data.imap_enabled ?? false;
    const imapPort = data.imap_port ?? 993;
    const imapHost =
      imapEnabled && data.imap_host
        ? await assertSafeMailEndpoint(data.imap_host, imapPort, "imap")
        : null;
    if (imapEnabled && (!imapHost || !data.imap_username)) {
      throw new Error("IMAP host and username are required when IMAP is enabled");
    }

    const { data: existing } = await context.supabase
      .from("user_smtp_settings")
      .select("password_enc, imap_password_enc")
      .eq("user_id", context.userId)
      .maybeSingle();

    const password_enc = data.password
      ? await encryptSecret(data.password)
      : existing?.password_enc;
    if (!password_enc) throw new Error("Password is required for first save");

    const imap_password_enc = data.imap_password
      ? await encryptSecret(data.imap_password)
      : existing?.imap_password_enc ?? null;
    if (imapEnabled && !imap_password_enc) {
      throw new Error("IMAP password is required when IMAP is enabled");
    }

    const row = {
      user_id: context.userId,
      host: smtpHost,
      port: data.port,
      secure: data.secure,
      username: data.username,
      password_enc,
      from_email: data.from_email.toLowerCase(),
      from_name: data.from_name || null,
      reply_to: data.reply_to || null,
      daily_cap: data.daily_cap ?? 50,
      warmup_enabled: data.warmup_enabled ?? true,
      imap_host: imapHost,
      imap_port: imapHost ? imapPort : 993,
      imap_username: data.imap_username || null,
      imap_password_enc,
      imap_enabled: imapEnabled,
    };

    const { error } = await context.supabase
      .from("user_smtp_settings")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSmtpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(SmtpInput.parse)
  .handler(async ({ data, context }) => {
    const smtpHost = await assertSafeMailEndpoint(data.host, data.port, "smtp");
    let password = data.password;
    if (!password) {
      const { data: existing } = await context.supabase
        .from("user_smtp_settings")
        .select("password_enc")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!existing?.password_enc) return { ok: false, error: "No saved password — enter one to test." };
      const { decryptSecret } = await import("./crypto.server");
      password = await decryptSecret(existing.password_enc);
    }

    const result = await verifyTransport(
      {
        host: smtpHost,
        port: data.port,
        secure: data.secure,
        username: data.username,
        password_enc: "",
        from_email: data.from_email,
      },
      password,
    );

    await context.supabase
      .from("user_smtp_settings")
      .update({ verified_at: result.ok ? new Date().toISOString() : null, last_error: result.ok ? null : result.error })
      .eq("user_id", context.userId);

    return result;
  });

export const deleteSmtpSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("user_smtp_settings").delete().eq("user_id", context.userId);
    return { ok: true };
  });
