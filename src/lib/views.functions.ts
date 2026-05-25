import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FilterSchema = z.object({
  status: z.string().optional(),
  temperature: z.string().optional(),
  niche: z.string().optional(),
  min_score: z.number().int().min(0).max(100).optional(),
  stale_days: z.number().int().min(1).max(365).optional(),
  source: z.string().optional(),
}).strict();

export type LeadFilters = z.infer<typeof FilterSchema>;

export const listSavedViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("saved_views")
      .select("id, name, filters, created_at").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    return { views: data ?? [] };
  });

export const upsertSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    filters: FilterSchema,
  }).parse)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("saved_views")
        .update({ name: data.name, filters: data.filters })
        .eq("id", data.id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase.from("saved_views")
      .insert({ user_id: context.userId, name: data.name, filters: data.filters })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_views")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Resolve a saved view into a filtered list of leads. */
export const runSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: view } = await context.supabase.from("saved_views")
      .select("filters").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!view) throw new Error("View not found");
    const f = (view.filters ?? {}) as LeadFilters;
    let q: any = context.supabase.from("leads")
      .select("id, contact, company, email, status, temperature, engagement_score, last_emailed_at, niche, source")
      .eq("user_id", context.userId).limit(1000);
    if (f.status) q = q.eq("status", f.status);
    if (f.temperature) q = q.eq("temperature", f.temperature);
    if (f.niche) q = q.eq("niche", f.niche);
    if (f.source) q = q.eq("source", f.source);
    if (f.min_score != null) q = q.gte("engagement_score", f.min_score);
    if (f.stale_days != null) {
      const cutoff = new Date(Date.now() - f.stale_days * 86400_000).toISOString();
      q = q.or(`last_emailed_at.is.null,last_emailed_at.lt.${cutoff}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { leads: rows ?? [] };
  });
