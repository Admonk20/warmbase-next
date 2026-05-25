import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Mail, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NICHE_TEMPLATES, copyText } from "@/lib/coldbase-constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sequences")({ component: SequenceStudio });

const DEFAULT_VARS = {
  first_name: "Sarah", company: "Acme Corp", specific_role: "Operations Manager",
  specific_process: "data entry", company_type: "e-commerce brands", similar_industry: "retail",
  task: "manual reporting", process: "inventory management", your_name: "You", agent_count: "12",
};

function interp(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
}

function SequenceStudio() {
  const [niche, setNiche] = useState(Object.keys(NICHE_TEMPLATES)[0]);
  const [vars, setVars] = useState(DEFAULT_VARS);
  const [copied, setCopied] = useState<string | null>(null);

  const tpl = NICHE_TEMPLATES[niche];
  const doCopy = (id: string, t: string) => { copyText(t); setCopied(id); toast.success("Copied"); setTimeout(() => setCopied(null), 1500); };
  const openGmail = (subj: string, body: string) => {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Sequence Studio" description="Pre-built, niche-tuned 4-step sequences with variable replacement." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-1 space-y-3">
          <div className="space-y-1.5">
            <Label>Niche</Label>
            <Select value={niche} onValueChange={setNiche}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(NICHE_TEMPLATES).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="pt-2 border-t">
            <div className="text-xs font-medium mb-2 text-muted-foreground">Variables</div>
            <div className="space-y-2">
              {Object.entries(vars).map(([k, v]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs font-mono">{`{{${k}}}`}</Label>
                  <Input value={v} onChange={(e) => setVars((p) => ({ ...p, [k]: e.target.value }))} className="h-8" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {tpl.steps.map((s, i) => {
            const subj = interp(s.subject, vars);
            const body = interp(s.body, vars);
            const id = `step-${i}`;
            return (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {i + 1}</Badge>
                    <Badge variant="secondary">Day {s.day}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => doCopy(id, `${subj}\n\n${body}`)}>
                      {copied === id ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openGmail(subj, body)}>
                      <Mail className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-semibold mb-1">{subj}</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-sans">{body}</pre>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
