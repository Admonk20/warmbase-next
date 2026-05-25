import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { STATUSES } from "@/lib/coldbase-constants";

type Step = "upload" | "map" | "review" | "importing" | "done";

const TARGET_FIELDS = [
  { key: "contact", label: "Contact name", required: true },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Job title" },
  { key: "phone", label: "Phone" },
  { key: "niche", label: "Niche / industry" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "value", label: "Deal value" },
] as const;

type TargetKey = (typeof TARGET_FIELDS)[number]["key"];

function guessMapping(headers: string[]): Record<string, TargetKey | "_skip"> {
  const m: Record<string, TargetKey | "_skip"> = {};
  for (const h of headers) {
    const s = h.toLowerCase().trim();
    if (/(full ?name|^name$|contact)/.test(s)) m[h] = "contact";
    else if (/e-?mail/.test(s)) m[h] = "email";
    else if (/(company|organization|org\b|account)/.test(s)) m[h] = "company";
    else if (/(title|role|position|job)/.test(s)) m[h] = "title";
    else if (/phone|mobile|tel/.test(s)) m[h] = "phone";
    else if (/(niche|industry|vertical)/.test(s)) m[h] = "niche";
    else if (/linkedin/.test(s)) m[h] = "linkedin_url";
    else if (/notes?|description/.test(s)) m[h] = "notes";
    else if (/status|stage/.test(s)) m[h] = "status";
    else if (/source|channel/.test(s)) m[h] = "source";
    else if (/value|amount|deal/.test(s)) m[h] = "value";
    else m[h] = "_skip";
  }
  return m;
}

export function CsvImporter({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetKey | "_skip">>({});
  const [dupPolicy, setDupPolicy] = useState<"skip" | "update" | "create">("skip");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ imported: number; updated: number; skipped: number; errors: number } | null>(null);

  const mappedTargets = useMemo(
    () => Object.values(mapping).filter((v) => v !== "_skip") as TargetKey[],
    [mapping],
  );
  const canMap = mappedTargets.includes("contact");

  function reset() {
    setStep("upload");
    setRows([]); setHeaders([]); setMapping({});
    setProgress(0); setSummary(null);
  }

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cleanRows = (res.data ?? []).filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
        if (!cleanRows.length) { toast.error("CSV is empty"); return; }
        const h = res.meta.fields ?? Object.keys(cleanRows[0]);
        setHeaders(h);
        setMapping(guessMapping(h));
        setRows(cleanRows);
        setStep("map");
      },
      error: (e) => toast.error("CSV parse failed: " + e.message),
    });
  }

  function buildLeadFromRow(r: Record<string, string>): Record<string, unknown> | null {
    const lead: Record<string, unknown> = { user_id: user?.id };
    for (const [csvCol, target] of Object.entries(mapping)) {
      if (target === "_skip") continue;
      let raw = (r[csvCol] ?? "").trim();
      if (!raw) continue;
      if (target === "email") raw = raw.toLowerCase();
      if (target === "value") {
        const n = Number(raw.replace(/[^0-9.\-]/g, ""));
        lead.value = Number.isFinite(n) ? n : 0;
        continue;
      }
      if (target === "status") {
        if (!STATUSES.includes(raw.toLowerCase() as typeof STATUSES[number])) continue;
        lead.status = raw.toLowerCase();
        continue;
      }
      lead[target] = raw;
    }
    if (!lead.contact) return null;
    return lead;
  }

  async function runImport() {
    setStep("importing");
    setProgress(0);
    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const toInsert: Record<string, unknown>[] = [];

    // Pre-fetch existing emails for dedupe
    const allEmails: string[] = [];
    const built = rows.map(buildLeadFromRow).filter(Boolean) as Record<string, unknown>[];
    for (const l of built) if (l.email) allEmails.push(String(l.email));
    let existing = new Map<string, string>();
    if (allEmails.length && (dupPolicy === "skip" || dupPolicy === "update")) {
      const { data: ex } = await supabase
        .from("leads")
        .select("id, email")
        .in("email", Array.from(new Set(allEmails)));
      for (const row of ex ?? []) if (row.email) existing.set(row.email, row.id);
    }

    for (let i = 0; i < built.length; i++) {
      const lead = built[i];
      const email = lead.email ? String(lead.email) : undefined;
      const existingId = email ? existing.get(email) : undefined;
      if (existingId) {
        if (dupPolicy === "skip") { skipped++; }
        else if (dupPolicy === "update") {
          const { user_id: _u, ...patch } = lead;
          void _u;
          const { error } = await supabase.from("leads").update(patch as never).eq("id", existingId);
          if (error) errors++; else updated++;
        } else {
          toInsert.push(lead);
        }
      } else {
        toInsert.push(lead);
      }
      setProgress(Math.round(((i + 1) / built.length) * 50));
    }

    // Chunked insert
    const chunk = 200;
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("leads").insert(slice as never);
      if (error) errors += slice.length; else imported += slice.length;
      setProgress(50 + Math.round(((i + chunk) / Math.max(toInsert.length, 1)) * 50));
    }

    setSummary({ imported, updated, skipped, errors });
    setStep("done");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <label className="border-2 border-dashed rounded-xl p-12 grid place-items-center text-center cursor-pointer hover:bg-muted/40 transition-colors">
            <div>
              <div className="font-medium mb-1">Drop a CSV file or click to browse</div>
              <div className="text-xs text-muted-foreground">First row must contain column headers.</div>
            </div>
            <input
              type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Found <span className="font-medium text-foreground">{rows.length}</span> rows and{" "}
              <span className="font-medium text-foreground">{headers.length}</span> columns. Map each CSV column to a lead field.
            </div>
            <div className="max-h-80 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs">
                  <tr><th className="text-left p-2">CSV column</th><th className="text-left p-2">Sample</th><th className="text-left p-2 w-56">Maps to</th></tr>
                </thead>
                <tbody>
                  {headers.map((h) => (
                    <tr key={h} className="border-t">
                      <td className="p-2 font-mono text-xs">{h}</td>
                      <td className="p-2 text-muted-foreground text-xs truncate max-w-[16rem]">{rows[0]?.[h] ?? ""}</td>
                      <td className="p-2">
                        <Select value={mapping[h]} onValueChange={(v) => setMapping({ ...mapping, [h]: v as TargetKey | "_skip" })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_skip">— Skip —</SelectItem>
                            {TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label}{"required" in f && f.required ? " *" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button disabled={!canMap} onClick={() => setStep("review")}>
                Continue {canMap ? "" : "(map a contact column first)"}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">If a lead already exists (matched by email)</Label>
              <Select value={dupPolicy} onValueChange={(v) => setDupPolicy(v as typeof dupPolicy)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip duplicates</SelectItem>
                  <SelectItem value="update">Update existing</SelectItem>
                  <SelectItem value="create">Create as new anyway</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">Preview of the first 5 rows:</div>
            <div className="border rounded-lg overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>{mappedTargets.map((t) => <th key={t} className="p-2 text-left">{t}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => {
                    const lead = buildLeadFromRow(r);
                    return (
                      <tr key={i} className="border-t">
                        {mappedTargets.map((t) => (
                          <td key={t} className="p-2 truncate max-w-[14rem]">{String((lead as Record<string, unknown> | null)?.[t] ?? "")}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={runImport}>Import {rows.length} rows</Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-3 py-10">
            <Progress value={progress} />
            <div className="text-xs text-center text-muted-foreground">Importing… {progress}%</div>
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Imported" value={summary.imported} tone="emerald" />
              <Stat label="Updated" value={summary.updated} tone="blue" />
              <Stat label="Skipped" value={summary.skipped} tone="amber" />
              <Stat label="Errors" value={summary.errors} tone="rose" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => reset()}>Import another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "blue" | "amber" | "rose" }) {
  const cls = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      <Badge variant="secondary" className="mt-1 text-[10px] uppercase tracking-wide">{label}</Badge>
    </div>
  );
}
