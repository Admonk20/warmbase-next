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

type ResearchOut = {
  summary: string;
  pains: string[];
  opportunities: string[];
  suggested_service: string;
  why_this_service: string;
  score: number;
  hook: string;
};

export function LeadDrafter({ lead, open, onClose }: { lead: Lead | null; open: boolean; onClose: () => void }) {
  const draft = useServerFn(draftEmail);
  const subj = useServerFn(subjectLines);
  const research = useServerFn(researchLead);
  const send = useServerFn(sendEmail);

  // Optional. Empty = let AI pick the best service from research.
  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [researchOut, setResearchOut] = useState<ResearchOut | null>(null);
  const [pitchedService, setPitchedService] = useState<string>("");
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
            <Label>Your service (optional)</Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Leave blank — AI will pick the best service for this lead from the research"
            />
            <p className="text-xs text-muted-foreground">
              Empty = AI decides based on deep research. Fill it in to force a specific pitch (the email will redraft around it).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!!loading} onClick={async () => {
              setLoading("research");
              try {
                // 1. Always do deep research first
                const r = await research({ data: {
                  lead: {
                    contact: lead.contact,
                    company: lead.company ?? undefined,
                    title: lead.title ?? undefined,
                    niche: lead.niche ?? undefined,
                    linkedin_url: lead.linkedin_url ?? undefined,
                    email: lead.email ?? undefined,
                  },
                  sender: { services: service || undefined },
                } });
                if (!r) return;
                const ro = r as ResearchOut;
                setResearchOut(ro);

                // 2. Immediately draft, passing the FULL research object
                setLoading("draft");
                const d = await draft({ data: {
                  lead: {
                    contact: lead.contact,
                    company: lead.company ?? undefined,
                    title: lead.title ?? undefined,
                    email: lead.email ?? undefined,
                    niche: lead.niche ?? undefined,
                    notes: lead.notes ?? undefined,
                    status: lead.status ?? undefined,
                  },
                  service: service || undefined,
                  research: {
                    summary: ro.summary,
                    pains: ro.pains,
                    opportunities: ro.opportunities,
                    why_this_service: ro.why_this_service,
                    hook: ro.hook,
                  },
                  suggestedService: ro.suggested_service,
                } });
                if (d) {
                  setSubject(d.subject);
                  setBody(d.body);
                  setPitchedService(d.service_pitched ?? "");
                }
              } catch (e: any) {
                toast.error(e?.message ?? "Failed");
              } finally {
                setLoading(null);
              }
            }}>
              {loading === "research" || loading === "draft"
                ? <><Loader2 className="size-4 animate-spin" /> {loading === "research" ? "Researching…" : "Drafting…"}</>
                : <><Sparkles className="size-4" /> {service ? "Redraft with my service" : "Research & draft email"}</>}
            </Button>
            <Button size="sm" variant="outline" disabled={!!loading || !body} onClick={async () => {
              const r = await run("subj", () => subj({ data: { body, lead: { contact: lead.contact, company: lead.company ?? undefined } } }));
              if (r) setSubjects(r.subjects);
            }}>
              {loading === "subj" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Subject ideas
            </Button>
          </div>


          {researchOut && (
            <Card className="p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Score {researchOut.score}/10</Badge>
                {researchOut.suggested_service && (
                  <Badge variant="secondary">AI pick: {researchOut.suggested_service}</Badge>
                )}
              </div>
              <p>{researchOut.summary}</p>
              {researchOut.why_this_service && (
                <p className="text-muted-foreground"><strong>Why this service:</strong> {researchOut.why_this_service}</p>
              )}
              {researchOut.pains.length > 0 && (
                <div>
                  <div className="text-xs font-medium mt-1">Likely pains</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {researchOut.pains.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {researchOut.opportunities.length > 0 && (
                <div>
                  <div className="text-xs font-medium mt-1">Opportunities</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {researchOut.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}
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

          {pitchedService && (
            <p className="text-xs text-muted-foreground">Pitched in this draft: <strong>{pitchedService}</strong></p>
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
