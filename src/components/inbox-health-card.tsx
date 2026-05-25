import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listSeedInboxes, addSeedInbox, removeSeedInbox, inboxHealthSummary } from "@/lib/inbox-health.functions";

export function InboxHealthCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSeedInboxes);
  const addFn = useServerFn(addSeedInbox);
  const removeFn = useServerFn(removeSeedInbox);
  const summaryFn = useServerFn(inboxHealthSummary);
  const [email, setEmail] = useState("");

  const { data } = useQuery({ queryKey: ["seed-inboxes"], queryFn: () => listFn() });
  const { data: sum } = useQuery({ queryKey: ["inbox-health-summary"], queryFn: () => summaryFn() });

  async function add() {
    if (!email.trim()) return;
    try {
      await addFn({ data: { email: email.trim() } });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["seed-inboxes"] });
      toast.success("Seed inbox added");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Inbox className="size-4" /> Inbox placement</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Add inbox addresses you control. We'll periodically check where your test sends land (Inbox vs Spam vs Missing).</p>
        {sum && sum.total_checked > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Inbox</div><div className="text-xl font-semibold text-emerald-500">{sum.inbox_pct}%</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Spam</div><div className="text-xl font-semibold text-destructive">{sum.spam_pct}%</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Missing</div><div className="text-xl font-semibold text-amber-500">{sum.missing_pct}%</div></div>
          </div>
        )}
        <div className="flex gap-2">
          <Input placeholder="seed@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="size-4" /> Add</Button>
        </div>
        {(data?.inboxes.length ?? 0) > 0 && (
          <div className="border rounded-lg divide-y max-h-60 overflow-auto">
            {data!.inboxes.map((i: any) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="flex-1 truncate font-mono text-xs">{i.email}</div>
                {i.last_checked_at && (
                  <span className="text-xs text-muted-foreground">
                    {i.last_inbox ? "📥" : i.last_spam ? "🚫" : i.last_missing ? "❓" : "—"}
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={async () => { await removeFn({ data: { id: i.id } }); qc.invalidateQueries({ queryKey: ["seed-inboxes"] }); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
