const GENERIC_EMAIL_PREFIXES = new Set([
  "admin",
  "contact",
  "hello",
  "help",
  "info",
  "marketing",
  "press",
  "sales",
  "support",
  "team",
]);

export type IcpInput = {
  titles: string[];
  industries: string[];
  geos: string[];
  keywords: string[];
  size?: string;
  service: string;
  limit: number;
};

function quoteTerms(values: string[]): string {
  return values.map((t) => `"${t}"`).join(" OR ");
}

export function buildQueries(icp: IcpInput): string[] {
  const titles = quoteTerms(icp.titles);
  const industries = quoteTerms(icp.industries);
  const geos = quoteTerms(icp.geos);
  const keywords = icp.keywords.join(" ");
  const size = icp.size ? `"${icp.size}"` : "";
  const titlePart = titles ? `(${titles})` : "";
  const industryPart = industries ? `(${industries})` : "";
  const geoPart = geos ? `(${geos})` : "";
  const common = [titlePart, industryPart, geoPart, keywords, size].filter(Boolean).join(" ");

  return Array.from(
    new Set(
      [
        `site:linkedin.com/in ${common}`,
        `site:linkedin.com/in ${titlePart} ${industryPart} founder CEO growth sales`,
        `(intitle:"team" OR intitle:"leadership" OR intitle:"about") ${industryPart} ${geoPart} ${keywords}`,
        `(intext:"founder" OR intext:"CEO" OR intext:"Head of") ${industryPart} ${geoPart} ${keywords} email`,
        `site:crunchbase.com/organization ${industryPart} ${geoPart} ${keywords}`,
        `site:wellfound.com/company ${industryPart} ${geoPart} ${keywords}`,
      ]
        .map((q) => q.replace(/\s+/g, " ").trim())
        .filter((q) => q.length > 12),
    ),
  ).slice(0, 6);
}

export type ExtractedPerson = {
  contact?: string;
  title?: string;
  company?: string;
  email?: string;
  linkedin_url?: string;
  niche?: string;
  summary?: string;
  score?: number;
  confidence?: number;
  rationale?: string;
};

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  const prefix = value.split("@")[0];
  if (GENERIC_EMAIL_PREFIXES.has(prefix)) return null;
  return value;
}

export function normalizeLinkedIn(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) return null;
    if (!/^\/(in|company|pub)\//i.test(parsed.pathname)) return null;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function cleanPerson(p: ExtractedPerson & { source_url?: string }) {
  const contact = p.contact?.replace(/\s+/g, " ").trim();
  const company = p.company?.replace(/\s+/g, " ").trim();
  const title = p.title?.replace(/\s+/g, " ").trim();
  const email = normalizeEmail(p.email);
  const linkedin_url = normalizeLinkedIn(p.linkedin_url);
  const score = Math.max(1, Math.min(10, Number(p.score ?? 5)));
  const confidence = Math.max(1, Math.min(10, Number(p.confidence ?? score)));

  if (!contact && !email && !linkedin_url) return null;
  if (!email && !linkedin_url && (!contact || !company)) return null;

  return {
    ...p,
    contact: contact || null,
    company: company || null,
    title: title || null,
    email,
    linkedin_url,
    niche: p.niche?.trim() || null,
    summary: p.summary?.replace(/\s+/g, " ").trim().slice(0, 500) || null,
    score,
    confidence,
  };
}

export function leadKey(p: ReturnType<typeof cleanPerson>): string {
  if (!p) return "";
  if (p.email) return `email:${p.email}`;
  if (p.linkedin_url) return `li:${p.linkedin_url}`;
  return `name:${String(p.contact ?? "").toLowerCase()}@${String(p.company ?? "").toLowerCase()}`;
}

/** Quick heuristic extractor for cases where AI extraction fails. */
export function regexExtractFromMarkdown(md: string, sourceUrl: string): ExtractedPerson | null {
  const emailMatch = md.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const liMatch = md.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9-_%.]+/i);
  if (!emailMatch && !liMatch) return null;
  const titleMatch = md.match(/\b(CEO|Founder|Co-Founder|Head of [A-Za-z ]+|VP [A-Za-z ]+|Director [A-Za-z ]+)\b/i);
  return {
    email: normalizeEmail(emailMatch?.[0]) ?? undefined,
    linkedin_url: normalizeLinkedIn(liMatch?.[0]) ?? undefined,
    title: titleMatch?.[0],
    summary: md.slice(0, 240).replace(/\s+/g, " "),
    score: 5,
    confidence: 3,
  };
}

export function uniqueByKey<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
