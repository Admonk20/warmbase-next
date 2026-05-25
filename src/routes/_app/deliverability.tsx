import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Mail, MousePointerClick, Reply, AlertCircle, UserMinus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/deliverability")({
  component: DeliverabilityDashboard,
  head: () => ({ meta: [{ title: "Deliverability · ColdBase Pro" }] }),
});

const RANGES = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
type RangeKey = keyof typeof RANGES;

function DeliverabilityDashboard() {
  const [range, setRange] = useState<RangeKey>("7d");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - RANGES[range]);
    return d.toISOString();
  }, [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["deliverability", range],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("email_events")
        .select("event_type, occurred_at, campaign_id, metadata")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return events ?? [];
    },
  });

  const stats = useMemo(() => {
    const counts: Record<string, number> = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0, failed: 0, complained: 0 };
    (data ?? []).forEach((e: any) => { counts[e.event_type] = (counts[e.event_type] ?? 0) + 1; });
    const sent = Math.max(1, counts.sent);
    return {
      counts,
      openRate: (counts.opened / sent) * 100,
      clickRate: (counts.clicked / sent) * 100,
      replyRate: (counts.replied / sent) * 100,
      bounceRate: (counts.bounced / sent) * 100,
      unsubRate: (counts.unsubscribed / sent) * 100,
    };
  }, [data]);

  const chartData = useMemo(() => {
    const buckets: Record<string, any> = {};
    (data ?? []).forEach((e: any) => {
      const day = new Date(e.occurred_at).toISOString().slice(0, 10);
      buckets[day] = buckets[day] ?? { day, sent: 0, opened: 0, replied: 0, clicked: 0 };
      if (buckets[day][e.event_type] !== undefined) buckets[day][e.event_type] += 1;
    });
    return Object.values(buckets).sort((a: any, b: any) => a.day.localeCompare(b.day));
  }, [data]);

  const cohortByDomain = useMemo(() => {
    const m: Record<string, { sent: number; opened: number; replied: number; bounced: number }> = {};
    (data ?? []).forEach((e: any) => {
      const to = (e.metadata as any)?.to as string | undefined;
      const domain = to?.split("@")[1]?.toLowerCase();
      if (!domain) return;
      m[domain] = m[domain] ?? { sent: 0, opened: 0, replied: 0, bounced: 0 };
      if (e.event_type === "sent") m[domain].sent += 1;
      if (e.event_type === "opened") m[domain].opened += 1;
      if (e.event_type === "replied") m[domain].replied += 1;
      if (e.event_type === "bounced") m[domain].bounced += 1;
    });
    return Object.entries(m).map(([k, v]) => ({ domain: k, ...v })).sort((a, b) => b.sent - a.sent).slice(0, 10);
  }, [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Deliverability"
        description="Open, click, reply and bounce rates across your sends."
        actions={
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="size-5 animate-spin inline" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Sent" value={stats.counts.sent} icon={Send} />
            <Stat label="Open rate" value={`${stats.openRate.toFixed(1)}%`} sub={`${stats.counts.opened} opens`} icon={Mail} color="text-emerald-500" />
            <Stat label="Click rate" value={`${stats.clickRate.toFixed(1)}%`} sub={`${stats.counts.clicked} clicks`} icon={MousePointerClick} color="text-violet-500" />
            <Stat label="Reply rate" value={`${stats.replyRate.toFixed(1)}%`} sub={`${stats.counts.replied} replies`} icon={Reply} color="text-amber-500" />
            <Stat label="Bounce rate" value={`${stats.bounceRate.toFixed(1)}%`} sub={`${stats.counts.bounced} bounced`} icon={AlertCircle} color="text-rose-500" />
            <Stat label="Unsub rate" value={`${stats.unsubRate.toFixed(1)}%`} sub={`${stats.counts.unsubscribed} unsubs`} icon={UserMinus} color="text-muted-foreground" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Sends, opens & replies over time</CardTitle></CardHeader>
            <CardContent className="h-72">
              {chartData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">No events in this range yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="opened" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="replied" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicked" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top recipient domains</CardTitle></CardHeader>
            <CardContent>
              {!cohortByDomain.length ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No sends yet.</div>
              ) : (
                <div className="space-y-2">
                  {cohortByDomain.map((c) => {
                    const open = c.sent ? (c.opened / c.sent) * 100 : 0;
                    const reply = c.sent ? (c.replied / c.sent) * 100 : 0;
                    const bounce = c.sent ? (c.bounced / c.sent) * 100 : 0;
                    return (
                      <div key={c.domain} className="flex items-center gap-3 text-sm">
                        <div className="w-40 truncate font-medium">{c.domain}</div>
                        <div className="flex-1 h-2 bg-muted rounded overflow-hidden flex">
                          <div className="bg-emerald-500" style={{ width: `${open}%` }} />
                          <div className="bg-amber-500" style={{ width: `${reply}%` }} />
                          <div className="bg-rose-500" style={{ width: `${bounce}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground w-32 text-right">
                          {c.sent} sent · {open.toFixed(0)}% open
                        </div>
                        {bounce > 5 && <Badge variant="destructive" className="text-[10px]">High bounce</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon: Icon, color }: { label: string; value: number | string; sub?: string; icon: any; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`size-4 ${color ?? "text-muted-foreground"}`} />
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
