import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Mail, Users, MessageSquare, CalendarCheck, DollarSign, Trophy } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pct, fmt, STATUS_LABELS } from "@/lib/coldbase-constants";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const [leadsR, campsR, evtsR] = await Promise.all([
        supabase.from("leads").select("status, value").limit(1000),
        supabase.from("campaigns").select("sent_count, open_count, reply_count, meeting_count").limit(200),
        supabase.from("email_events").select("event_type").limit(1000),
      ]);
      return { leads: leadsR.data ?? [], camps: campsR.data ?? [], evts: evtsR.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    const leads = data?.leads ?? [];
    const camps = data?.camps ?? [];
    const sent = camps.reduce((a, c) => a + (c.sent_count ?? 0), 0);
    const opened = camps.reduce((a, c) => a + (c.open_count ?? 0), 0);
    const replied = camps.reduce((a, c) => a + (c.reply_count ?? 0), 0);
    const meetings = camps.reduce((a, c) => a + (c.meeting_count ?? 0), 0);
    const pipeline = leads.reduce((a, l) => a + Number(l.value ?? 0), 0);
    const won = leads.filter((l) => l.status === "won").reduce((a, l) => a + Number(l.value ?? 0), 0);
    const byStatus: Record<string, number> = {};
    for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    const funnel = ["new", "contacted", "engaged", "meeting", "won"].map((s) => ({
      name: STATUS_LABELS[s], count: byStatus[s] ?? 0, key: s,
    }));
    return { sent, opened, replied, meetings, pipeline, won, funnel };
  }, [data]);

  const colors = ["#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981"];

  const kpis = [
    { label: "Emails sent", value: stats.sent, icon: Mail, sub: "All-time" },
    { label: "Open rate", value: stats.sent ? pct(stats.opened, stats.sent) + "%" : "—", icon: Users, sub: "Target 60%+" },
    { label: "Reply rate", value: stats.sent ? pct(stats.replied, stats.sent) + "%" : "—", icon: MessageSquare, sub: "Target 15%+" },
    { label: "Meetings", value: stats.meetings, icon: CalendarCheck, sub: "This pipeline" },
    { label: "Pipeline", value: fmt(stats.pipeline), icon: DollarSign, sub: "Open lead value" },
    { label: "Won", value: fmt(stats.won), icon: Trophy, sub: "Closed revenue" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Dashboard" description="Live pipeline metrics, sourced straight from your data." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.funnel}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stats.funnel.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
