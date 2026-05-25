import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard, PipelineHeader } from "@/components/kanban-board";
import { useState } from "react";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
  head: () => ({ meta: [{ title: "Pipeline · ColdBase Pro" }] }),
});

function PipelinePage() {
  const [bump, setBump] = useState(0);
  return (
    <AppShell>
      <PipelineHeader onRefresh={() => setBump((n) => n + 1)} />
      <div className="p-6">
        <KanbanBoard key={bump} />
      </div>
    </AppShell>
  );
}
