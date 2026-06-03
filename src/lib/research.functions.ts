import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const researchLeadInternal = async ({ data, context }: {
  data: {
    lead: {
      id?: string;
      contact?: string;
      company?: string;
      title?: string;
      niche?: string;
      linkedin_url?: string;
      email?: string;
    };
    sender?: {
      yourName?: string;
      yourCompany?: string;
      services?: string;
    };
  },
  context: { supabase: any, userId: string }
}) => {
  const { lead, sender } = data;
  const { collectProspectIntel } = await import("./prospect-intel.server");
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

  const { chatWithUserKeys } = await import("./ai-wrapper.server");
  const out = await chatWithUserKeys({
    supabase: context.supabase,
    userId: context.userId,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
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
      confidence: "medium" as const,
      hook: String(parsed.hook ?? ""),
      evidence: list(parsed.evidence, 6),
    } satisfies ResearchResult;
  } catch {
    return {
      summary: out,
      pains: [], opportunities: [], personalization_angles: [],
      suggested_service: "", why_this_service: "", objection_risk: "",
      score: 5, confidence: "low" as const, hook: "", evidence: intel.evidence.slice(0, 6),
    } satisfies ResearchResult;
  }
};

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
    return researchLeadInternal({ data, context });
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
  .handler(async ({ data }) => {
    const liQuery = [`site:linkedin.com/in`, data.title, data.industry, data.location, data.keywords].filter(Boolean).join(" ");
    return {
      provider: "playwright",
      results: [],
      urls: { google: `https://www.google.com/search?q=${encodeURIComponent(liQuery)}` },
      note: "Serper is disabled. Internet search is handled by Playwright-based sourcing.",
    };
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
  .handler(async () => {
    return { raw: "{}", provider: "disabled", note: "Hunter is disabled in Playwright-first mode." };
  });

export const cleanLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leads: z.array(z.record(z.string(), z.unknown())) }).parse)
  .handler(async ({ data, context }) => {
    const { chatWithUserKeys } = await import("./ai-wrapper.server");
    const out = await chatWithUserKeys({
      supabase: context.supabase,
      userId: context.userId,
      messages: [{ role: "system", content: "Clean these leads." }, { role: "user", content: JSON.stringify(data.leads) }],
      json: true,
    });
    return { result: out };
  });
