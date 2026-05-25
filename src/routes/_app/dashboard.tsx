import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Send, MailOpen, Reply, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Stat({ label, value, sub, icon: Icon }: any) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data: leads } = useQuery({
    queryKey: ["leads-count"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { count } = await supabase.from("leads").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: events } = useQuery({
    queryKey: ["events-stats"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data } = await supabase.from("email_events").select("event_type");
      const arr = data ?? [];
      const c = (t: string) => arr.filter((r: any) => r.event_type === t).length;
      return { sent: c("sent"), opened: c("opened"), replied: c("replied") };
    },
  });
  const { data: pipeline } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data } = await supabase.from("leads").select("status");
      const arr = data ?? [];
      const c = (s: string) => arr.filter((r: any) => r.status === s).length;
      return { new: c("new"), contacted: c("contacted"), engaged: c("engaged"), meeting: c("meeting"), won: c("won"), lost: c("lost") };
    },
  });

  const openRate = events?.sent ? Math.round((events.opened / events.sent) * 100) : 0;
  const replyRate = events?.sent ? Math.round((events.replied / events.sent) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description="Live snapshot of your pipeline and outreach performance." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total leads" value={leads ?? 0} icon={Users} />
        <Stat label="Emails sent" value={events?.sent ?? 0} icon={Send} />
        <Stat label="Open rate" value={`${openRate}%`} sub={`${events?.opened ?? 0} opens`} icon={MailOpen} />
        <Stat label="Reply rate" value={`${replyRate}%`} sub={`${events?.replied ?? 0} replies`} icon={Reply} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Pipeline</CardTitle>
          <CardDescription>Lead distribution across stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {(["new","contacted","engaged","meeting","won","lost"] as const).map((s) => (
              <div key={s} className="rounded-lg border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s}</div>
                <div className="text-xl font-semibold mt-1">{pipeline?.[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
