import { assertSafeDomain } from "./url-guard";
import { getUserKey } from "./ai.server";

type SupabaseLike = { from: (table: string) => any };

const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
]);

export type SearchSignal = {
  title: string;
  url: string;
  snippet: string;
};

export type ProspectIntel = {
  lead: Record<string, unknown>;
  companyDomain?: string;
  evidence: string[];
  searchSignals: SearchSignal[];
  enrichment: Record<string, unknown>;
  linkedinSnapshot: Record<string, unknown>;
};

function domainFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function shortText(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function addEvidence(evidence: string[], label: string, value: unknown, max = 260) {
  const text = shortText(value, max);
  if (text) evidence.push(`${label}: ${text}`);
}

async function serperSearch(
  supabase: SupabaseLike,
  userId: string,
  query: string,
): Promise<SearchSignal[]> {
  const key = await getUserKey(supabase, userId, "serper");
  if (!key) return [];

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 6 }),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (json.organic ?? [])
    .filter((r) => r.link && r.title)
    .slice(0, 6)
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: r.snippet ?? "",
    }));
}

function buildQueries(lead: Record<string, unknown>, domain?: string): string[] {
  const contact = shortText(lead.contact, 120);
  const company = shortText(lead.company, 120);
  const title = shortText(lead.title, 120);
  const niche = shortText(lead.niche, 120);

  const queries = [
    [contact, company, title].filter(Boolean).join(" "),
    [company, niche, "growth hiring funding customers"].filter(Boolean).join(" "),
    domain ? `site:${domain} (about OR customers OR case studies OR careers OR blog)` : "",
    contact && company ? `"${contact}" "${company}"` : "",
  ];

  return Array.from(new Set(queries.map((q) => q.trim()).filter((q) => q.length > 6))).slice(0, 3);
}

export async function collectProspectIntel({
  supabase,
  userId,
  lead,
}: {
  supabase: SupabaseLike;
  userId: string;
  lead: Record<string, unknown>;
}): Promise<ProspectIntel> {
  let dbLead: Record<string, unknown> = {};
  const leadId = typeof lead.id === "string" ? lead.id : null;
  if (leadId) {
    const { data } = await supabase
      .from("leads")
      .select(
        "id, contact, company, title, email, niche, notes, linkedin_url, source, source_url, enrichment, linkedin_snapshot, engagement_score, status",
      )
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();
    dbLead = asObject(data);
  }

  const mergedLead = { ...dbLead, ...lead };
  const enrichment = asObject(mergedLead.enrichment);
  const linkedinSnapshot = asObject(mergedLead.linkedin_snapshot);
  const rawDomain =
    shortText(enrichment.domain, 255) ?? domainFromEmail(shortText(mergedLead.email, 255));
  let companyDomain: string | undefined;
  try {
    companyDomain = rawDomain ? assertSafeDomain(rawDomain) : undefined;
  } catch {
    companyDomain = undefined;
  }

  const evidence: string[] = [];
  addEvidence(evidence, "Role", [mergedLead.title, mergedLead.company].filter(Boolean).join(" at "));
  addEvidence(evidence, "Industry/niche", mergedLead.niche);
  addEvidence(evidence, "Lead notes", mergedLead.notes, 500);
  addEvidence(evidence, "Company website", companyDomain);
  addEvidence(evidence, "Company positioning", enrichment.summary ?? enrichment.description, 700);
  addEvidence(evidence, "Company stage/size", enrichment.size_hint);
  addEvidence(evidence, "Company industry", enrichment.industry);
  addEvidence(evidence, "LinkedIn headline", linkedinSnapshot.headline);
  addEvidence(evidence, "LinkedIn recent signal", linkedinSnapshot.recent_post);

  const searchSignals: SearchSignal[] = [];
  for (const query of buildQueries(mergedLead, companyDomain)) {
    try {
      searchSignals.push(...(await serperSearch(supabase, userId, query)));
    } catch {
      /* Search is helpful, not required for drafting. */
    }
  }

  const uniqueSignals = Array.from(
    new Map(searchSignals.map((signal) => [signal.url, signal])).values(),
  ).slice(0, 8);
  for (const signal of uniqueSignals.slice(0, 5)) {
    addEvidence(evidence, `Search result - ${signal.title}`, signal.snippet || signal.url, 320);
  }

  return {
    lead: mergedLead,
    companyDomain,
    evidence: evidence.slice(0, 14),
    searchSignals: uniqueSignals,
    enrichment,
    linkedinSnapshot,
  };
}
