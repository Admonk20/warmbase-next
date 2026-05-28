import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey } from "./ai.server";
import { recomputeLeadScore, recomputeAllScores } from "./scoring.server";

export const recomputeScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const n = await recomputeAllScores(context.supabase, context.userId);
    return { ok: true, leads: n };
  });

export const recomputeOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const s = await recomputeLeadScore(context.supabase, data.leadId);
    return { ok: true, score: s };
  });

const REPLY_LABELS = ["interested","not_now","unsubscribe","ooo","wrong_person","question","neutral"] as const;

export const classifyReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    body: z.string().min(1).max(8000),
    leadId: z.string().uuid().optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const sys = `Classify the email reply. Return JSON: {"label":"<one of: ${REPLY_LABELS.join(", ")}>", "summary":"<10 words>"}.`;
    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: data.body }],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
      temperature: 0.1,
    });
    let label = "neutral";
    let summary = "";
    try {
      const parsed = JSON.parse(out);
      label = (REPLY_LABELS as readonly string[]).includes(parsed.label) ? parsed.label : "neutral";
      summary = String(parsed.summary ?? "").slice(0, 200);
    } catch { /* keep defaults */ }

    if (data.leadId) {
      await context.supabase.from("email_events").insert({
        user_id: context.userId,
        lead_id: data.leadId,
        event_type: "replied",
        subject: summary || "Reply received",
        reason: label,
        metadata: { classified: true },
      });
      const statusMap: Record<string, string> = {
        interested: "engaged",
        unsubscribe: "lost",
        wrong_person: "lost",
        not_now: "contacted",
      };
      if (statusMap[label]) {
        await context.supabase.from("leads").update({ status: statusMap[label] as any }).eq("id", data.leadId);
      }
      if (label === "unsubscribe") {
        const { data: lead } = await context.supabase.from("leads").select("email").eq("id", data.leadId).maybeSingle();
        if (lead?.email) {
          await context.supabase.from("unsubscribes").insert({
            user_id: context.userId, email: lead.email.toLowerCase(), reason: "reply-classified",
          });
        }
      }
      await recomputeLeadScore(context.supabase, data.leadId);
    }
    return { label, summary };
  });
