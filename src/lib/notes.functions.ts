import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listLeadNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: notes, error } = await context.supabase
      .from("lead_notes")
      .select("id, body, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { notes: notes ?? [] };
  });

export const addLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lead_notes")
      .insert({ lead_id: data.leadId, body: data.body, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leadActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const [notesQ, eventsQ] = await Promise.all([
      context.supabase
        .from("lead_notes")
        .select("id, body, created_at")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("email_events")
        .select("id, event_type, subject, occurred_at, metadata")
        .eq("lead_id", data.leadId)
        .order("occurred_at", { ascending: false }),
    ]);
    if (notesQ.error) throw new Error(notesQ.error.message);
    if (eventsQ.error) throw new Error(eventsQ.error.message);
    return { notes: notesQ.data ?? [], events: eventsQ.data ?? [] };
  });
