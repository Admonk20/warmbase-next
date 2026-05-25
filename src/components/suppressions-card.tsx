import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listSuppressions, addSuppression, removeSuppression } from "@/lib/suppressions.functions";

export function SuppressionsCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSuppressions);
  const addFn = useServerFn(addSuppression);
  const removeFn = useServerFn(removeSuppression);
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["suppressions"],
    queryFn: () => listFn(),
  });

  async function add() {
    if (!email.trim()) return;
    try {
      await addFn({ data: { email: email.trim(), reason: "manual" } });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["suppressions"] });
      toast.success("Added to suppression list");
    } catch (e: any) { toast.error(e.message); }
  }
  async function remove(id: string) {
    await removeFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["suppressions"] });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ban className="size-4" /> Suppression list</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Emails here will never be sent to. Hard bounces and spam complaints are added automatically by the webhook.</p>
        <div className="flex gap-2">
          <Input placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="size-4" /> Add</Button>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (data?.suppressions.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No suppressed addresses.</div>
        ) : (
          <div className="border rounded-lg divide-y max-h-72 overflow-auto">
            {data!.suppressions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="flex-1 truncate font-mono text-xs">{s.email}</div>
                <span className="text-xs text-muted-foreground capitalize">{s.reason}</span>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
