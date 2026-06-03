import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey, getUserKey } from "./ai.server";
import { collectProspectIntel } from "./prospect-intel.server";

type ResearchResult = {
  summary: string;
  pains: string[];
  opportunities: string[];
  personalization_angles: string[];
  suggested_service: string;
  why_this_service: string;
  objection_risk: string;
  score: number;
  confidence: "low" | "medium" | "high";
  hook: string;
  evidence: string[];
};

function list(value: unknown, max = 5): string[] {
  return Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean).slice(0, max) : [];
}

export const researchLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lead: z.object({
        id: z.string().uuid().optional(),
        contact: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        niche: z.string().optional(),
        linkedin_url: z.string().optional(),
        email: z.string().optional(),
      }),
      sender: z
        .object({
          yourName: z.string().optional(),
          yourCompany: z.string().optional(),
          services: z.string().optional(),
        })
        .optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { lead, sender } = data;
    const intel = await collectProspectIntel({
      supabase: context.supabase,
      userId: context.userId,
      lead,
    });
    const intelLead = intel.lead;
    const evidenceBlock = intel.evidence.length
      ? intel.evidence.map((item, i) => `${i + 1}. ${item}`).join("\n")
      : "No external evidence found.";
    const sourcesBlock = intel.searchSignals.length
      ? intel.searchSignals
          .map((s, i) => `${i + 1}. ${s.title} (${s.url})`)
          .join("\n")
      : "No search results.";

    const sys = `You are a senior B2B sales researcher for WarmBase. Focus on discovery for a service provider. Return JSON with summary, pains, opportunities, angles, suggested_service, score (1-10), and hook.`;
    const prompt = `Research lead: ${intelLead.contact} at ${intelLead.company}.\nIntel: ${evidenceBlock}\nSignals: ${sourcesBlock}`;

    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);

    const out = await chatCompletion({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
      temperature: 0.35,
    });

    try {
      const parsed = JSON.parse(out) as Partial<ResearchResult>;
      return {
        summary: String(parsed.summary ?? ""),
        pains: list(parsed.pains),
        opportunities: list(parsed.opportunities),
        personalization_angles: list(parsed.personalization_angles),
        suggested_service: String(parsed.suggested_service ?? ""),
        why_this_service: String(parsed.why_this_service ?? ""),
        objection_risk: String(parsed.objection_risk ?? ""),
        score: Math.max(1, Math.min(10, Number(parsed.score ?? 5))),
        confidence: "medium",
        hook: String(parsed.hook ?? ""),
        evidence: list(parsed.evidence, 6),
      } satisfies ResearchResult;
    } catch {
      return {
        summary: out,
        pains: [], opportunities: [], personalization_angles: [],
        suggested_service: "", why_this_service: "", objection_risk: "",
        score: 5, confidence: "low", hook: "", evidence: intel.evidence.slice(0, 6),
      } satisfies ResearchResult;
    }
  });

export const serperSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().max(120).optional(),
      industry: z.string().max(120).optional(),
      location: z.string().max(120).optional(),
      keywords: z.string().max(200).optional(),
      page: z.number().int().min(1).max(10).default(1),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const serperKey = await getUserKey(context.supabase, context.userId, "serper");
    const liQuery = [`site:linkedin.com/in`, data.title, data.industry, data.location, data.keywords].filter(Boolean).join(" ");

    if (!serperKey) return { provider: "manual", results: [], urls: { google: `https://www.google.com/search?q=${encodeURIComponent(liQuery)}` } };

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: liQuery, page: data.page }),
    });
    const j = (await res.json()) as { organic?: any[] };
    return { provider: "serper", results: (j.organic ?? []).slice(0, 20) };
  });

export const enrichCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ domain: z.string().optional(), name: z.string().optional() }).parse)
  .handler(async ({ data }) => {
    return { name: data.name ?? "", domain: data.domain ?? "", found: false };
  });

export const hunterSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ action: z.string(), domain: z.string().optional(), email: z.string().optional() }).parse)
  .handler(async ({ data, context }) => {
    const key = await getUserKey(context.supabase, context.userId, "hunter");
    if (!key) throw new Error("Hunter key required.");
    return { raw: "{}" };
  });

export const cleanLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leads: z.array(z.record(z.string(), z.unknown())) }).parse)
  .handler(async ({ data, context }) => {
    const [openaiKey, kimiKey, claudeKey] = await Promise.all([
      getUserOpenAIKey(context.supabase, context.userId),
      getUserKimiKey(context.supabase, context.userId),
      getUserClaudeKey(context.supabase, context.userId),
    ]);
    const out = await chatCompletion({
      messages: [{ role: "system", content: "Clean these leads." }, { role: "user", content: JSON.stringify(data.leads) }],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
    });
    return { result: out };
  });
