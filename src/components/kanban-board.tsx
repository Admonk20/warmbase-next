import { useEffect, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUSES, STATUS_LABELS } from "@/lib/coldbase-constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

type Lead = {
  id: string;
  contact: string;
  company: string | null;
  title: string | null;
  email: string | null;
  status: string;
  value: number | null;
  last_emailed_at: string | null;
  niche: string | null;
};

export function KanbanBoard({ onCardClick }: { onCardClick?: (id: string) => void }) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, contact, company, title, email, status, value, last_emailed_at, niche")
        .order("updated_at", { ascending: false })
        .limit(500);
      setLeads((data ?? []) as Lead[]);
      setLoading(false);
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<string, Lead[]> = {};
    for (const s of STATUSES) g[s] = [];
    for (const l of leads) (g[l.status] ?? g.new).push(l);
    return g;
  }, [leads]);

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const newStatus = e.over?.id ? String(e.over.id) : null;
    if (!newStatus) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === newStatus) return;
    const oldStatus = lead.status;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    const { error } = await supabase.from("leads").update({ status: newStatus as never }).eq("id", id);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: oldStatus } : l)));
      toast.error("Failed to move lead");
    } else {
      toast.success(`Moved to ${STATUS_LABELS[newStatus]}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase.from("leads").update({ status: oldStatus as never }).eq("id", id);
            setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: oldStatus } : l)));
          },
        },
      });
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading pipeline…</div>;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((s) => (
          <KanbanColumn key={s} status={s} leads={grouped[s] ?? []} onCardClick={onCardClick} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ status, leads, onCardClick }: { status: string; leads: Lead[]; onCardClick?: (id: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const total = leads.reduce((sum, l) => sum + (l.value ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-xl bg-muted/30 border p-3 flex flex-col gap-2 transition-colors",
        isOver && "bg-primary/5 border-primary/40",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{STATUS_LABELS[status]}</span>
          <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
        </div>
        {total > 0 && <span className="text-[11px] text-muted-foreground">${total.toLocaleString()}</span>}
      </div>
      <div className="space-y-2 flex-1 min-h-24">
        {leads.length === 0 && <div className="text-[11px] text-muted-foreground p-3 text-center">No leads</div>}
        {leads.map((l) => <KanbanCard key={l.id} lead={l} onClick={() => onCardClick?.(l.id)} />)}
      </div>
    </div>
  );
}

function KanbanCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("p-3 cursor-pointer hover:border-primary/50 transition-colors", isDragging && "opacity-50 z-50")}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground -ml-1 mt-0.5"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag"
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{lead.contact}</div>
          <div className="text-xs text-muted-foreground truncate">
            {lead.title}{lead.title && lead.company ? " · " : ""}{lead.company}
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {lead.niche && <Badge variant="outline" className="text-[10px] py-0">{lead.niche}</Badge>}
            {lead.value ? <Badge className="text-[10px] py-0">${Number(lead.value).toLocaleString()}</Badge> : null}
            {lead.last_emailed_at && (
              <span className="text-[10px] text-muted-foreground">
                · {new Date(lead.last_emailed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PipelineHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Drag leads between stages.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
    </div>
  );
}
