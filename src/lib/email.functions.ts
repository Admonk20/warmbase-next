import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKey } from "./ai.server";
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
      service: z.string().min(1).max(400),
      research: z.string().max(4000).optional(),
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
    const { lead, service, research, sender } = data;
    const stage = (lead.status as keyof typeof STAGE_CONTEXT) ?? "new";
    const sx = STAGE_CONTEXT[stage] ?? STAGE_CONTEXT.new;
    const firstName = (lead.contact ?? "there").split(" ")[0];

    const sys = `You are an elite cold email copywriter. Write a personalized email under 100 words. Plain text only, no markdown.`;
    const prompt = `Write a cold email.
Lead: ${lead.contact ?? "?"} — ${lead.title ?? "?"} at ${lead.company ?? "?"} (${lead.niche ?? "?"})
Notes: ${lead.notes ?? "—"}
Research: ${research ?? "—"}

Sender: ${sender?.yourName ?? "Your Name"}${sender?.yourCompany ? ", " + sender.yourCompany : ""}${sender?.yourTitle ? " (" + sender.yourTitle + ")" : ""}
Offer: ${service}

Stage: ${stage}
Goal: ${sx.goal}
Tone: ${sx.tone}
CTA: ${sx.cta}

Address them as ${firstName}.

Return JSON: { "subject": "...", "body": "..." }`;

    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const text = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      json: true,
      temperature: 0.8,
    });
    try {
      const parsed = JSON.parse(text);
      return { subject: String(parsed.subject ?? ""), body: String(parsed.body ?? "") };
    } catch {
      return { subject: "", body: text };
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
    const firstName = (data.lead?.contact ?? "").split(" ")[0];
    const sys = `You are an expert cold email copywriter. Return JSON: {"subjects": ["...","...","...","...","..."]}. Each subject under 50 chars, punchy, no clickbait, no emojis.`;
    const prompt = `Email body:\n${data.body}\n\nGenerate 5 alternative subject lines. Lead: ${firstName} at ${data.lead?.company ?? ""}.`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
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

const OBJECTION_STRATEGIES: Record<string, string> = {
  price: "Don't drop price. Reframe value over cost, mention ROI, offer smaller starting scope. Stay confident.",
  timing: "Acknowledge timing, give one reason why now is better, offer to reconnect at specific future date.",
  competitor: "Don't trash competitor. Acknowledge current solution, mention one specific gap, ask a curious question.",
  interest: "Move them to next step fast: suggest specific time or answer their question in one paragraph.",
  not_interested: "Respect it. Very short, gracious. No pitch. Leave door open.",
  neutral: "Keep conversation alive: ask one specific question about their situation.",
};

function detectObjection(t: string) {
  const s = t.toLowerCase();
  if (/not interested|remove me|unsubscribe|stop emailing/.test(s)) return "not_interested";
  if (/already use|working with|current (vendor|provider|agency|tool)/.test(s)) return "competitor";
  if (/too (expensive|costly|much)|budget|can.?t afford|pricing/.test(s)) return "price";
  if (/not (the )?right time|bad timing|busy|next quarter|circle back/.test(s)) return "timing";
  if (/interested|tell me more|sounds good|how does|let.?s chat|schedule|call|demo/.test(s)) return "interest";
  return "neutral";
}

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
    const obj = detectObjection(data.inboundEmail);
    const strategy = OBJECTION_STRATEGIES[obj];
    const sys = `You are an elite sales reply writer. Plain text. Under 80 words. No markdown.`;
    const prompt = `Detected objection: ${obj}\nStrategy: ${strategy}\n\nLead: ${data.lead?.contact ?? ""} at ${data.lead?.company ?? ""}\nTheir email:\n${data.inboundEmail}\n\nFrom: ${data.yourName ?? "You"}\n\nWrite the reply.`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const body = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      temperature: 0.7,
    });
    return { body, objection: obj };
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
        niche: z.string().optional(),
      })).min(1).max(50),
      offer: z.string().max(400).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const leadList = data.leads.map((l, i) =>
      `${i + 1}. id=${l.id} ${l.contact ?? "?"} — ${l.title ?? "?"} at ${l.company ?? "?"} (${l.niche ?? "?"})`,
    ).join("\n");
    const sys = `Return JSON: {"openers": [{"id":"...","opener":"..."}, ...]}. Each opener is one sentence, specific, no generic flattery.`;
    const prompt = `Offer: ${data.offer ?? "B2B services"}\n\nLeads:\n${leadList}\n\nWrite one personalized opening line for each lead.`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      json: true,
    });
    try {
      const parsed = JSON.parse(out);
      return { openers: parsed.openers ?? [] };
    } catch {
      return { openers: [] };
    }
  });

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const DISPOSABLE = new Set(["mailinator.com","10minutemail.com","guerrillamail.com","tempmail.com","trashmail.com","yopmail.com"]);

export const verifyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().min(3).max(255) }).parse)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { email, valid: false, reason: "Invalid format", mx: false };
    const domain = email.split("@")[1];
    if (DISPOSABLE.has(domain)) return { email, valid: false, reason: "Disposable domain", mx: false };
    // DNS-over-HTTPS for MX lookup (Cloudflare worker compatible)
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
        headers: { Accept: "application/dns-json" },
      });
      const j = await res.json() as { Answer?: { data: string }[]; Status?: number };
      const hasMx = !!j.Answer?.length;
      return { email, valid: hasMx, reason: hasMx ? "OK" : "No MX records", mx: hasMx, records: j.Answer?.map((a) => a.data) ?? [] };
    } catch {
      return { email, valid: false, reason: "DNS lookup failed", mx: false };
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
      campaignId: z.string().uuid().optional(),
      fromName: z.string().max(120).optional(),
      fromEmail: z.string().email().max(255).optional(),
      ignoreSendWindow: z.boolean().optional(),
      trackLinks: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const to = data.to.toLowerCase();

    // 1. Suppression check (unsubscribes + global suppressions list)
    const [{ data: unsub }, { data: suppressed }] = await Promise.all([
      context.supabase.from("unsubscribes")
        .select("id").eq("user_id", context.userId).eq("email", to).maybeSingle(),
      context.supabase.from("suppressions")
        .select("id, reason").eq("user_id", context.userId).eq("email", to).maybeSingle(),
    ]);
    if (unsub || suppressed) {
      const reason = unsub ? "unsubscribed" : (suppressed?.reason ?? "suppressed");
      await context.supabase.from("email_events").insert({
        user_id: context.userId,
        lead_id: data.leadId ?? null,
        campaign_id: data.campaignId ?? null,
        event_type: "failed",
        subject: data.subject,
        metadata: { to, reason },
      });
      throw new Error(`${to} is on the suppression list (${reason}).`);
    }

    // 1b. Reply-aware pause + send-window check
    if (data.leadId) {
      const { data: lead } = await context.supabase.from("leads")
        .select("sequence_paused, replied_at, timezone, best_send_hour")
        .eq("id", data.leadId).maybeSingle();
      if (lead?.sequence_paused || lead?.replied_at) {
        throw new Error("Lead has replied or sequence is paused — auto-skipping.");
      }
      if (!data.ignoreSendWindow) {
        const { data: prefs } = await context.supabase.from("user_send_preferences")
          .select("*").eq("user_id", context.userId).maybeSingle();
        const { sendabilityCheck } = await import("./send-timing.server");
        const check = sendabilityCheck({
          prefs: prefs ?? null,
          leadTimezone: lead?.timezone ?? null,
          leadBestHour: lead?.best_send_hour ?? null,
        });
        if (!check.allowed) {
          throw new Error(`Outside sending window (${check.reason}). Set ignoreSendWindow to override.`);
        }
      }
    }



    // 2. Provider: prefer per-user SMTP, fall back to Resend.
    const { data: smtpRow } = await context.supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Reset daily counter if needed
    if (smtpRow) {
      const today = new Date().toISOString().slice(0, 10);
      if (smtpRow.last_reset_date !== today) {
        const newDay = smtpRow.warmup_enabled ? (smtpRow.warmup_day ?? 0) + 1 : smtpRow.warmup_day ?? 0;
        await context.supabase.from("user_smtp_settings").update({
          sent_today: 0, last_reset_date: today, warmup_day: newDay,
        }).eq("user_id", context.userId);
        smtpRow.sent_today = 0;
        smtpRow.warmup_day = newDay;
      }
      const { warmupCap } = await import("./smtp.server");
      const cap = smtpRow.warmup_enabled
        ? warmupCap(smtpRow.warmup_day ?? 0, smtpRow.daily_cap ?? 50)
        : (smtpRow.daily_cap ?? 50);
      if ((smtpRow.sent_today ?? 0) >= cap) {
        throw new Error(`Daily sending cap reached (${cap}). Resets at midnight.`);
      }
    }

    // 3. Build tracked body
    const messageId = newMessageId();
    const unsubToken = newUnsubToken(context.userId, to);
    await context.supabase
      .from("email_unsub_tokens")
      .insert({ token: unsubToken, user_id: context.userId, email: to });

    const baseUrl = getAppBaseUrl();

    // Optional link rewriting
    let workingBody = data.body;
    if (data.trackLinks !== false) {
      const urlRe = /\bhttps?:\/\/[^\s<>"')]+/g;
      const inserts: Array<{ user_id: string; token: string; target_url: string; lead_id: string | null; campaign_id: string | null }> = [];
      workingBody = data.body.replace(urlRe, (url) => {
        if (url.includes("/api/public/track/") || url.includes("/api/public/unsubscribe") || url.includes("/api/public/t/")) return url;
        const token = Array.from(crypto.getRandomValues(new Uint8Array(9))).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
        inserts.push({
          user_id: context.userId, token, target_url: url,
          lead_id: data.leadId ?? null, campaign_id: data.campaignId ?? null,
        });
        return `${baseUrl}/api/public/t/${token}`;
      });
      if (inserts.length > 0) {
        await context.supabase.from("tracked_links").insert(inserts);
      }
    }

    const htmlBase = htmlFromText(workingBody);
    const html = wrapBody({ body: htmlBase, isHtml: true, baseUrl, messageId, unsubToken });
    const text = wrapBody({ body: workingBody, isHtml: false, baseUrl, messageId, unsubToken });
    const listUnsub = `<${baseUrl}/api/public/unsubscribe?t=${unsubToken}>`;


    let providerId: string | null = null;
    let provider = "smtp";

    if (smtpRow) {
      const { smtpSend } = await import("./smtp.server");
      try {
        const res = await smtpSend(smtpRow as any, {
          to, subject: data.subject, html, text, messageId,
          headers: { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        providerId = res.id ?? null;
        await context.supabase.from("user_smtp_settings")
          .update({ sent_today: (smtpRow.sent_today ?? 0) + 1 })
          .eq("user_id", context.userId);
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 300);
        await context.supabase.from("email_events").insert({
          user_id: context.userId, lead_id: data.leadId ?? null, campaign_id: data.campaignId ?? null,
          event_type: "failed", subject: data.subject,
          metadata: { to, message_id: messageId, error: msg, provider: "smtp" },
        });
        throw new Error(`SMTP send failed: ${msg}`);
      }
    } else {
      const resendKey = await getUserKey(context.supabase, context.userId, "resend");
      if (!resendKey) {
        throw new Error("No email sender configured. Add SMTP in Settings → SMTP, or add a Resend API key.");
      }
      provider = "resend";
      const fromEmail = data.fromEmail ?? "onboarding@resend.dev";
      const fromName = data.fromName ?? "ColdBase Pro";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`, to: [to], subject: data.subject, html, text,
          headers: { "List-Unsubscribe": listUnsub },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        await context.supabase.from("email_events").insert({
          user_id: context.userId, lead_id: data.leadId ?? null, campaign_id: data.campaignId ?? null,
          event_type: "failed", subject: data.subject,
          metadata: { to, message_id: messageId, error: t.slice(0, 200), status: res.status, provider: "resend" },
        });
        throw new Error(`Email send failed (${res.status}): ${t.slice(0, 200)}`);
      }
      const out = (await res.json()) as { id?: string };
      providerId = out?.id ?? null;
    }

    await context.supabase.from("email_events").insert({
      user_id: context.userId,
      lead_id: data.leadId ?? null,
      campaign_id: data.campaignId ?? null,
      event_type: "sent",
      subject: data.subject,
      metadata: { to, message_id: messageId, provider, provider_id: providerId },
    });

    if (data.campaignId) {
      const { data: camp } = await context.supabase
        .from("campaigns").select("sent_count").eq("id", data.campaignId).maybeSingle();
      if (camp) {
        await context.supabase
          .from("campaigns")
          .update({ sent_count: (camp.sent_count ?? 0) + 1 })
          .eq("id", data.campaignId);
      }
    }
    if (data.leadId) {
      await context.supabase
        .from("leads")
        .update({ last_emailed_at: new Date().toISOString(), status: "contacted" })
        .eq("id", data.leadId);
    }

    return { ok: true, id: providerId, messageId };
  });

