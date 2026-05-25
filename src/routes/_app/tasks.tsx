import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Clock, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { listTasks, createTask, toggleTask, deleteTask, snoozeTask } from "@/lib/tasks.functions";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const toggleFn = useServerFn(toggleTask);
  const deleteFn = useServerFn(deleteTask);
  const snoozeFn = useServerFn(snoozeTask);

  const [filter, setFilter] = useState<"today" | "overdue" | "upcoming" | "completed" | "all">("today");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => listFn({ data: { filter } }),
  });

  async function add() {
    if (!title.trim()) return;
    try {
      await createFn({ data: { title: title.trim(), due_at: due ? new Date(due).toISOString() : undefined } });
      setTitle(""); setDue("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task added");
    } catch (e: any) { toast.error(e.message); }
  }
  async function toggle(id: string, completed: boolean) {
    await toggleFn({ data: { id, completed } });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function remove(id: string) {
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function snooze(id: string, hours: number) {
    await snoozeFn({ data: { id, hours } });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success(`Snoozed ${hours}h`);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Tasks" description="Reminders and to-dos. Snooze, complete, or attach to a lead." />

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="What do you need to do?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-56" />
            <Button onClick={add}><Plus className="size-4" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.tasks.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground border rounded-lg p-6 text-center">No tasks here.</div>
        )}
        {data?.tasks.map((t) => {
          const overdue = t.due_at && !t.completed_at && new Date(t.due_at) < new Date();
          return (
            <div key={t.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
              <Checkbox checked={!!t.completed_at} onCheckedChange={(v) => toggle(t.id, !!v)} />
              <div className="flex-1 min-w-0">
                <div className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</div>
                {t.due_at && (
                  <div className={"text-xs " + (overdue ? "text-destructive" : "text-muted-foreground")}>
                    {new Date(t.due_at).toLocaleString()}
                  </div>
                )}
              </div>
              {!t.completed_at && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => snooze(t.id, 1)} title="Snooze 1h"><Clock className="size-4" />1h</Button>
                  <Button size="sm" variant="ghost" onClick={() => snooze(t.id, 24)} title="Snooze 1d"><Clock className="size-4" />1d</Button>
                </>
              )}
              {t.completed_at && <Check className="size-4 text-emerald-500" />}
              <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="size-4" /></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
