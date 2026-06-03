import { chatCompletion, getUserOpenAIKey, getUserKimiKey, getUserClaudeKey } from "./ai.server";
import type { ExtractedPerson } from "./sourcing.shared";

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
