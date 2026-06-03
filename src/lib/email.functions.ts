import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey, getUserKey } from "./ai.server";
import {
  getAppBaseUrl,
  htmlFromText,
  newMessageId,
  newUnsubToken,
  wrapBody,
} from "./email-tracking.server";

const STAGE_CONTEXT: Record<string, { goal: string; tone: string; cta: string }> = {
  new: {
    goal: "First email — they have never heard of you.",
    tone: "Direct and confident. Specific observation about them. No fluff.",
    cta: "Ask for a 15-minute call. One soft question.",
  },
  contacted: {
    goal: "Follow-up after no reply. Reference the previous email briefly.",
    tone: "Shorter, more casual. Add a new angle or data point.",
    cta: "Soft ask. 'Did this get buried?' Keep it one line.",
  },
  engaged: {
    goal: "They replied or engaged. Continue the conversation.",
    tone: "Warm, conversational. Build on what they showed interest in.",
    cta: "Suggest a specific time for a short call.",
  },
  meeting: {
    goal: "Booked a meeting. Confirm + reduce no-show risk.",
    tone: "Confident and brief. Confirm time + send agenda.",
    cta: "One-line confirm.",
  },
  won: {
    goal: "Won client. Onboard or upsell.",
    tone: "Professional, warm. Next-step focused.",
    cta: "Concrete action item.",
  },
};

const researchObjectSchema = z.object({
  summary: z.string().optional(),
  pains: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  personalization_angles: z.array(z.string()).optional(),
  why_this_service: z.string().optional(),
  objection_risk: z.string().optional(),
  confidence: z.string().optional(),
  hook: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});

export const draftEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lead: z.object({
        contact: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        email: z.string().optional(),
        niche: z.string().optional(),
        notes: z.string().optional(),
        status: z.string().optional(),
      }),
      service: z.string().max(400).optional(),
      research: z.union([researchObjectSchema, z.string().max(4000)]).optional(),
      suggestedService: z.string().max(400).optional(),
      sender: z
        .object({
          yourName: z.string().max(120).optional(),
          yourCompany: z.string().max(120).optional(),
          yourTitle: z.string().max(120).optional(),
        })
        .optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { lead, service, research, suggestedService, sender } = data;
    const stage = (lead.status as keyof typeof STAGE_CONTEXT) ?? "new";
    const sx = STAGE_CONTEXT[stage] ?? STAGE_CONTEXT.new;
    const firstName = (lead.contact ?? "there").split(" ")[0];

    const { data: prof } = await context.supabase
      .from("profiles")
      .select("ai_email_instructions")
      .eq("id", context.userId)
      .maybeSingle();
    const customInstructions = ((prof as any)?.ai_email_instructions ?? "").trim();

    const userService = service?.trim();
    const chosenService = userService || suggestedService?.trim() || "";
    const serviceLine = userService
      ? `Pitch THIS service exactly: ${userService}`
      : chosenService
        ? `Pitch this service: ${chosenService}`
        : `Pick the best service for this person.`;

    let researchBlock = "—";
    if (typeof research === "string") {
      researchBlock = research;
    } else if (research && typeof research === "object") {
      const parts: string[] = [];
      if (research.summary) parts.push(`Summary: ${research.summary}`);
      if (research.pains?.length) parts.push(`Pains: ${research.pains.join(", ")}`);
      if (research.opportunities?.length) parts.push(`Opportunities: ${research.opportunities.join(", ")}`);
      if (parts.length) researchBlock = parts.join("\n\n");
    }

    const sys = `You are an elite cold email copywriter for WarmBase. Focus on being human, direct, and under 110 words. No corporate buzzwords.`;
    const prompt = `Write a cold email to ${firstName} at ${lead.company ?? "?"}.\n\nRESEARCH:\n${researchBlock}\n\nSERVICE:\n${serviceLine}\n\nStage: ${stage}\n${customInstructions ? `Instructions: ${customInstructions}` : ""}`;

    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);

    const text = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
      temperature: 0.85,
    });

    try {
      const parsed = JSON.parse(text);
      return {
        subject: String(parsed.subject ?? ""),
        body: String(parsed.body ?? ""),
        service_pitched: String(parsed.service_pitched ?? chosenService),
      };
    } catch {
      return { subject: "", body: text, service_pitched: chosenService };
    }
  });

export const subjectLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      body: z.string().min(1).max(4000),
      lead: z.object({ contact: z.string().optional(), company: z.string().optional() }).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const sys = `Generate 5 alternative subject lines for this cold email. Return JSON: {"subjects": []}`;
    const prompt = `Email body:\n${data.body}`;
    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
      temperature: 0.9,
    });
    try {
      const parsed = JSON.parse(out);
      return { subjects: (parsed.subjects ?? []).slice(0, 5).map(String) };
    } catch {
      return { subjects: [] };
    }
  });

export const draftReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      inboundEmail: z.string().min(1).max(8000),
      lead: z.object({ contact: z.string().optional(), company: z.string().optional() }).optional(),
      yourName: z.string().max(120).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const sys = `Write a professional sales reply. Under 80 words.`;
    const prompt = `Lead email:\n${data.inboundEmail}`;
    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);
    const body = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      kimiKey,
      claudeKey,
      temperature: 0.7,
    });
    return { body };
  });

export const personalizeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leads: z.array(z.object({
        id: z.string(),
        contact: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
      })).min(1).max(50),
      offer: z.string().max(400).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const sys = `Write one personalized opening line for each lead. Return JSON: {"openers": [{"id":"...","opener":"..."}]}`;
    const prompt = `Offer: ${data.offer ?? "B2B services"}\nLeads: ${JSON.stringify(data.leads)}`;
    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
    });
    try {
      const parsed = JSON.parse(out);
      return { openers: parsed.openers ?? [] };
    } catch {
      return { openers: [] };
    }
  });

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      to: z.string().email().max(255),
      subject: z.string().min(1).max(255),
      body: z.string().min(1).max(20000),
      leadId: z.string().uuid().optional(),
      fromName: z.string().max(120).optional(),
      fromEmail: z.string().email().max(255).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: smtpRow } = await context.supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (smtpRow) {
      const { smtpSend } = await import("./smtp.server");
      const res = await smtpSend(smtpRow as any, {
        to: data.to,
        subject: data.subject,
        html: htmlFromText(data.body),
        text: data.body,
        messageId: newMessageId(),
      });
      return { ok: true, id: res.id };
    } else {
      const resendKey = await getUserKey(context.supabase, context.userId, "resend");
      if (!resendKey) throw new Error("No sender configured.");
      
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${data.fromName ?? "WarmBase"} <${data.fromEmail ?? "onboarding@resend.dev"}>`,
          to: [data.to],
          subject: data.subject,
          text: data.body,
        }),
      });
      const out = await res.json() as { id?: string };
      return { ok: true, id: out.id };
    }
  });
