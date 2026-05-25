import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function firecrawlScrape(url: string): Promise<{ markdown?: string; title?: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Firecrawl API key not configured.");
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const j = (await res.json()) as { data?: { markdown?: string; metadata?: { title?: string } } };
  return { markdown: j.data?.markdown, title: j.data?.metadata?.title };
}

function domainFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function inferSize(md: string): string | null {
  const m = md.match(/\b(\d{1,4}(?:,\d{3})*)\+?\s+(employees|people|team members)\b/i);
  return m ? `${m[1]} ${m[2]}` : null;
}

function inferIndustry(md: string): string | null {
  const lines = md.split("\n").slice(0, 25).join(" ").toLowerCase();
  const taxonomies = ["saas", "fintech", "healthtech", "edtech", "ecommerce", "agency", "consulting", "marketplace", "biotech", "hardware", "logistics", "real estate", "media", "gaming"];
  for (const t of taxonomies) if (lines.includes(t)) return t;
  return null;
}

export const enrichLeadCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase.from("leads")
      .select("id, company, email").eq("id", data.leadId).eq("user_id", context.userId).maybeSingle();
    if (!lead) throw new Error("Lead not found");
    const domain = domainFromEmail(lead.email);
    if (!domain) throw new Error("No company domain on lead");
    const url = `https://${domain}`;
    const scrape = await firecrawlScrape(url);
    const md = scrape.markdown ?? "";
    const summary = md.slice(0, 500);
    const enrichment = {
      domain,
      title: scrape.title ?? null,
      industry: inferIndustry(md),
      size_hint: inferSize(md),
      summary,
      scraped_at: new Date().toISOString(),
    };
    await context.supabase.from("leads").update({ enrichment }).eq("id", lead.id);
    return { ok: true, enrichment };
  });

export const enrichLeadLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase.from("leads")
      .select("id, linkedin_url").eq("id", data.leadId).eq("user_id", context.userId).maybeSingle();
    if (!lead?.linkedin_url) throw new Error("No LinkedIn URL on lead");
    const { assertSafeUrl } = await import("./url-guard");
    const u = assertSafeUrl(lead.linkedin_url, ["linkedin.com"]);
    if (!/^\/(in|company|pub)\//i.test(u.pathname)) {
      throw new Error("Invalid LinkedIn URL");
    }
    const scrape = await firecrawlScrape(u.toString());
    const md = scrape.markdown ?? "";
    const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
    const headline = lines[0] ?? null;
    const recentPost = lines.find((l) => l.length > 60 && l.length < 280) ?? null;
    const snapshot = {
      headline,
      recent_post: recentPost,
      scraped_at: new Date().toISOString(),
    };
    await context.supabase.from("leads").update({ linkedin_snapshot: snapshot }).eq("id", lead.id);
    return { ok: true, snapshot };
  });
