import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Funnel: sent → opened → replied → meeting → won, optionally per campaign. */
export const funnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    days: z.number().int().min(1).max(365).default(30),
    campaignId: z.string().uuid().optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let eq: any = context.supabase.from("email_events")
      .select("event_type, lead_id")
      .eq("user_id", context.userId)
      .gte("occurred_at", since)
      .limit(20000);
    if (data.campaignId) eq = eq.eq("campaign_id", data.campaignId);
    const { data: evts } = await eq;
    const rows = (evts ?? []) as Array<{ event_type: string; lead_id: string | null }>;

    const uniq = (t: string) => new Set(rows.filter((r) => r.event_type === t && r.lead_id).map((r) => r.lead_id!)).size;
    const sentLeads = new Set(rows.filter((r) => r.event_type === "sent" && r.lead_id).map((r) => r.lead_id!));

    let lq: any = context.supabase.from("leads")
      .select("id, status, value, updated_at")
      .eq("user_id", context.userId)
      .in("status", ["meeting", "won"]);
    if (sentLeads.size > 0) lq = lq.in("id", Array.from(sentLeads));
    const { data: leads } = sentLeads.size ? await lq : { data: [] };
    const leadRows = (leads ?? []) as Array<{ id: string; status: string; value: number | null }>;

    return {
      window_days: data.days,
      sent: sentLeads.size,
      opened: uniq("opened"),
      replied: uniq("replied"),
      meeting: leadRows.filter((l) => l.status === "meeting" || l.status === "won").length,
      won: leadRows.filter((l) => l.status === "won").length,
      won_value: leadRows.filter((l) => l.status === "won").reduce((a, l) => a + Number(l.value ?? 0), 0),
    };
  });

/** Weekly cohort: leads bucketed by created_at week, with sent/replied counts within 30 days of creation. */
export const cohorts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ weeks: z.number().int().min(2).max(26).default(8) }).parse)
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.weeks * 7 * 86400_000).toISOString();
    const { data: leads } = await context.supabase.from("leads")
      .select("id, created_at, status, value")
      .eq("user_id", context.userId)
      .gte("created_at", since)
      .limit(5000);
    const leadRows = (leads ?? []) as Array<{ id: string; created_at: string; status: string; value: number | null }>;
    const leadById = new Map(leadRows.map((l) => [l.id, l]));

    const { data: evts } = await context.supabase.from("email_events")
      .select("event_type, lead_id")
      .eq("user_id", context.userId)
      .gte("occurred_at", since)
      .in("event_type", ["sent", "replied"])
      .limit(20000);
    const evtRows = (evts ?? []) as Array<{ event_type: string; lead_id: string | null }>;

    function weekKey(d: string) {
      const dt = new Date(d);
      const day = dt.getUTCDay();
      const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate() - ((day + 6) % 7)); monday.setUTCHours(0, 0, 0, 0);
      return monday.toISOString().slice(0, 10);
    }

    const buckets = new Map<string, { week: string; leads: number; sent: number; replied: number; won: number; value: number }>();
    for (const l of leadRows) {
      const wk = weekKey(l.created_at);
      const b = buckets.get(wk) ?? { week: wk, leads: 0, sent: 0, replied: 0, won: 0, value: 0 };
      b.leads += 1;
      if (l.status === "won") { b.won += 1; b.value += Number(l.value ?? 0); }
      buckets.set(wk, b);
    }
    for (const e of evtRows) {
      if (!e.lead_id) continue;
      const l = leadById.get(e.lead_id);
      if (!l) continue;
      const wk = weekKey(l.created_at);
      const b = buckets.get(wk);
      if (!b) continue;
      if (e.event_type === "sent") b.sent += 1;
      if (e.event_type === "replied") b.replied += 1;
    }
    return { cohorts: Array.from(buckets.values()).sort((a, b) => a.week.localeCompare(b.week)) };
  });
