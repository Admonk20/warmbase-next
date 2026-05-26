import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKey } from "./ai.server";

export const researchLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lead: z.object({
        contact: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        niche: z.string().optional(),
        linkedin_url: z.string().optional(),
        email: z.string().optional(),
      }),
      sender: z.object({
        yourName: z.string().optional(),
        yourCompany: z.string().optional(),
        services: z.string().optional(),
      }).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { lead, sender } = data;
    const sys = `You are a senior B2B sales researcher doing DEEP discovery on a single prospect for a SERVICE PROVIDER (a consultant, agency, or specialist who personally delivers done-for-you work). The sender is NOT selling software, a SaaS product, an app, a platform, or a tool. Every recommendation must be a SERVICE the sender can personally deliver for this prospect — never a product they buy or install.

Be thorough, specific, and grounded — no fluff, no generic flattery. Infer everything you can from the title, company name, industry, and any signals. If the sender did NOT specify a service, YOU must determine the single best done-for-you service to pitch this person based on their likely pains, role, and industry maturity.

Write at a grade 9 reading level — clear, professional, natural. No corporate buzzwords ("leverage", "synergy", "unlock", "streamline", "solutions"). No "app", "platform", "tool", "software", or "product" language.

Return JSON with this exact shape:
{
  "summary": "6-8 sentences. Cover: what the company likely does, stage/size signals, what this person owns in their role, 2-3 specific pains they probably face right now, and one industry trend hitting them.",
  "pains": ["specific pain 1", "specific pain 2", "specific pain 3"],
  "opportunities": ["concrete opportunity 1", "concrete opportunity 2"],
  "suggested_service": "The single best done-for-you SERVICE to offer — phrased as work the sender performs for the client (e.g. 'Outbound lead generation managed for you', 'Fractional Head of Growth engagement', 'LinkedIn ghostwriting for the founder'). Never a product, app, or tool.",
  "why_this_service": "1-2 sentences explaining WHY this service fits this person right now.",
  "score": 1-10,
  "hook": "One specific, human personalization angle written at a grade 9 level — no jargon, no buzzwords."
}`;
    const senderServices = sender?.services?.trim();
    const prompt = `PROSPECT
Name: ${lead.contact ?? "?"}
Title: ${lead.title ?? "?"}
Company: ${lead.company ?? "?"}
Industry/Niche: ${lead.niche ?? "?"}
LinkedIn: ${lead.linkedin_url ?? "—"}
Email: ${lead.email ?? "—"}

SENDER
${sender?.yourName ? `Name: ${sender.yourName}` : ""}
${sender?.yourCompany ? `Company: ${sender.yourCompany}` : ""}
Services on offer: ${senderServices ? senderServices : "NOT SPECIFIED — you decide the best single service to pitch this person."}

Do the deep research now. Be specific to THIS person and company, not generic.`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      json: true,
      temperature: 0.4,
    });
    type ResearchResult = {
      summary: string;
      pains: string[];
      opportunities: string[];
      suggested_service: string;
      why_this_service: string;
      score: number;
      hook: string;
    };
    try {
      const parsed = JSON.parse(out) as Partial<ResearchResult>;
      return {
        summary: String(parsed.summary ?? ""),
        pains: Array.isArray(parsed.pains) ? parsed.pains.map(String).slice(0, 5) : [],
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String).slice(0, 5) : [],
        suggested_service: String(parsed.suggested_service ?? ""),
        why_this_service: String(parsed.why_this_service ?? ""),
        score: Number(parsed.score ?? 5),
        hook: String(parsed.hook ?? ""),
      } satisfies ResearchResult;
    } catch {
      return { summary: out, pains: [], opportunities: [], suggested_service: "", why_this_service: "", score: 5, hook: "" };
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

    const liQuery = [
      `site:linkedin.com/in`,
      data.title ? `"${data.title}"` : "",
      data.industry ? `"${data.industry}"` : "",
      data.location ? `"${data.location}"` : "",
      data.keywords ?? "",
    ].filter(Boolean).join(" ");

    if (!serperKey) {
      return {
        provider: "manual",
        results: [],
        urls: {
          linkedin: `https://www.google.com/search?q=${encodeURIComponent(liQuery)}`,
          google: `https://www.google.com/search?q=${encodeURIComponent(liQuery)}`,
        },
        note: "Add a Serper.dev API key in Settings to enable live results.",
      };
    }

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: liQuery, page: data.page }),
    });
    const j = await res.json() as { organic?: { title: string; link: string; snippet: string }[] };
    return { provider: "serper", results: (j.organic ?? []).slice(0, 20) };
  });

export const enrichCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ domain: z.string().max(255).optional(), name: z.string().max(255).optional() }).parse,
  )
  .handler(async ({ data }) => {
    const query = data.name || data.domain;
    if (!query) throw new Error("domain or name required");

    let name = "";
    let domain = data.domain ?? "";
    let logo = "";
    let description = "";
    let found = false;

    // Clearbit autocomplete (free, no key)
    try {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
      const arr = (await res.json()) as { name: string; domain: string; logo: string }[];
      if (arr.length) {
        name = arr[0].name;
        domain = arr[0].domain;
        logo = arr[0].logo;
        found = true;
      }
    } catch {}

    // Try to fetch site meta if we have a public domain
    if (domain) {
      try {
        const { assertSafeDomain } = await import("./url-guard");
        const safe = assertSafeDomain(domain);
        const res = await fetch(`https://${safe}`, { signal: AbortSignal.timeout(5000) });
        const html = await res.text();
        const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
        const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]?.trim();
        const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1]?.trim();
        if (title && !name) name = title;
        description = desc ?? ogDesc ?? "";
      } catch {}
    }

    return { name, domain, logo, description, found };
  });

export const hunterSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      action: z.enum(["domain-search", "email-finder", "email-verifier"]),
      domain: z.string().max(255).optional(),
      firstName: z.string().max(120).optional(),
      lastName: z.string().max(120).optional(),
      email: z.string().max(255).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const key = await getUserKey(context.supabase, context.userId, "hunter");
    if (!key) throw new Error("Hunter.io API key required. Add one in Settings → API Keys.");

    const BASE = "https://api.hunter.io/v2";
    let url = "";
    switch (data.action) {
      case "domain-search":
        url = `${BASE}/domain-search?domain=${encodeURIComponent(data.domain ?? "")}&limit=10`; break;
      case "email-finder":
        url = `${BASE}/email-finder?domain=${encodeURIComponent(data.domain ?? "")}&first_name=${encodeURIComponent(data.firstName ?? "")}&last_name=${encodeURIComponent(data.lastName ?? "")}`; break;
      case "email-verifier":
        url = `${BASE}/email-verifier?email=${encodeURIComponent(data.email ?? "")}`; break;
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const json = await res.text();
    return { raw: json };
  });

export const cleanLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leads: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const sys = `You are a CRM data cleaner. Fix names (proper case), normalize titles (CEO, Founder, VP Sales…), clean company names (drop Inc/LLC if redundant), dedupe by person+company, drop junk entries, flag low-confidence. Return JSON: {"leads": [{...}], "removed": n, "notes": "..."}.`;
    const prompt = `Clean these leads:\n${JSON.stringify(data.leads).slice(0, 10000)}`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      json: true,
      temperature: 0.2,
    });
    return { result: out };
  });
