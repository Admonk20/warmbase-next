import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fuzzy duplicate detection across email, linkedin_url, and (company + contact).
// Returns groups of likely duplicates so the user can merge.

function norm(s?: string | null) { return (s ?? "").toLowerCase().trim().replace(/\s+/g, " "); }

export const findDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("leads")
      .select("id, contact, company, email, linkedin_url, created_at, status")
      .is("merged_into_id", null)
      .order("created_at", { ascending: true });
    const rows = data ?? [];

    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const keys: string[] = [];
      if (r.email) keys.push("e:" + norm(r.email));
      if (r.linkedin_url) keys.push("l:" + norm(r.linkedin_url).replace(/\/$/, ""));
      if (r.contact && r.company) keys.push("nc:" + norm(r.contact) + "|" + norm(r.company));
      for (const k of keys) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      }
    }
    // emit only groups with 2+ leads
    const seen = new Set<string>();
    const out: { key: string; leads: any[] }[] = [];
    for (const [key, leads] of groups.entries()) {
      if (leads.length < 2) continue;
      const sig = leads.map((l) => l.id).sort().join(",");
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ key, leads });
    }
    return out;
  });

export const mergeLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    primaryId: z.string().uuid(),
    duplicateIds: z.array(z.string().uuid()).min(1).max(20),
  }).parse)
  .handler(async ({ data, context }) => {
    // Re-point notes and events to primary
    await context.supabase.from("lead_notes").update({ lead_id: data.primaryId }).in("lead_id", data.duplicateIds);
    await context.supabase.from("email_events").update({ lead_id: data.primaryId }).in("lead_id", data.duplicateIds);
    // Mark duplicates as merged
    await context.supabase
      .from("leads")
      .update({ merged_into_id: data.primaryId, status: "lost" })
      .in("id", data.duplicateIds);
    return { ok: true, merged: data.duplicateIds.length };
  });
