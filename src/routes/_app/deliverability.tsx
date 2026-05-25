import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/deliverability")({ component: Deliverability });

const ITEMS = [
  ["spf", "SPF record published", "Authorizes your sending IPs. Without it, providers will reject."],
  ["dkim", "DKIM signing enabled", "Cryptographic signature proving the email wasn't tampered with."],
  ["dmarc", "DMARC policy active", "Tells receivers what to do with failed SPF/DKIM. Start at p=none."],
  ["domains", "Using a sending domain", "Never send cold mail from your primary domain. Use a separate one (e.g. yourbrand-mail.com)."],
  ["warmup", "Inboxes warmed", "Ramp from ~20/day for 2 weeks before sending volume."],
  ["limits", "Daily send limits set", "Cap at 30-50/inbox/day to stay under spam thresholds."],
  ["reply", "Reply-to inbox monitored", "Replies must land somewhere you actually check."],
  ["unsub", "Unsubscribe link present", "Required by CAN-SPAM. One-line plain text is fine."],
] as const;

function Deliverability() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deliverability"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase.from("deliverability_checks").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data ?? { user_id: user!.id, spf: false, dkim: false, dmarc: false, domains: false, warmup: false, limits: false, reply: false, unsub: false, start_date: new Date().toISOString().slice(0,10), inboxes: 6 };
    },
  });

  useEffect(() => { if (data && !state) setState(data); }, [data, state]);

  const save = useMutation({
    mutationFn: async () => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("deliverability_checks").upsert({ ...state, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["deliverability"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !state) {
    return <div className="p-10 text-center"><Loader2 className="size-5 animate-spin inline" /></div>;
  }

  const checked = ITEMS.filter(([k]) => state[k]).length;
  const total = ITEMS.length;
  const pct = Math.round((checked / total) * 100);

  const day = Math.max(1, Math.floor((Date.now() - new Date(state.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const perInbox = Math.min(50, 10 + day * 2);
  const dailyCap = perInbox * Number(state.inboxes);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Deliverability" description="The 8 checks that decide whether your cold email lands in inbox or spam."
        actions={<Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />}<Save className="size-4" /> Save</Button>}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Setup score — {checked}/{total} ({pct}%)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: pct + "%" }} />
          </div>
          <div className="mt-5 space-y-3">
            {ITEMS.map(([k, label, desc]) => (
              <label key={k} className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30">
                <Checkbox checked={state[k]} onCheckedChange={(v) => setState({ ...state, [k]: !!v })} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Warm-up calculator</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Warm-up start date</Label><Input type="date" value={state.start_date} onChange={(e) => setState({ ...state, start_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Inboxes</Label><Input type="number" min={1} max={50} value={state.inboxes} onChange={(e) => setState({ ...state, inboxes: Number(e.target.value) })} /></div>
          <div className="space-y-1.5">
            <Label>Today's cap</Label>
            <div className="text-2xl font-semibold">{dailyCap.toLocaleString()}/day</div>
            <div className="text-xs text-muted-foreground">Day {day} · {perInbox} per inbox</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
