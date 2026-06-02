import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSafeDomain, assertSafeUrl } from "./url-guard";
import { playwrightScrape } from "./playwright.service";

function domainFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function compact(md: string, max = 900): string {
  return md.replace(/\s+/g, " ").trim().slice(0, max);
}

function lines(md: string): string[] {
  return md
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter((l) => l.length > 12 && l.length < 220);
}

function inferSize(md: string): string | null {
  const m = md.match(/\b(\d{1,4}(?:,\d{3})*)\+?\s+(employees|people|team members|customers|stores|locations)\b/i);
  return m ? `${m[1]} ${m[2]}` : null;
}

function inferIndustry(md: string): string | null {
  const haystack = md.split("\n").slice(0, 50).join(" ").toLowerCase();
  const taxonomies = [
    "agency",
    "biotech",
    "consulting",
    "ecommerce",
    "edtech",
    "fintech",
    "healthtech",
    "hardware",
    "logistics",
    "marketplace",
    "media",
    "real estate",
    "saas",
  ];
  return taxonomies.find((t) => haystack.includes(t)) ?? null;
}

function inferSignals(md: string): string[] {
  const candidates = lines(md);
  const patterns = [
    /hiring|we're hiring|join our team|open roles/i,
    /case stud|customer|trusted by|clients include/i,
    /funding|series [abc]|raised|backed by/i,
    /launch|new product|expanding|growth|scale/i,
    /integrations?|automation|manual|workflow|operations/i,
  ];
  return candidates.filter((line) => patterns.some((p) => p.test(line))).slice(0, 8);
}

async function scrapeCompanyPages(domain: string) {
  const paths = ["", "/about", "/customers", "/case-studies", "/careers"];
  const pages: Array<{ url: string; title?: string; markdown: string }> = [];
  for (const path of paths) {
    try {
      const url = `https://${domain}${path}`;
      const scrape = await playwrightScrape(url);
      if (scrape.markdown) {
        pages.push({ url, title: scrape.title, markdown: scrape.markdown });
      }
    } catch {
      /* Some company subpages won't exist. */
    }
  }
  return pages;
}

export const enrichLeadCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, company, email, enrichment")
      .eq("id", data.leadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!lead) throw new Error("Lead not found");

    const existing = (lead.enrichment ?? {}) as Record<string, unknown>;
    const rawDomain = String(existing.domain || domainFromEmail(lead.email) || "");
    if (!rawDomain) throw new Error("No company domain on lead");
    const domain = assertSafeDomain(rawDomain);

    const pages = await scrapeCompanyPages(domain);
    if (!pages.length) throw new Error("Could not enrich company website");

    const combined = pages.map((p) => `# ${p.title ?? p.url}\n${p.markdown}`).join("\n\n").slice(0, 12000);
    const existingTitle = typeof existing.title === "string" ? existing.title : null;
    const enrichment = {
      ...existing,
      domain,
      title: pages[0]?.title ?? existingTitle,
      industry: inferIndustry(combined),
      size_hint: inferSize(combined),
      summary: compact(combined, 900),
      signals: inferSignals(combined),
      pages: pages.map((p) => ({ url: p.url, title: p.title ?? null })).slice(0, 5),
      scraped_at: new Date().toISOString(),
    };

    await context.supabase.from("leads").update({ enrichment }).eq("id", lead.id);
    return { ok: true, enrichment };
  });

export const enrichLeadLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, linkedin_url")
      .eq("id", data.leadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!lead?.linkedin_url) throw new Error("No LinkedIn URL on lead");

    const u = assertSafeUrl(lead.linkedin_url, ["linkedin.com"]);
    if (!/^\/(in|company|pub)\//i.test(u.pathname)) {
      throw new Error("Invalid LinkedIn URL");
    }

    const scrape = await playwrightScrape(u.toString());
    const md = scrape.markdown ?? "";
    const cleanLines = lines(md);
    const headline = cleanLines[0] ?? scrape.title ?? null;
    const about = cleanLines.find((l) => l.length > 80) ?? null;
    const recentPost = cleanLines.find((l) => l.length > 60 && l.length < 280) ?? null;
    const snapshot = {
      headline,
      about,
      recent_post: recentPost,
      signals: inferSignals(md),
      scraped_at: new Date().toISOString(),
    };
    await context.supabase.from("leads").update({ linkedin_snapshot: snapshot }).eq("id", lead.id);
    return { ok: true, snapshot };
  });
