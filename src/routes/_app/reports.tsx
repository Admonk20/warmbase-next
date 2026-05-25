import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Mail, MousePointerClick, Reply, Ban, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { weeklyDigest, exportLeadsCsv, exportActivityCsv } from "@/lib/export.functions";
import { funnel, cohorts } from "@/lib/analytics.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/reports")({ component: Reports });

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Reports() {
  const digestFn = useServerFn(weeklyDigest);
  const leadsFn = useServerFn(exportLeadsCsv);
  const activityFn = useServerFn(exportActivityCsv);
  const funnelFn = useServerFn(funnel);
  const cohortsFn = useServerFn(cohorts);

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-digest"],
    queryFn: () => digestFn(),
  });
  const { data: fn } = useQuery({
    queryKey: ["funnel", 30],
    queryFn: () => funnelFn({ data: { days: 30 } }),
  });
  const { data: co } = useQuery({
    queryKey: ["cohorts", 8],
    queryFn: () => cohortsFn({ data: { weeks: 8 } }),
  });


  async function exportLeads() {
    try {
      const r = await leadsFn({ data: {} });
      downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, r.csv);
      toast.success(`Exported ${r.count} leads`);
    } catch (e: any) { toast.error(e.message); }
  }
  async function exportActivity(days: number) {
    try {
      const r = await activityFn({ data: { days } });
      downloadCsv(`activity-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, r.csv);
      toast.success(`Exported ${r.count} events`);
    } catch (e: any) { toast.error(e.message); }
  }

  const cards = [
    { label: "Sent", value: data?.sent ?? 0, icon: Mail },
    { label: "Opened", value: data?.opened ?? 0, icon: TrendingUp },
    { label: "Clicked", value: data?.clicked ?? 0, icon: MousePointerClick },
    { label: "Replied", value: data?.replied ?? 0, icon: Reply },
    { label: "Bounced", value: data?.bounced ?? 0, icon: Ban },
    { label: "Unsubscribed", value: data?.unsubscribed ?? 0, icon: Ban },
  ];

  const openRate = data?.sent ? ((data.opened / data.sent) * 100).toFixed(1) : "0.0";
  const replyRate = data?.sent ? ((data.replied / data.sent) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Reports" description="Weekly performance digest and data exports." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <c.icon className="size-3.5" /> {c.label}
                    </div>
                    <div className="text-2xl font-semibold mt-1">{c.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Open rate</div>
                  <div className="text-xl font-semibold">{openRate}%</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Reply rate</div>
                  <div className="text-xl font-semibold">{replyRate}%</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">New leads</div>
                  <div className="text-xl font-semibold">{data?.new_leads ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Pipeline value</div>
                  <div className="text-xl font-semibold">${(data?.pipeline_value ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" /> Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportLeads}>
              <Download className="size-4" /> Leads (CSV)
            </Button>
            <Button variant="outline" onClick={() => exportActivity(7)}>
              <Download className="size-4" /> Activity — 7d
            </Button>
            <Button variant="outline" onClick={() => exportActivity(30)}>
              <Download className="size-4" /> Activity — 30d
            </Button>
            <Button variant="outline" onClick={() => exportActivity(90)}>
              <Download className="size-4" /> Activity — 90d
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            CSVs include all leads and email events for your account. Up to 5,000 leads and 10,000 events per export.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
