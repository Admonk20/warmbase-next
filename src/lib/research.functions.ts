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
    const sys = `You are a B2B sales researcher. Return JSON: {"summary": "3-4 sentences about company + person", "suggested_service": "best matching service from sender's offer", "score": 1-10, "hook": "one specific personalization angle"}.`;
    const prompt = `Lead: ${lead.contact ?? "?"} — ${lead.title ?? "?"} at ${lead.company ?? "?"} (${lead.niche ?? "?"})${lead.linkedin_url ? ` LinkedIn: ${lead.linkedin_url}` : ""}\n\nSender services: ${sender?.services ?? "AI automation, web/app development"}\nSender: ${sender?.yourName ?? "Sales rep"} at ${sender?.yourCompany ?? ""}\n\nResearch them and recommend the best angle. Use general industry knowledge.`;
    const openaiKey = await getUserOpenAIKey(context.supabase, context.userId);
    const out = await chatCompletion({
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      openaiKey,
      json: true,
      temperature: 0.5,
    });
    type ResearchResult = { summary: string; suggested_service: string; score: number; hook: string };
    try {
      const parsed = JSON.parse(out) as Partial<ResearchResult>;
      return {
        summary: String(parsed.summary ?? ""),
        suggested_service: String(parsed.suggested_service ?? ""),
        score: Number(parsed.score ?? 5),
        hook: String(parsed.hook ?? ""),
      } satisfies ResearchResult;
    } catch {
      return { summary: out, suggested_service: "", score: 5, hook: "" };
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
