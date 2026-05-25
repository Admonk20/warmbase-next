// Server-only sourcing pipeline. Uses Firecrawl (search + scrape) + Lovable AI.
import Firecrawl from "@mendable/firecrawl-js";

export function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Firecrawl is not connected. Open Connectors and connect Firecrawl to enable lead sourcing.",
    );
  }
  return new Firecrawl({ apiKey });
}

export type IcpInput = {
  titles: string[];
  industries: string[];
  geos: string[];
  keywords: string[];
  size?: string;
  service: string;
  limit: number;
};

export function buildQueries(icp: IcpInput): string[] {
  const titlePart = icp.titles.length ? `(${icp.titles.map((t) => `"${t}"`).join(" OR ")})` : "";
  const industryPart = icp.industries.length ? `(${icp.industries.map((t) => `"${t}"`).join(" OR ")})` : "";
  const geoPart = icp.geos.length ? `(${icp.geos.map((t) => `"${t}"`).join(" OR ")})` : "";
  const kw = icp.keywords.join(" ");
  const queries: string[] = [];

  // LinkedIn x-ray
  queries.push(
    `site:linkedin.com/in ${titlePart} ${industryPart} ${geoPart} ${kw}`.replace(/\s+/g, " ").trim(),
  );
  // Company team pages
  if (industryPart) {
    queries.push(
      `(intitle:"about us" OR intitle:"our team" OR intitle:"leadership") ${industryPart} ${geoPart}`,
    );
  }
  // Crunchbase / directories
  queries.push(`site:crunchbase.com/organization ${industryPart} ${geoPart} ${kw}`);
  // General contact pages
  queries.push(`(intext:"contact" OR intext:"email us") ${industryPart} ${geoPart} ${kw}`);
  return queries.filter(Boolean).slice(0, 4);
}

export type RawSearchHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export async function firecrawlSearch(
  fc: ReturnType<typeof getFirecrawl>,
  query: string,
  limit: number,
): Promise<RawSearchHit[]> {
  // Search with light scrape
  const res = await fc.search(query, {
    limit,
    scrapeOptions: { formats: ["markdown"] },
  });
  // SDK v2 exposes results under res.web (array)
  // Fall back to flatter shapes if needed.
  const anyRes = res as unknown as {
    web?: Array<{ url?: string; title?: string; description?: string; markdown?: string }>;
    data?: Array<{ url?: string; title?: string; description?: string; markdown?: string }>;
  };
  const list = anyRes.web ?? anyRes.data ?? [];
  return list
    .filter((r) => r.url)
    .map((r) => ({
      url: r.url!,
      title: r.title,
      description: r.description,
      markdown: r.markdown,
    }));
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
};

/** Quick heuristic extractor for cases where we want to avoid an AI roundtrip. */
export function regexExtractFromMarkdown(md: string, sourceUrl: string): ExtractedPerson | null {
  const emailMatch = md.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const liMatch = md.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9-_%.]+/i);
  if (!emailMatch && !liMatch) return null;
  return {
    email: emailMatch?.[0],
    linkedin_url: liMatch?.[0],
    summary: md.slice(0, 240),
    score: 5,
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
