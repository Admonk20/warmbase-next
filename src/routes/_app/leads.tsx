import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads")({ component: Leads });

const STATUSES = ["new","contacted","engaged","meeting","won","lost"] as const;

const leadSchema = z.object({
  contact: z.string().trim().min(1, "Required").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  status: z.enum(STATUSES),
});

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  contacted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  engaged: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  meeting: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  won: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  lost: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

function Leads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contact: "", company: "", title: "", email: "", phone: "", status: "new" as typeof STATUSES[number] });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = leadSchema.parse(form);
      const { error } = await supabase.from("leads").insert({
        user_id: user!.id,
        contact: parsed.contact,
        company: parsed.company || null,
        title: parsed.title || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        status: parsed.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead added");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-count"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      setOpen(false);
      setForm({ contact: "", company: "", title: "", email: "", phone: "", status: "new" });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create lead"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-count"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Leads"
        description="Manage every prospect in your pipeline."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> New lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add lead</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Contact name *</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="size-4 animate-spin" />} Add lead
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
        ) : !leads?.length ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No leads yet. Add your first to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.contact}</div>
                    {l.title && <div className="text-xs text-muted-foreground">{l.title}</div>}
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
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)} aria-label="Delete lead">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
