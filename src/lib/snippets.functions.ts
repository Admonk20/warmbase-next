import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("email_snippets")
      .select("*")
      .order("shortcode");
    return data ?? [];
  });

export const upsertSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid().optional(),
    shortcode: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore only"),
    body: z.string().min(1).max(4000),
    description: z.string().max(200).optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("email_snippets").update(row).eq("id", data.id)
      : await context.supabase.from("email_snippets").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await context.supabase.from("email_snippets").delete().eq("id", data.id);
    return { ok: true };
  });
