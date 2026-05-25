import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Save, Mail, Send, MousePointerClick, Reply, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listLeadNotes, addLeadNote, deleteLeadNote, leadActivity } from "@/lib/notes.functions";

import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUSES = ["new", "contacted", "engaged", "meeting", "won", "lost"] as const;



const EVENT_ICON: Record<string, any> = {
  sent: Send, opened: Mail, clicked: MousePointerClick, replied: Reply,
  bounced: AlertCircle, complained: AlertCircle, unsubscribed: AlertCircle, failed: AlertCircle,
};

const EVENT_COLOR: Record<string, string> = {
  sent: "text-blue-500", opened: "text-emerald-500", clicked: "text-violet-500",
  replied: "text-amber-500", bounced: "text-rose-500", complained: "text-rose-500",
  unsubscribed: "text-rose-500", failed: "text-rose-500",
};

export function LeadDrawer({ lead, open, onClose }: { lead: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchActivity = useServerFn(leadActivity);
  const fetchNotes = useServerFn(listLeadNotes);
  const addNote = useServerFn(addLeadNote);
  const removeNote = useServerFn(deleteLeadNote);

  const [form, setForm] = useState<any>(lead ?? {});
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => { setForm(lead ?? {}); }, [lead?.id]);

  const activity = useQuery({
    queryKey: ["lead-activity", lead?.id],
    queryFn: () => fetchActivity({ data: { leadId: lead!.id } }),
    enabled: !!lead?.id && open,
  });

  const notes = useQuery({
    queryKey: ["lead-notes", lead?.id],
    queryFn: () => fetchNotes({ data: { leadId: lead!.id } }),
    enabled: !!lead?.id && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        contact: form.contact, company: form.company || null, title: form.title || null,
        email: form.email || null, phone: form.phone || null, niche: form.niche || null,
        linkedin_url: form.linkedin_url || null, status: form.status, value: Number(form.value) || 0,
      }).eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const submitNote = useMutation({
    mutationFn: async () => addNote({ data: { leadId: lead!.id, body: noteBody.trim() } }),
    onSuccess: () => {
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["lead-notes", lead?.id] });
      qc.invalidateQueries({ queryKey: ["lead-activity", lead?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const timeline = useMemo(() => {
    const events = (activity.data?.events ?? []).map((e: any) => ({
      kind: "event" as const, id: e.id, at: e.occurred_at, event_type: e.event_type, subject: e.subject, metadata: e.metadata,
    }));
    const ns = (activity.data?.notes ?? []).map((n: any) => ({
      kind: "note" as const, id: n.id, at: n.created_at, body: n.body,
    }));
    return [...events, ...ns].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [activity.data]);

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate">{lead.contact}</div>
              <div className="text-xs font-normal text-muted-foreground truncate">
                {[lead.title, lead.company].filter(Boolean).join(" · ") || "No company"}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">{lead.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>


          <TabsContent value="overview" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact"><Input value={form.contact ?? ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
              <Field label="Title"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Company"><Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="Email"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Niche"><Input value={form.niche ?? ""} onChange={(e) => setForm({ ...form, niche: e.target.value })} /></Field>
              <Field label="LinkedIn"><Input value={form.linkedin_url ?? ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
              <Field label="Deal value"><Input type="number" value={form.value ?? 0} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Source"><Input value={form.source ?? ""} readOnly className="text-muted-foreground" /></Field>
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            {activity.isLoading ? (
              <div className="py-10 text-center"><Loader2 className="size-5 animate-spin inline" /></div>
            ) : !timeline.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              <ol className="space-y-3">
                {timeline.map((t) => t.kind === "event" ? (
                  <li key={`e-${t.id}`} className="flex gap-3 text-sm">
                    {(() => {
                      const Icon = EVENT_ICON[t.event_type] ?? Mail;
                      return <Icon className={`size-4 mt-0.5 shrink-0 ${EVENT_COLOR[t.event_type] ?? "text-muted-foreground"}`} />;
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium capitalize">{t.event_type}{t.subject ? ` · ${t.subject}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.at), { addSuffix: true })}</div>
                    </div>
                  </li>
                ) : (
                  <li key={`n-${t.id}`} className="flex gap-3 text-sm border-l-2 border-primary/40 pl-3">
                    <div className="flex-1 min-w-0">
                      <div className="whitespace-pre-wrap">{t.body}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Note · {formatDistanceToNow(new Date(t.at), { addSuffix: true })}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="notes" className="pt-4 space-y-3">
            <div className="space-y-2">
              <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder="Add a note…" />
              <Button size="sm" onClick={() => submitNote.mutate()} disabled={!noteBody.trim() || submitNote.isPending}>
                {submitNote.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Add note
              </Button>
            </div>
            <div className="space-y-2">
              {(notes.data?.notes ?? []).map((n: any) => (
                <div key={n.id} className="border rounded-md p-3 text-sm group">
                  <div className="whitespace-pre-wrap">{n.body}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                    <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100"
                      onClick={async () => {
                        await removeNote({ data: { id: n.id } });
                        qc.invalidateQueries({ queryKey: ["lead-notes", lead.id] });
                        qc.invalidateQueries({ queryKey: ["lead-activity", lead.id] });
                      }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {!notes.data?.notes?.length && <div className="text-sm text-muted-foreground text-center py-6">No notes yet.</div>}
            </div>
          </TabsContent>

        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
