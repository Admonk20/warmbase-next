import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey } from "./ai.server";

const SYSTEM_PROMPT = `You are the built-in assistant for WarmBase, an autonomous cold email system.
You help the user manage their pipeline, understand metrics, and draft emails.
Be concise. Use plain language.`;

export const chat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })).min(1).max(40),
      includeContext: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    let contextBlock = "";
    if (data.includeContext) {
      const [leadsRes, campRes] = await Promise.all([
        context.supabase.from("leads").select("status, value").limit(500),
        context.supabase.from("campaigns").select("name, sent_count, reply_count").limit(50),
      ]);
      const leads = leadsRes.data ?? [];
      const camps = campRes.data ?? [];
      const byStatus: Record<string, number> = {};
      for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      contextBlock = `\n\nPIPELINE: ${JSON.stringify(byStatus)}\nCampaigns: ${camps.length}\n`;
    }

    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);

    const reply = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextBlock },
        ...data.messages,
      ],
      openaiKey,
      kimiKey,
      claudeKey,
      temperature: 0.6,
    });
    return { reply };
  });
