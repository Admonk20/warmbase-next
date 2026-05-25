import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Plus, Trash2, Loader2, Mail, Download, Upload, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { personalizeBatch } from "@/lib/email.functions";
import { PageHeader } from "@/components/page-header";
import { LeadDrafter } from "@/components/lead-drafter";
import { LeadDrawer } from "@/components/lead-drawer";
import { CsvImporter } from "@/components/csv-importer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads")({ component: Leads });


const STATUSES = ["new", "contacted", "engaged", "meeting", "won", "lost"] as const;
type Status = typeof STATUSES[number];

const leadSchema = z.object({
  contact: z.string().trim().min(1, "Required").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  niche: z.string().trim().max(120).optional().or(z.literal("")),
  linkedin_url: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(STATUSES),
});

type FormState = z.input<typeof leadSchema>;

const empty: FormState = {
  contact: "", company: "", title: "", email: "", phone: "", niche: "", linkedin_url: "", notes: "", status: "new",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  contacted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  engaged: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  meeting: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  won: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  lost: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const cols = ["contact", "title", "company", "email", "phone", "niche", "linkedin_url", "status", "notes", "created_at"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function Leads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const personalize = useServerFn(personalizeBatch);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [tab, setTab] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafterLead, setDrafterLead] = useState<any | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    STATUSES.forEach((s) => (c[s] = 0));
    leads.forEach((l: any) => { c[l.status] = (c[l.status] ?? 0) + 1; });
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l: any) => {
      if (tab !== "all" && l.status !== tab) return false;
      if (!needle) return true;
      return [l.contact, l.company, l.email, l.title, l.niche].some((v: any) => v?.toLowerCase().includes(needle));
    });
  }, [leads, tab, q]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const upsert = useMutation({
    mutationFn: async () => {
      const supabase = await getBrowserSupabase();
      const parsed = leadSchema.parse(form);
      const payload = {
        user_id: user!.id,
        contact: parsed.contact,
        company: parsed.company || null,
        title: parsed.title || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        niche: parsed.niche || null,
        linkedin_url: parsed.linkedin_url || null,
        notes: parsed.notes || null,
        status: parsed.status,
      };
      if (editing) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Lead updated" : "Lead added");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-count"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      setSelected({});
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-count"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  function exportCsv() {
    const csv = toCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const rows = lines.slice(1).map((ln) => {
      const cells = ln.match(/("([^"]|"")*"|[^,]+)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
      const r: any = { user_id: user!.id, status: "new" };
      headers.forEach((h, i) => {
        if (["contact","company","title","email","phone","niche","linkedin_url","notes","status"].includes(h)) r[h] = cells[i] || null;
      });
      if (!r.contact) r.contact = r.email || "Unknown";
      return r;
    }).filter((r) => r.contact);
    if (!rows.length) { toast.error("No rows found"); return; }
    const supabase = await getBrowserSupabase();
    const { error } = await supabase.from("leads").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} leads`);
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["leads-count"] });
  }

  async function personalizeSelected() {
    if (!selectedIds.length) return;
    const subset = leads.filter((l: any) => selected[l.id]).slice(0, 50).map((l: any) => ({
      id: l.id, contact: l.contact, company: l.company ?? undefined, title: l.title ?? undefined, niche: l.niche ?? undefined,
    }));
    const t = toast.loading(`Personalizing ${subset.length} leads…`);
    try {
      const { openers } = await personalize({ data: { leads: subset } });
      const supabase = await getBrowserSupabase();
      for (const op of openers as { id: string; opener: string }[]) {
        const existing = leads.find((l: any) => l.id === op.id);
        const nextNotes = `${existing?.notes ? existing.notes + "\n\n" : ""}Opener: ${op.opener}`;
        await supabase.from("leads").update({ notes: nextNotes }).eq("id", op.id);
      }
      toast.success(`Generated ${openers.length} openers — saved to notes`, { id: t });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed", { id: t });
    }
  }

  function openEdit(l: any) {
    setEditing(l);
    setForm({
      contact: l.contact ?? "", company: l.company ?? "", title: l.title ?? "",
      email: l.email ?? "", phone: l.phone ?? "", niche: l.niche ?? "",
      linkedin_url: l.linkedin_url ?? "", notes: l.notes ?? "", status: l.status ?? "new",
    });
    setOpen(true);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Leads"
        description="Manage every prospect in your pipeline."
        actions={
          <div className="flex flex-wrap gap-2">
            <input type="file" accept=".csv" id="csv-upload" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById("csv-upload")?.click()}><Upload className="size-4" /> Import CSV</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" /> Export</Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="size-4" /> New lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>{editing ? "Edit lead" : "Add lead"}</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-1.5"><Label>Contact name *</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Niche / industry</Label><Input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} /></div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>LinkedIn URL</Label><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                    {upsert.isPending && <Loader2 className="size-4 animate-spin" />} {editing ? "Save" : "Add lead"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>{s} <Badge variant="secondary" className="ml-1.5">{counts[s] ?? 0}</Badge></TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email…" className="pl-8" />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={personalizeSelected}><Sparkles className="size-4" /> Personalize ({selectedIds.length})</Button>
            <Button size="sm" variant="destructive" onClick={() => remove.mutate(selectedIds)}><Trash2 className="size-4" /> Delete</Button>
          </div>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
        ) : !filtered.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No leads match.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((l: any) => selected[l.id])}
                    onCheckedChange={(v) => {
                      const next: Record<string, boolean> = { ...selected };
                      filtered.forEach((l: any) => { next[l.id] = !!v; });
                      setSelected(next);
                    }}
                  />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Checkbox checked={!!selected[l.id]} onCheckedChange={(v) => setSelected({ ...selected, [l.id]: !!v })} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{l.contact}</div>
                    {l.title && <div className="text-xs text-muted-foreground">{l.title}{l.niche ? ` · ${l.niche}` : ""}</div>}
                  </TableCell>
                  <TableCell>{l.company || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{l.email || "—"}</TableCell>
                  <TableCell>
                    <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v })}>
                      <SelectTrigger className="h-8 w-[130px]">
                        <Badge className={STATUS_COLORS[l.status]}>{l.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDrafterLead(l)} aria-label="Draft email"><Mail className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate([l.id])} aria-label="Delete"><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <LeadDrafter lead={drafterLead} open={!!drafterLead} onClose={() => setDrafterLead(null)} />
    </div>
  );
}
