import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { pct } from "@/lib/coldbase-constants";

export const Route = createFileRoute("/_app/campaigns")({ component: Campaigns });

const STATUS = ["draft", "active", "paused", "completed"] as const;

function Campaigns() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", status: "draft" as (typeof STATUS)[number] });

  const { data: camps, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("campaigns").insert({ user_id: user!.id, name: form.name.trim(), description: form.description || null, status: form.status });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Campaign created"); qc.invalidateQueries({ queryKey: ["campaigns"] }); setOpen(false); setForm({ name: "", description: "", status: "draft" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Campaigns" description="Group your outbound efforts and track their performance."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> New campaign</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        {isLoading ? (
          <div className="p-10 text-center"><Loader2 className="size-5 animate-spin inline" /></div>
        ) : !camps?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No campaigns yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Open %</TableHead>
                <TableHead className="text-right">Reply %</TableHead>
                <TableHead className="text-right">Meetings</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {camps.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
                  </TableCell>
                  <TableCell>
                    <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                      <SelectTrigger className="h-8 w-[120px]"><Badge variant="outline">{c.status}</Badge></SelectTrigger>
                      <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.sent_count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(c.open_count ?? 0, c.sent_count ?? 0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(c.reply_count ?? 0, c.sent_count ?? 0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{c.meeting_count ?? 0}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
