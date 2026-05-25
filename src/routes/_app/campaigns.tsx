import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_app/campaigns")({ component: Campaigns });

function Campaigns() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Campaigns" description="Group sends, track performance, and iterate." />
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        <Send className="size-8 mx-auto mb-3 opacity-50" />
        Campaigns module — wire-up coming next. Use Leads + Sequences for now.
      </CardContent></Card>
    </div>
  );
}
