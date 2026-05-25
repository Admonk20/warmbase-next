import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A/B subject line testing helpers. Tracks sends/opens/replies per variant
// and auto-promotes a winner once min sample size is reached and one variant
// beats the other by >= 20% on the chosen metric (default: open rate).

const MIN_SAMPLE = 20;
const WIN_MARGIN = 0.2;

export const recordAbSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ testId: z.string().uuid(), variant: z.enum(["a", "b"]) }).parse)
  .handler(async ({ data, context }) => {
    const col = data.variant === "a" ? "sends_a" : "sends_b";
    const { data: row } = await context.supabase
      .from("ab_tests").select(col).eq("id", data.testId).maybeSingle();
    if (!row) throw new Error("test not found");
    const patch: Record<string, number> = { [col]: ((row as any)[col] ?? 0) + 1 };
    await context.supabase.from("ab_tests").update(patch as never).eq("id", data.testId);
    return { ok: true };
  });

export const evaluateAbWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ testId: z.string().uuid(), metric: z.enum(["opens", "replies"]).default("opens") }).parse)
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("ab_tests").select("*").eq("id", data.testId).maybeSingle();
    if (!t) throw new Error("test not found");
    if (t.winner) return { winner: t.winner, reason: "already set" };
    const sa = t.sends_a ?? 0, sb = t.sends_b ?? 0;
    if (sa < MIN_SAMPLE || sb < MIN_SAMPLE) return { winner: null, reason: `need ${MIN_SAMPLE} sends per variant` };
    const num = data.metric === "opens"
      ? [(t.opens_a ?? 0) / sa, (t.opens_b ?? 0) / sb]
      : [(t.replies_a ?? 0) / sa, (t.replies_b ?? 0) / sb];
    const [ra, rb] = num;
    let winner: "a" | "b" | null = null;
    if (ra > rb * (1 + WIN_MARGIN)) winner = "a";
    else if (rb > ra * (1 + WIN_MARGIN)) winner = "b";
    if (winner) {
      await context.supabase.from("ab_tests").update({ winner }).eq("id", data.testId);
    }
    return { winner, rates: { a: ra, b: rb }, reason: winner ? "promoted" : "no clear winner" };
  });

export const createAbTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    name: z.string().min(1).max(120),
    variant_a: z.string().min(1).max(255),
    variant_b: z.string().min(1).max(255),
  }).parse)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("ab_tests")
      .insert({ user_id: context.userId, ...data })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
