import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey } from "./ai.server";
import type { ExtractedPerson } from "./sourcing.shared";

export type AiSearchHit = {
  url: string;
  title?: string;
  description?: string;
};

export async function aiWebSearch(params: {
  supabase: any;
  userId: string;
  query: string;
  limit: number;
}): Promise<AiSearchHit[]> {
  const { supabase, userId, query, limit } = params;

  const [openaiKey, kimiKey, claudeKey] = await Promise.all([
    getUserOpenAIKey(supabase, userId),
    getUserKimiKey(supabase, userId),
    getUserClaudeKey(supabase, userId),
  ]);

  const sys = `You are a B2B web research assistant. Return ONLY valid JSON with this exact shape:
{"results":[{"url":"https://example.com","title":"Result title","description":"Short snippet"}]}
Rules:
- Focus on real company/person pages relevant to the query
- Prefer LinkedIn profiles/company pages, company team/about pages, Crunchbase/Wellfound profiles
- No markdown, no explanation, JSON only
- Maximum ${Math.max(1, Math.min(limit, 10))} results`;

  const userMsg = `Search query: ${query}`;

  try {
    const out = await chatCompletion({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
      openaiKey,
      kimiKey,
      claudeKey,
      json: true,
      temperature: 0.2,
    });

    const parsed = JSON.parse(out) as { results?: AiSearchHit[] };
    const rows = Array.isArray(parsed.results) ? parsed.results : [];
    return rows
      .filter((r) => typeof r?.url === "string" && r.url.startsWith("http"))
      .map((r) => ({
        url: r.url,
        title: r.title?.trim(),
        description: r.description?.trim(),
      }))
      .slice(0, Math.max(1, Math.min(limit, 20)));
  } catch (err) {
    console.error("aiWebSearch failed:", err);
    return [];
  }
}

export async function extractPeopleFromHits(params: {
  supabase: any;
  userId: string;
  hits: Array<{ url: string; description?: string }>;
  limit: number;
}): Promise<Array<ExtractedPerson & { source_url?: string }>> {
  const { supabase, userId, hits, limit } = params;

  const [openaiKey, kimiKey, claudeKey] = await Promise.all([
    getUserOpenAIKey(supabase, userId),
    getUserKimiKey(supabase, userId),
    getUserClaudeKey(supabase, userId),
  ]);

  const sys = `Extract B2B sales leads from search results. Return JSON: {"people":[{"contact":"Name","title":"Title","company":"Company","email":"Email","linkedin_url":"LinkedIn","niche":"Industry","summary":"Reason","score":1-10}]}`;
  const userMsg = `Hits:\n${JSON.stringify(hits)}`;

  const out = await chatCompletion({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userMsg },
    ],
    openaiKey,
    kimiKey,
    claudeKey,
    json: true,
    temperature: 0.3,
  });

  const parsed = JSON.parse(out) as { people?: Array<ExtractedPerson & { source_url?: string }> };
  return (parsed.people ?? []).slice(0, Math.max(limit * 2, 1));
}
