import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Pause, Settings, Zap, Target, Search, Mail, History, CheckCircle2, XCircle, Loader2, Users } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automation")({ component: AutomationPage });

function AutomationPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["automation-config"],
    refetchInterval: 15000,
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data, error } = await supabase
        .from("automation_config" as any)
        .select("*")
        .eq("user_id", user.user.id)
        .maybeSingle();

      if (error) throw error;
      const base = (data as any) || {};
      return {
        enabled: !!base.enabled,
        icp: {
          titles: Array.isArray(base?.icp?.titles) ? base.icp.titles : [],
          industries: Array.isArray(base?.icp?.industries) ? base.icp.industries : [],
          geos: Array.isArray(base?.icp?.geos) ? base.icp.geos : [],
          keywords: Array.isArray(base?.icp?.keywords) ? base.icp.keywords : [],
          size: base?.icp?.size || "",
          service: base?.icp?.service || "",
          limit: Number(base?.icp?.limit ?? base?.daily_lead_limit ?? 20),
        },
        sender_name: base?.sender_name || "",
        sender_company: base?.sender_company || "",
        sender_title: base?.sender_title || "",
        services_offered: base?.services_offered || "",
        daily_lead_limit: Number(base?.daily_lead_limit ?? 20),
      };
    }
  });

  const { data: runs } = useQuery({
    queryKey: ["automation-runs"],
    refetchInterval: 10000,
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase
        .from("automation_runs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as any[]);
    }
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: any) => {
      const supabase = await getBrowserSupabase();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("automation_config" as any)
        .upsert({ ...newConfig, user_id: user.user.id, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-config"] });
      toast.success("Settings updated");
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const toggleAutomation = () => {
    const safeConfig = config ?? {
      enabled: false,
      icp: { titles: [], industries: [], geos: [], keywords: [], size: "", service: "", limit: 20 },
      sender_name: "",
      sender_company: "",
      sender_title: "",
      services_offered: "",
      daily_lead_limit: 20,
    };
    updateConfig.mutate({ ...safeConfig, enabled: !safeConfig.enabled });
  };

  const metrics = useMemo(() => {
    const safeRuns = runs ?? [];
    const totals = safeRuns.reduce(
      (acc, run: any) => {
        acc.leads += Number(run?.leads_sourced ?? 0);
        acc.sent += Number(run?.emails_sent ?? 0);
        acc.researched += Number(run?.leads_researched ?? 0);
        return acc;
      },
      { leads: 0, sent: 0, researched: 0 }
    );

    const latest = safeRuns[0];
    const active = safeRuns.find((r: any) => r?.status === "running");

    return {
      totals,
      latest,
      active,
      completedCount: safeRuns.filter((r: any) => r?.status === "completed").length,
      failedCount: safeRuns.filter((r: any) => r?.status === "failed").length,
    };
  }, [runs]);

  const latestLogs: string[] = Array.isArray(metrics.latest?.logs) ? metrics.latest.logs : [];

  if (configLoading) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="size-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="Autonomous Engine" 
          description="WarmBase runs 24/7 sourcing, researching, and reaching out to leads automatically." 
        />
        <div className={`flex items-center gap-3 p-1.5 pr-4 rounded-full border transition-all duration-300 ${config?.enabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
          <Button 
            onClick={toggleAutomation}
            variant={config?.enabled ? "default" : "secondary"}
            className={`rounded-full size-10 p-0 shadow-lg ${config?.enabled ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
          >
            {config?.enabled ? <Pause className="size-5" /> : <Play className="size-5 ml-1" />}
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">{config?.enabled ? 'Engine Active' : 'Engine Paused'}</span>
            <span className="text-[10px] uppercase tracking-widest opacity-60 font-medium">{config?.enabled ? 'Running 24/7' : 'Static Mode'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border bg-card shadow-sm relative group overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-emerald-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <CardHeader className="relative z-10 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="size-5 text-emerald-400" /> Target ICP & Offering
              </CardTitle>
              <CardDescription>Scale your outreach with an agent that understands your value props.</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Settings className="size-4 mr-2" /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="relative z-10">
            {isEditing ? (
              <form className="space-y-6 relative z-10" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const parsedLimit = Math.min(40, Math.max(5, Number(formData.get("limit")) || 20));
                const newConfig = {
                  ...config,
                  sender_name: formData.get("name") as string,
                  sender_company: formData.get("company") as string,
                  sender_title: formData.get("sender_title") as string,
                  services_offered: formData.get("services") as string,
                  daily_lead_limit: parsedLimit,
                  icp: {
                    ...(config?.icp ?? { titles: [], industries: [], geos: [], keywords: [], size: "", service: "", limit: 20 }),
                    service: (formData.get("services") as string) || "",
                    titles: (formData.get("titles") as string).split(",").map(s => s.trim()).filter(Boolean),
                    industries: (formData.get("industries") as string).split(",").map(s => s.trim()).filter(Boolean),
                    geos: (formData.get("geos") as string).split(",").map(s => s.trim()).filter(Boolean),
                    keywords: (formData.get("keywords") as string).split(",").map(s => s.trim()).filter(Boolean),
                    size: (formData.get("size") as string).trim(),
                    limit: parsedLimit,
                  }
                };
                updateConfig.mutate(newConfig);
              }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Your Name</Label>
                    <Input name="name" defaultValue={config?.sender_name} placeholder="e.g. John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input name="company" defaultValue={config?.sender_company} placeholder="e.g. WarmBase AI" />
                  </div>
                  <div className="space-y-2">
                    <Label>Your Title</Label>
                    <Input name="sender_title" defaultValue={config?.sender_title} placeholder="e.g. Founder" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Core Services & Value Props</Label>
                  <Textarea 
                    name="services" 
                    className="min-h-[120px]" 
                    defaultValue={config?.services_offered} 
                    placeholder="Describe exactly what your service provider/agency does. The AI uses this to find matches and write emails."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Titles (comma separated)</Label>
                    <Input name="titles" defaultValue={config?.icp?.titles?.join(", ")} placeholder="CEO, Founder, Head of Growth" />
                  </div>
                  <div className="space-y-2">
                    <Label>Industries (comma separated)</Label>
                    <Input name="industries" defaultValue={config?.icp?.industries?.join(", ")} placeholder="SaaS, E-commerce, Logistics" />
                  </div>
                  <div className="space-y-2">
                    <Label>Geographies (comma separated)</Label>
                    <Input name="geos" defaultValue={config?.icp?.geos?.join(", ")} placeholder="United States, Germany" />
                  </div>
                  <div className="space-y-2">
                    <Label>Keywords (comma separated)</Label>
                    <Input name="keywords" defaultValue={config?.icp?.keywords?.join(", ")} placeholder="hiring, scaling, outbound" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <Input name="size" defaultValue={config?.icp?.size || ""} placeholder="e.g. 11-50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Limit / Run</Label>
                    <Input name="limit" type="number" min={5} max={40} defaultValue={config?.icp?.limit ?? config?.daily_lead_limit ?? 20} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button type="submit" disabled={updateConfig.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                    {updateConfig.isPending && <Loader2 className="size-4 mr-2 animate-spin" />} Update Configuration
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Targeting Strategy</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Users className="size-4 opacity-40" />
                        <span className="text-sm font-medium tracking-tight">{config?.icp?.titles?.join(", ") || "No titles set"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Zap className="size-4 opacity-40" />
                        <span className="text-sm font-medium tracking-tight">{config?.icp?.industries?.join(", ") || "No industries set"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Identity Profile</h4>
                    <div className="space-y-1">
                      <p className="text-base font-semibold">{config?.sender_name || "Unset"}</p>
                      <p className="text-sm opacity-50">{config?.sender_company || "Unset"}</p>
                      <p className="text-xs opacity-40">{config?.sender_title || "Title unset"}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Offer Reasoning</h4>
                   <p className="text-sm leading-relaxed opacity-70 italic font-medium">"{config?.services_offered || "Add your service description to start autonomous outreach."}"</p>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                     <p className="text-xs opacity-60"><span className="opacity-40">Geos:</span> {config?.icp?.geos?.join(", ") || "Any"}</p>
                     <p className="text-xs opacity-60"><span className="opacity-40">Keywords:</span> {config?.icp?.keywords?.join(", ") || "None"}</p>
                     <p className="text-xs opacity-60"><span className="opacity-40">Size / Limit:</span> {(config?.icp?.size || "Any")} / {config?.icp?.limit ?? config?.daily_lead_limit ?? 20}</p>
                   </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-xl">Loop Performance</CardTitle>
            <CardDescription>Metrics from background agent work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                    <Search className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-40 font-bold">New Leads</p>
                    <p className="text-xl font-bold tracking-tighter">{metrics.totals.leads}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                    <Mail className="size-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-40 font-bold">Sent</p>
                    <p className="text-xl font-bold tracking-tighter">{metrics.totals.sent}</p>
                  </div>
                </div>
             </div>
             <div className="pt-6 border-t border-border">
                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-5 flex items-center gap-2 opacity-50">
                   <History className="size-3" /> Recent Activity
                </h4>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="text-[10px] uppercase opacity-50">Completed</p>
                    <p className="text-sm font-semibold">{metrics.completedCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="text-[10px] uppercase opacity-50">Failed</p>
                    <p className="text-sm font-semibold">{metrics.failedCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="text-[10px] uppercase opacity-50">Researched</p>
                    <p className="text-sm font-semibold">{metrics.totals.researched}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {runs?.map(run => (
                    <div key={run.id} className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-[10px] opacity-30 font-medium">{new Date(run.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] opacity-50 mt-1 capitalize">{run.status}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/5 border-emerald-500/10 text-emerald-400/80 px-2 h-5">+{Number(run.leads_sourced ?? 0)} leads</Badge>
                        <Badge variant="outline" className="text-[10px] bg-blue-500/5 border-blue-500/10 text-blue-300/80 px-2 h-5">{Number(run.emails_sent ?? 0)} sent</Badge>
                        {run.status === 'completed' ? <CheckCircle2 className="size-4 text-emerald-500/60" /> : run.status === 'running' ? <Loader2 className="size-4 text-blue-400/80 animate-spin" /> : <XCircle className="size-4 text-rose-500/60" />}
                      </div>
                    </div>
                  ))}
                  {!runs?.length && <p className="text-xs opacity-60 py-4 text-center border border-dashed border-border rounded-xl">No runs yet. Start the engine to begin collecting live results.</p>}
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border">
          <CardTitle className="text-lg">Agent Logs</CardTitle>
          <CardDescription>
            {metrics.active
              ? "Live stream from current run."
              : metrics.latest
                ? `Latest run status: ${metrics.latest.status}`
                : "Raw processing history from autonomous runs."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-muted/30 font-mono text-[11px] p-6 h-72 overflow-y-auto custom-scrollbar">
             {latestLogs.length > 0 ? latestLogs.map((log: string, i: number) => (
               <div key={i} className="mb-2 flex gap-4">
                 <span className="text-emerald-500/40 shrink-0 select-none">
                  [{new Date(metrics.latest?.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                 </span> 
                 <span className="opacity-70 leading-relaxed">{log}</span>
               </div>
             )) : (
              <div className="text-muted-foreground text-center py-20 italic">
                {metrics.active ? "RUNNING... WAITING FOR LOG ENTRIES" : "NO RUN LOGS YET. ENABLE THE ENGINE TO START A LIVE LOOP."}
              </div>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
