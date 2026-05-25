// IMAP reply puller using imapflow + mailparser. Server-only.
// Polls INBOX for messages since last_uid, matches to leads by sender email, logs replied events.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptSecret } from "./crypto.server";
import { recomputeLeadScore } from "./scoring.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function pollImapForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; processed: number; error?: string }> {
  const { data: row } = await supabase
    .from("user_smtp_settings")
    .select("imap_host, imap_port, imap_username, imap_password_enc, imap_last_uid, imap_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || !row.imap_enabled || !row.imap_host || !row.imap_username || !row.imap_password_enc) {
    return { ok: false, processed: 0, error: "IMAP not configured" };
  }
  const pwd = await decryptSecret(row.imap_password_enc);
  const client = new ImapFlow({
    host: row.imap_host,
    port: row.imap_port ?? 993,
    secure: true,
    auth: { user: row.imap_username, pass: pwd },
    logger: false,
  });
  let processed = 0;
  let maxUid = row.imap_last_uid ?? 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = Math.max(1, maxUid + 1);
      for await (const msg of client.fetch(`${since}:*`, { uid: true, source: true, envelope: true })) {
        if (msg.uid <= maxUid) continue;
        maxUid = Math.max(maxUid, msg.uid);
        const from = msg.envelope?.from?.[0]?.address?.toLowerCase();
        if (!from) continue;
        const { data: lead } = await supabase
          .from("leads").select("id").eq("user_id", userId).eq("email", from).maybeSingle();
        if (!lead) continue;
        let bodyText = "";
        try {
          const parsed = await simpleParser(msg.source as Buffer);
          bodyText = (parsed.text ?? parsed.subject ?? "").slice(0, 4000);
        } catch { /* ignore parse errors */ }
        await supabase.from("email_events").insert({
          user_id: userId,
          lead_id: lead.id,
          event_type: "replied",
          subject: msg.envelope?.subject ?? "Reply",
          metadata: { from, uid: msg.uid, preview: bodyText.slice(0, 200) },
        });
        await supabase.from("leads")
          .update({ status: "engaged", replied_at: new Date().toISOString() })
          .eq("id", lead.id);
        await recomputeLeadScore(supabase, lead.id);
        processed++;
      }
    } finally {
      lock.release();
    }
    await supabase.from("user_smtp_settings")
      .update({ imap_last_uid: maxUid })
      .eq("user_id", userId);
    return { ok: true, processed };
  } catch (e: any) {
    return { ok: false, processed, error: String(e?.message ?? e).slice(0, 300) };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
