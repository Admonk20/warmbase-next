import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Send, Search, Wand2 } from "lucide-react";
import { draftEmail, subjectLines, sendEmail } from "@/lib/email.functions";
import { researchLead } from "@/lib/research.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Lead = {
  id: string;
  contact: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  niche?: string | null;
  notes?: string | null;
  status?: string | null;
  linkedin_url?: string | null;
};

export function LeadDrafter({ lead, open, onClose }: { lead: Lead | null; open: boolean; onClose: () => void }) {
  const draft = useServerFn(draftEmail);
  const subj = useServerFn(subjectLines);
  const research = useServerFn(researchLead);
  const send = useServerFn(sendEmail);

  const [service, setService] = useState("AI automation, web/app development");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [researchOut, setResearchOut] = useState<{ summary: string; hook: string; score: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  if (!lead) return null;

  async function run<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    setLoading(name);
    try { return await fn(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); return null; }
    finally { setLoading(null); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Email drafter — {lead.contact}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <Card className="p-3 text-sm">
            <div className="font-medium">{lead.contact}{lead.title && <span className="text-muted-foreground"> — {lead.title}</span>}</div>
            <div className="text-muted-foreground">{lead.company ?? "—"} {lead.email && `· ${lead.email}`}</div>
          </Card>

          <div className="space-y-1.5">
            <Label>Your offer / service</Label>
            <Input value={service} onChange={(e) => setService(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!!loading} onClick={async () => {
              const r = await run("research", () => research({ data: { lead: { contact: lead.contact, company: lead.company ?? undefined, title: lead.title ?? undefined, niche: lead.niche ?? undefined, linkedin_url: lead.linkedin_url ?? undefined } } }));
              if (r) setResearchOut(r);
            }}>
              {loading === "research" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Research
            </Button>
            <Button size="sm" disabled={!!loading} onClick={async () => {
              const r = await run("draft", () => draft({ data: { lead: { contact: lead.contact, company: lead.company ?? undefined, title: lead.title ?? undefined, email: lead.email ?? undefined, niche: lead.niche ?? undefined, notes: lead.notes ?? undefined, status: lead.status ?? undefined }, service, research: researchOut?.summary } }));
              if (r) { setSubject(r.subject); setBody(r.body); }
            }}>
              {loading === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft email
            </Button>
            <Button size="sm" variant="outline" disabled={!!loading || !body} onClick={async () => {
              const r = await run("subj", () => subj({ data: { body, lead: { contact: lead.contact, company: lead.company ?? undefined } } }));
              if (r) setSubjects(r.subjects);
            }}>
              {loading === "subj" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Subject ideas
            </Button>
          </div>

          {researchOut && (
            <Card className="p-3 space-y-1 text-sm">
              <div className="flex items-center gap-2"><Badge>Score {researchOut.score}/10</Badge></div>
              <p>{researchOut.summary}</p>
              {researchOut.hook && <p className="text-muted-foreground"><strong>Hook:</strong> {researchOut.hook}</p>}
            </Card>
          )}

          {subjects.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Subject alternatives</Label>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s, i) => (
                  <button key={i} onClick={() => setSubject(s)} className="text-xs px-2 py-1 rounded border hover:bg-muted">{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => {
              const mailto = `mailto:${lead.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              window.location.href = mailto;
            }} disabled={!lead.email || !subject}>Open in mail app</Button>
            <Button disabled={!lead.email || !subject || !body || loading === "send"} onClick={async () => {
              const r = await run("send", () => send({ data: { to: lead.email!, subject, body, leadId: lead.id } }));
              if (r?.ok) { toast.success("Email sent"); onClose(); }
            }}>
              {loading === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send email
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
