import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Workflow } from "lucide-react";

export const Route = createFileRoute("/_app/sequences")({ component: Sequences });

function Sequences() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Sequences" description="Multi-step outreach: Day 1 → Day 3 → Day 7 → Day 14." />
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        <Workflow className="size-8 mx-auto mb-3 opacity-50" />
        Sequence builder + cron runner ship in Phase 3.
      </CardContent></Card>
    </div>
  );
}
