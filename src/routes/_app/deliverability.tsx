import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/deliverability")({ component: Deliv });

function Deliv() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Deliverability" description="Open / click / bounce / complaint rates per campaign." />
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        <BarChart3 className="size-8 mx-auto mb-3 opacity-50" />
        Real metrics arrive once tracking pixel + click redirect ship with the send-email function.
      </CardContent></Card>
    </div>
  );
}
