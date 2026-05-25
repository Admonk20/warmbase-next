import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard, PipelineHeader } from "@/components/kanban-board";
import { useState } from "react";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
  head: () => ({ meta: [{ title: "Pipeline · ColdBase Pro" }] }),
});

function PipelinePage() {
  const [bump, setBump] = useState(0);
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PipelineHeader onRefresh={() => setBump((n) => n + 1)} />
      <div className="mt-4">
        <KanbanBoard key={bump} />
      </div>
    </div>
  );
}

