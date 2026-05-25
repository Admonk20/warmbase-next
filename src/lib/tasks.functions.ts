import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filter: z.enum(["today", "overdue", "upcoming", "completed", "all"]).default("all"),
      leadId: z.string().uuid().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("tasks")
      .select("id, title, notes, due_at, completed_at, priority, lead_id, created_at")
      .eq("user_id", context.userId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (data.leadId) q = q.eq("lead_id", data.leadId);
    const now = new Date();
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    if (data.filter === "today") {
      q = q.is("completed_at", null).gte("due_at", now.toISOString()).lte("due_at", endOfToday.toISOString());
    } else if (data.filter === "overdue") {
      q = q.is("completed_at", null).lt("due_at", now.toISOString());
    } else if (data.filter === "upcoming") {
      q = q.is("completed_at", null).gt("due_at", endOfToday.toISOString());
    } else if (data.filter === "completed") {
      q = q.not("completed_at", "is", null);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tasks: rows ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().min(1).max(200),
      notes: z.string().max(2000).optional(),
      due_at: z.string().datetime().optional(),
      priority: z.number().int().min(1).max(3).default(2),
      lead_id: z.string().uuid().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("tasks").insert({
      user_id: context.userId,
      title: data.title,
      notes: data.notes ?? null,
      due_at: data.due_at ?? null,
      priority: data.priority,
      lead_id: data.lead_id ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return { task: row };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), completed: z.boolean() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks")
      .update({ completed_at: data.completed ? new Date().toISOString() : null })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const snoozeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), hours: z.number().int().min(1).max(720) }).parse)
  .handler(async ({ data, context }) => {
    const newDue = new Date(Date.now() + data.hours * 3600_000).toISOString();
    const { error } = await context.supabase.from("tasks")
      .update({ due_at: newDue })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, due_at: newDue };
  });
