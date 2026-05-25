import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

export const exportLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.string().optional() }).parse)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("leads")
      .select("contact, company, title, email, phone, niche, status, temperature, value, source, linkedin_url, last_emailed_at, created_at")
      .eq("user_id", context.userId).limit(5000);
    if (data.status) q = q.eq("status", data.status as never);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const cols = ["contact","company","title","email","phone","niche","status","temperature","value","source","linkedin_url","last_emailed_at","created_at"];
    return { csv: toCsv((rows ?? []) as any, cols), count: rows?.length ?? 0 };
  });

export const exportActivityCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(1).max(365).default(30) }).parse)
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase.from("email_events")
      .select("occurred_at, event_type, subject, lead_id, campaign_id, metadata")
      .eq("user_id", context.userId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);
    const flat = (rows ?? []).map((r: any) => ({
      occurred_at: r.occurred_at, event_type: r.event_type, subject: r.subject,
      lead_id: r.lead_id, campaign_id: r.campaign_id,
      to: r.metadata?.to ?? "", reason: r.metadata?.reason ?? r.metadata?.error ?? "",
    }));
    const cols = ["occurred_at","event_type","subject","to","lead_id","campaign_id","reason"];
    return { csv: toCsv(flat, cols), count: flat.length };
  });

export const weeklyDigest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [evtsR, leadsR] = await Promise.all([
      context.supabase.from("email_events")
        .select("event_type").eq("user_id", context.userId).gte("occurred_at", since).limit(10000),
      context.supabase.from("leads")
        .select("status, value, updated_at").eq("user_id", context.userId).gte("updated_at", since).limit(2000),
    ]);
    const evts = evtsR.data ?? [];
    const tally = (t: string) => evts.filter((e: any) => e.event_type === t).length;
    const leads = leadsR.data ?? [];
    return {
      window_days: 7,
      sent: tally("sent"),
      opened: tally("opened"),
      clicked: tally("clicked"),
      replied: tally("replied"),
      bounced: tally("bounced"),
      unsubscribed: tally("unsubscribed"),
      new_leads: leads.length,
      pipeline_value: leads.reduce((a, l: any) => a + Number(l.value ?? 0), 0),
      won_value: leads.filter((l: any) => l.status === "won").reduce((a, l: any) => a + Number(l.value ?? 0), 0),
    };
  });
