import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Play, ChevronRight, CheckCircle2, AlertCircle, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startSourcingRun, runSourcingStep, getSourcingRun, listSourcingRuns, promoteFindings } from "@/lib/sourcing.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/sourcing")({
  component: SourcingPage,
  head: () => ({ meta: [{ title: "Sourcing · ColdBase Pro" }] }),
});

type IcpForm = {
  service: string;
  titles: string[];
  industries: string[];
  geos: string[];
  keywords: string[];
  size: string;
  limit: number;
};

const empty: IcpForm = {
  service: "AI automation and custom web/app development for SMBs",
  titles: ["CEO", "Founder", "Head of Marketing"],
  industries: ["E-commerce", "SaaS"],
  geos: ["United States"],
  keywords: ["hiring", "scaling"],
  size: "11-50",
  limit: 15,
};

function SourcingPage() {
  const qc = useQueryClient();
  const start = useServerFn(startSourcingRun);
  const step = useServerFn(runSourcingStep);
  const fetchRun = useServerFn(getSourcingRun);
  const list = useServerFn(listSourcingRuns);
  const promote = useServerFn(promoteFindings);

  const [icp, setIcp] = useState<IcpForm>(empty);
  const [runId, setRunId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const runs = useQuery({ queryKey: ["sourcing-runs"], queryFn: () => list() });

  const current = useQuery({
    queryKey: ["sourcing-run", runId],
    queryFn: () => fetchRun({ data: { runId: runId! } }),
    enabled: !!runId,
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.run?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });

  const startRun = useMutation({
    mutationFn: async () => {
      if (!icp.service.trim()) throw new Error("Service description is required");
      const { runId } = await start({ data: { icp } });
      setRunId(runId);
      setPicked({});
      // Fire the step (long-ish) in the background
      step({ data: { runId } }).catch((e) => toast.error(e?.message ?? "Run failed"));
      return runId;
    },
    onSuccess: () => {
      toast.success("Sourcing run started");
      qc.invalidateQueries({ queryKey: ["sourcing-runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to start"),
  });

  const promoteMut = useMutation({
    mutationFn: async () => {
      const ids = Object.keys(picked).filter((k) => picked[k]);
      if (!ids.length) throw new Error("Pick at least one finding");
      return promote({ data: { findingIds: ids } });
    },
    onSuccess: (r) => {
      toast.success(`${r.promoted} leads added to your CRM`);
      setPicked({});
      qc.invalidateQueries({ queryKey: ["sourcing-run", runId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  useEffect(() => {
    // when run completes, refresh history list
    const s = (current.data as any)?.run?.status;
    if (s === "done" || s === "error") qc.invalidateQueries({ queryKey: ["sourcing-runs"] });
  }, [(current.data as any)?.run?.status]);

  const findings = (current.data as any)?.findings ?? [];
  const run = (current.data as any)?.run;
  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Sourcing"
        description="Describe your ideal customer. We search the web, extract real people, and score them against your offer."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> ICP wizard</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Your offer / service">
              <Textarea rows={3} value={icp.service} onChange={(e) => setIcp({ ...icp, service: e.target.value })} />
            </Field>
            <ChipField label="Job titles" values={icp.titles} onChange={(v) => setIcp({ ...icp, titles: v })} placeholder="e.g. CEO" />
            <ChipField label="Industries" values={icp.industries} onChange={(v) => setIcp({ ...icp, industries: v })} placeholder="e.g. SaaS" />
            <ChipField label="Geographies" values={icp.geos} onChange={(v) => setIcp({ ...icp, geos: v })} placeholder="e.g. Berlin" />
            <ChipField label="Keywords" values={icp.keywords} onChange={(v) => setIcp({ ...icp, keywords: v })} placeholder="e.g. hiring" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company size"><Input value={icp.size} onChange={(e) => setIcp({ ...icp, size: e.target.value })} /></Field>
              <Field label="Lead count">
                <Input type="number" min={5} max={40} value={icp.limit}
                  onChange={(e) => setIcp({ ...icp, limit: Math.min(40, Math.max(5, Number(e.target.value) || 15)) })} />
              </Field>
            </div>
            <Button className="w-full" onClick={() => startRun.mutate()} disabled={startRun.isPending}>
              {startRun.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Start sourcing
            </Button>
            <p className="text-xs text-muted-foreground">
              Runs on Firecrawl + AI. Up to {icp.limit} researched leads per run.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-5 min-w-0">
          {!runId ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
              Configure your ICP and start a run to see results here.
            </CardContent></Card>
          ) : (
            <>
              <RunStatus run={run} />
              {!!findings.length && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{findings.length} findings</CardTitle>
                    <Button size="sm" onClick={() => promoteMut.mutate()} disabled={!pickedCount || promoteMut.isPending}>
                      {promoteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Promote {pickedCount || ""} to leads
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={findings.every((f: any) => picked[f.id] || !!f.lead_id)}
                              onCheckedChange={(v) => {
                                const next: Record<string, boolean> = { ...picked };
                                findings.forEach((f: any) => { if (!f.lead_id) next[f.id] = !!v; });
                                setPicked(next);
                              }}
                            />
                          </TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="w-[70px]">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {findings.map((f: any) => (
                          <TableRow key={f.id} className={f.lead_id ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={!!picked[f.id] || !!f.lead_id}
                                disabled={!!f.lead_id}
                                onCheckedChange={(v) => setPicked({ ...picked, [f.id]: !!v })}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{f.contact || "—"}</div>
                              {f.title && <div className="text-xs text-muted-foreground">{f.title}</div>}
                              {f.summary && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.summary}</div>}
                            </TableCell>
                            <TableCell>
                              <div>{f.company || "—"}</div>
                              {f.source_url && (
                                <a href={f.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px] inline-block">
                                  {new URL(f.source_url).hostname}
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{f.email || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={f.score >= 7 ? "default" : "secondary"}>{f.score}/10</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!!runs.data?.runs?.length && (
            <Card>
              <CardHeader><CardTitle className="text-base">Recent runs</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {runs.data.runs.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => setRunId(r.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 text-sm ${runId === r.id ? "bg-muted" : ""}`}
                  >
                    <StatusDot status={r.status} />
                    <div className="flex-1 min-w-0 truncate">{(r.icp as any)?.service ?? "Sourcing run"}</div>
                    <div className="text-xs text-muted-foreground">{(r.totals as any)?.findings ?? 0} leads</div>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RunStatus({ run }: { run: any }) {
  if (!run) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin inline" /> Loading…</CardContent></Card>;
  const t = run.totals ?? {};
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <StatusDot status={run.status} large />
        <div className="flex-1 min-w-0">
          <div className="font-medium capitalize">{run.status}{run.step && run.status === "running" ? ` · ${run.step}` : ""}</div>
          <div className="text-xs text-muted-foreground">
            {t.queries ?? 0} queries · {t.hits ?? 0} hits · {t.findings ?? 0} leads extracted
          </div>
          {run.error && <div className="text-xs text-rose-500 mt-1">{run.error}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status, large }: { status: string; large?: boolean }) {
  const cls = large ? "size-3" : "size-2";
  if (status === "done") return <CheckCircle2 className={`${large ? "size-5" : "size-4"} text-emerald-500`} />;
  if (status === "error") return <AlertCircle className={`${large ? "size-5" : "size-4"} text-rose-500`} />;
  if (status === "running" || status === "queued") return <Loader2 className={`${large ? "size-5" : "size-4"} animate-spin text-primary`} />;
  return <div className={`${cls} rounded-full bg-muted-foreground/40`} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function ChipField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-rose-500">
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            onChange([...values, draft.trim()]);
            setDraft("");
          }
        }}
      />
    </div>
  );
}
