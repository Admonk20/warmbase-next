import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, getUserOpenAIKey, getUserKimiKey } from "./ai.server";
import {
  buildQueries,
  firecrawlSearch,
  getFirecrawl,
  regexExtractFromMarkdown,
  uniqueByKey,
  type ExtractedPerson,
  type IcpInput,
} from "./sourcing.server";

const icpSchema = z.object({
  titles: z.array(z.string().max(120)).max(10).default([]),
  industries: z.array(z.string().max(120)).max(10).default([]),
  geos: z.array(z.string().max(120)).max(10).default([]),
  keywords: z.array(z.string().max(80)).max(10).default([]),
  size: z.string().max(40).optional(),
  service: z.string().min(1).max(400),
  limit: z.number().int().min(5).max(40).default(15),
});

export const startSourcingRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ icp: icpSchema }).parse)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sourcing_runs")
      .insert({
        user_id: context.userId,
        icp: data.icp,
        status: "queued",
        totals: { queries: 0, hits: 0, findings: 0 },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { runId: row.id as string };
  });

export const runSourcingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: run, error: rErr } = await context.supabase
      .from("sourcing_runs")
      .select("id, icp, status, totals")
      .eq("id", data.runId)
      .single();
    if (rErr) throw new Error(rErr.message);
    if (run.status === "done" || run.status === "error") {
      return { status: run.status, totals: run.totals };
    }

    const icp = run.icp as IcpInput;
    const queries = buildQueries(icp);

    await context.supabase
      .from("sourcing_runs")
      .update({ status: "running", step: "searching" })
      .eq("id", run.id);

    try {
      const fc = getFirecrawl();
      const hits: { url: string; title?: string; description?: string; markdown?: string }[] = [];
      const perQuery = Math.max(3, Math.floor(icp.limit / queries.length));
      for (const q of queries) {
        try {
          const results = await firecrawlSearch(fc, q, perQuery);
          hits.push(...results);
        } catch (e) {
          console.error("firecrawl search failed", q, e);
        }
      }
      const deduped = uniqueByKey(hits, (h) => h.url).slice(0, icp.limit);

      await context.supabase
        .from("sourcing_runs")
        .update({ step: "extracting", totals: { queries: queries.length, hits: deduped.length, findings: 0 } })
        .eq("id", run.id);

      // Extract via AI (one batched call to keep latency + cost down)
      const [openaiKey, kimiKey] = await Promise.all([getUserOpenAIKey(context.supabase, context.userId), getUserKimiKey(context.supabase, context.userId)]);
      const sys = `You extract sales leads from web search results. Return JSON:
{"people":[{"contact":"Full Name","title":"Job Title","company":"Company","email":"email or empty","linkedin_url":"url or empty","niche":"industry","summary":"why a good fit (1 sentence)","score":1-10,"source_url":"the url"}]}
Only include items where you can identify at least a person OR a company. score = fit for our offer (1-10). Skip pure marketing pages.`;
      const userMsg = `Our offer: ${icp.service}
Target titles: ${icp.titles.join(", ") || "any"}
Target industries: ${icp.industries.join(", ") || "any"}
Geos: ${icp.geos.join(", ") || "any"}

Search hits (url + snippet):
${deduped
  .map(
    (h, i) =>
      `${i + 1}. ${h.url}
   Title: ${h.title ?? ""}
   Desc: ${h.description ?? ""}
   Body: ${(h.markdown ?? "").slice(0, 600)}`,
  )
  .join("\n\n")}`;

      let extracted: Array<ExtractedPerson & { source_url?: string }> = [];
      try {
        const out = await chatCompletion({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          openaiKey,
          kimiKey,
          json: true,
          temperature: 0.3,
        });
        const parsed = JSON.parse(out) as { people?: Array<ExtractedPerson & { source_url?: string }> };
        extracted = parsed.people ?? [];
      } catch (e) {
        console.error("AI extract failed, falling back to regex", e);
        extracted = deduped
          .map((h) => {
            const ex = regexExtractFromMarkdown(h.markdown ?? h.description ?? "", h.url);
            return ex ? { ...ex, source_url: h.url } : null;
          })
          .filter(Boolean) as Array<ExtractedPerson & { source_url?: string }>;
      }

      // Dedupe against existing leads (by email)
      const emails = extracted.map((p) => p.email?.toLowerCase()).filter(Boolean) as string[];
      let existing = new Set<string>();
      if (emails.length) {
        const { data: existingLeads } = await context.supabase
          .from("leads")
          .select("email")
          .in("email", emails);
        existing = new Set((existingLeads ?? []).map((l) => (l.email ?? "").toLowerCase()));
      }

      const findings = extracted
        .filter((p) => p.contact || p.email || p.linkedin_url)
        .map((p) => ({
          user_id: context.userId,
          run_id: run.id,
          contact: p.contact ?? null,
          title: p.title ?? null,
          company: p.company ?? null,
          email: p.email ? p.email.toLowerCase() : null,
          linkedin_url: p.linkedin_url ?? null,
          source_url: p.source_url ?? null,
          niche: p.niche ?? null,
          score: Math.max(1, Math.min(10, Number(p.score ?? 5))),
          summary: p.summary ?? null,
          payload: JSON.parse(JSON.stringify(p)) as never,
        }))
        .filter((f) => !(f.email && existing.has(f.email)));

      if (findings.length) {
        const { error: insErr } = await context.supabase.from("sourcing_findings").insert(findings);
        if (insErr) throw new Error(insErr.message);
      }

      await context.supabase
        .from("sourcing_runs")
        .update({
          status: "done",
          step: "done",
          totals: { queries: queries.length, hits: deduped.length, findings: findings.length },
        })
        .eq("id", run.id);

      return { status: "done", totals: { queries: queries.length, hits: deduped.length, findings: findings.length } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await context.supabase
        .from("sourcing_runs")
        .update({ status: "error", error: msg.slice(0, 500) })
        .eq("id", run.id);
      return { status: "error", error: msg };
    }
  });

export const getSourcingRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const [runQ, findingsQ] = await Promise.all([
      context.supabase
        .from("sourcing_runs")
        .select("id, icp, status, step, totals, error, created_at")
        .eq("id", data.runId)
        .single(),
      context.supabase
        .from("sourcing_findings")
        .select("id, contact, title, company, email, linkedin_url, source_url, niche, score, summary, lead_id, created_at")
        .eq("run_id", data.runId)
        .order("score", { ascending: false }),
    ]);
    if (runQ.error) throw new Error(runQ.error.message);
    return { run: runQ.data, findings: findingsQ.data ?? [] };
  });

export const listSourcingRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sourcing_runs")
      .select("id, icp, status, totals, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

export const promoteFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      findingIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: findings, error } = await context.supabase
      .from("sourcing_findings")
      .select("id, contact, title, company, email, linkedin_url, niche, summary")
      .in("id", data.findingIds)
      .is("lead_id", null);
    if (error) throw new Error(error.message);
    if (!findings?.length) return { promoted: 0 };

    const leadRows = findings.map((f) => ({
      user_id: context.userId,
      contact: f.contact ?? "Unknown",
      title: f.title,
      company: f.company,
      email: f.email,
      linkedin_url: f.linkedin_url,
      niche: f.niche,
      notes: f.summary,
      source: "sourcing",
      status: "new" as const,
    }));
    const { data: created, error: insErr } = await context.supabase
      .from("leads")
      .insert(leadRows)
      .select("id");
    if (insErr) throw new Error(insErr.message);

    // Map findings → leads order is preserved
    const updates = findings.map((f, i) => ({
      id: f.id,
      lead_id: created?.[i]?.id ?? null,
    }));
    for (const u of updates) {
      if (u.lead_id) {
        await context.supabase
          .from("sourcing_findings")
          .update({ lead_id: u.lead_id })
          .eq("id", u.id);
      }
    }
    return { promoted: created?.length ?? 0 };
  });
