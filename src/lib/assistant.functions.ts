import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey } from "./ai.server";

const SYSTEM_PROMPT = `You are the built-in assistant for ColdBase Pro, a cold email pipeline tool.

You help the user manage their lead pipeline, understand their metrics, draft emails, and answer questions about cold outreach best practices.

The pipeline has 6 stages: new → contacted → engaged → meeting → won (lost = dead deals).
Each lead has: contact, company, title, email, phone, status, niche, notes, value, temperature (cold/warm/hot), seq_step, last_emailed_at.

Be concise. Use plain language. When asked for advice on a specific lead or campaign, reference the actual data the user shares below.`;

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
      const [leadsRes, campRes, evtRes] = await Promise.all([
        context.supabase.from("leads").select("status, temperature, value").limit(500),
        context.supabase.from("campaigns").select("name, status, sent_count, open_count, reply_count, meeting_count").limit(50),
        context.supabase.from("email_events").select("event_type").limit(1000),
      ]);
      const leads = leadsRes.data ?? [];
      const camps = campRes.data ?? [];
      const evts = evtRes.data ?? [];
      const byStatus: Record<string, number> = {};
      for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      const pipeline = leads.reduce((a, l) => a + Number(l.value ?? 0), 0);
      const totalSent = camps.reduce((a, c) => a + (c.sent_count ?? 0), 0);
      const totalReply = camps.reduce((a, c) => a + (c.reply_count ?? 0), 0);
      contextBlock = `\n\nUSER'S PIPELINE SNAPSHOT:\nLeads by status: ${JSON.stringify(byStatus)}\nTotal pipeline value: $${pipeline}\nCampaigns: ${camps.length} (${totalSent} emails sent, ${totalReply} replies)\nRecent events: ${evts.length}\n`;
    }

    const [openaiKey, kimiKey] = await Promise.all([getUserOpenAIKey(context.supabase, context.userId), getUserKimiKey(context.supabase, context.userId)]);
    const reply = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextBlock },
        ...data.messages,
      ],
      openaiKey,
      kimiKey,
      temperature: 0.6,
    });
    return { reply };
  });
