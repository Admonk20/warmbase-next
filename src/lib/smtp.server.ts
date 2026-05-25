// SMTP wrapper using nodemailer. Server-only.
import nodemailer from "nodemailer";
import { decryptSecret } from "./crypto.server";

export type SmtpRow = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_enc: string;
  from_email: string;
  from_name?: string | null;
  reply_to?: string | null;
};

export function transportFromRow(row: SmtpRow, password: string) {
  return nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: row.secure, // true for 465, false for 587/STARTTLS
    auth: { user: row.username, pass: password },
    requireTLS: !row.secure, // upgrade on 587
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

export async function verifyTransport(row: SmtpRow, plaintextPassword?: string) {
  const pwd = plaintextPassword ?? (await decryptSecret(row.password_enc));
  const t = transportFromRow(row, pwd);
  try {
    await t.verify();
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e).slice(0, 300) };
  } finally {
    t.close();
  }
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  messageId: string;
};

export async function smtpSend(row: SmtpRow, args: SendArgs) {
  const pwd = await decryptSecret(row.password_enc);
  const t = transportFromRow(row, pwd);
  try {
    const from = row.from_name ? `"${row.from_name}" <${row.from_email}>` : row.from_email;
    const info = await t.sendMail({
      from,
      replyTo: row.reply_to ?? undefined,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers: args.headers,
      messageId: `<${args.messageId}@${row.from_email.split("@")[1] ?? "coldbase.local"}>`,
    });
    return { ok: true as const, id: info.messageId, response: info.response };
  } finally {
    t.close();
  }
}

// Warm-up day -> daily cap formula: gentle ramp (20 -> 40 -> 80 -> 150 -> 300...)
export function warmupCap(day: number, hardCap: number): number {
  const ramp = [20, 30, 50, 80, 120, 170, 220, 280, 350, 420, 500];
  const v = day < ramp.length ? ramp[day] : 500 + (day - ramp.length + 1) * 100;
  return Math.min(hardCap, v);
}
