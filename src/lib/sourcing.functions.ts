import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildQueries,
  cleanPerson,
  leadKey,
  regexExtractFromMarkdown,
  uniqueByKey,
  type ExtractedPerson,
  type IcpInput,
} from "./sourcing.shared";

const icpSchema = z.object({
  titles: z.array(z.string().max(120)).max(10).default([]),
  industries: z.array(z.string().max(120)).max(10).default([]),
  geos: z.array(z.string().max(120)).max(10).default([]),
  keywords: z.array(z.string().max(80)).max(10).default([]),
  size: z.string().max(40).optional(),
  service: z.string().min(1).max(400),
  limit: z.number().int().min(5).max(40).default(15),
});

export const startSourcingRunInternal = async ({ data, context }: { data: { icp: any }, context: { supabase: any, userId: string } }) => {
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
};

export const startSourcingRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ icp: icpSchema }).parse)
  .handler(async ({ data, context }) => {
    return startSourcingRunInternal({ data, context });
  });

export const runSourcingStepInternal = async ({ data, context }: { data: { runId: string }, context: { supabase: any, userId: string } }) => {
  const { data: run, error: rErr } = await context.supabase
    .from("sourcing_runs")
    .select("id, icp, status, totals")
    .eq("id", data.runId)
    .single();
  if (rErr) throw new Error(rErr.message);
  if (run.status === "done" || run.status === "error") {
    return { status: run.status, totals: run.totals };
  }
  if (run.status === "running") {
    return { status: run.status, totals: run.totals };
  }

  const icp = run.icp as IcpInput;
  const queries = buildQueries(icp);

  await context.supabase
    .from("sourcing_runs")
    .update({ status: "running", step: "searching" })
    .eq("id", run.id);

  try {
    const hits: { url: string; title?: string; description?: string; markdown?: string }[] = [];
    const perQuery = Math.max(4, Math.ceil((icp.limit * 1.6) / Math.max(queries.length, 1)));
    const { playwrightSearch } = await import("./sourcing.server");
    for (const q of queries) {
      try {
        const results = await playwrightSearch(q, perQuery);
        hits.push(...results);
      } catch (e) {
        console.error("playwright search failed", q, e);
      }
    }
    const deduped = uniqueByKey(hits, (h) => h.url).slice(0, Math.max(icp.limit * 2, 12));

    await context.supabase
      .from("sourcing_runs")
      .update({ step: "extracting", totals: { queries: queries.length, hits: deduped.length, findings: 0 } })
      .eq("id", run.id);

    let extracted: Array<ExtractedPerson & { source_url?: string }> = [];
    try {
      const { extractPeopleFromHits } = await import("./sourcing-ai.server");
      extracted = await extractPeopleFromHits({
        supabase: context.supabase,
        userId: context.userId,
        hits: deduped.map((h) => ({ url: h.url, description: h.description })),
        limit: icp.limit,
      });
    } catch (e) {
      extracted = deduped
        .map((h) => {
          const ex = regexExtractFromMarkdown(h.markdown ?? h.description ?? "", h.url);
          return ex ? { ...ex, source_url: h.url } : null;
        })
        .filter(Boolean) as Array<ExtractedPerson & { source_url?: string }>;
    }

    const cleaned = uniqueByKey(
      extracted.map(cleanPerson).filter(Boolean),
      (p) => leadKey(p),
    );

    const emails = cleaned.map((p) => p?.email).filter(Boolean) as string[];
    const existing = new Set<string>();
    if (emails.length) {
      const { data: existingLeads } = await context.supabase
        .from("leads")
        .select("email")
        .in("email", emails);
      for (const l of existingLeads ?? []) if (l.email) existing.add(`email:${l.email.toLowerCase()}`);
    }

    const findings = cleaned
      .filter((p) => p && !existing.has(leadKey(p)))
      .sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0))
      .slice(0, icp.limit)
      .map((p) => ({
        user_id: context.userId,
        run_id: run.id,
        contact: p!.contact,
        title: p!.title,
        company: p!.company,
        email: p!.email,
        linkedin_url: p!.linkedin_url,
        source_url: p!.source_url ?? null,
        niche: p!.niche,
        score: p!.score,
        summary: p!.summary,
        payload: JSON.parse(JSON.stringify(p)) as never,
      }));

    if (findings.length) {
      await context.supabase.from("sourcing_findings").insert(findings);
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
};

export const runSourcingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    return runSourcingStepInternal({ data, context });
  });

export const getSourcingRunInternal = async ({ data, context }: { data: { runId: string }, context: { supabase: any } }) => {
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
};

export const getSourcingRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    return getSourcingRunInternal({ data, context });
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

export const promoteFindingsInternal = async ({ data, context }: { data: { findingIds: string[] }, context: { supabase: any, userId: string } }) => {
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
};

export const promoteFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      findingIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    return promoteFindingsInternal({ data, context });
  });
