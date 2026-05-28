import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Plus, Trash2, KeyRound } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { SmtpSettingsCard } from "@/components/smtp-settings";
import { SuppressionsCard } from "@/components/suppressions-card";
import { SendPreferencesCard } from "@/components/send-preferences-card";
import { InboxHealthCard } from "@/components/inbox-health-card";
import { AiInstructionsCard } from "@/components/ai-instructions-card";
import { saveUserApiKey, deleteUserApiKey } from "@/lib/api-keys.functions";



export const Route = createFileRoute("/_app/settings")({ component: Settings });

const PROVIDERS = [
  { id: "kimi", label: "Kimi (Moonshot)", desc: "Priority #1. platform.moonshot.ai. Uses moonshot-v1-8k." },
  { id: "claude", label: "Claude (Anthropic)", desc: "Priority #2. console.anthropic.com. Uses claude-3-5-sonnet-20240620." },
  { id: "openai", label: "OpenAI", desc: "Priority #3. platform.openai.com. Uses gpt-4o-mini." },
  { id: "resend", label: "Resend", desc: "Optional fallback if you don't configure SMTP. resend.com/api-keys" },
  { id: "hunter", label: "Hunter.io", desc: "Optional. Email finder + verifier. hunter.io/api" },
  { id: "serper", label: "Serper.dev", desc: "Optional. Google search for Lead Finder. serper.dev" },
] as const;

function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ full_name: "", company: "", title: "" });
  const [keyForm, setKeyForm] = useState({ provider: "openai", value: "", label: "" });

  const { data: prof } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { if (prof) setProfile({ full_name: prof.full_name ?? "", company: prof.company ?? "", title: prof.title ?? "" }); }, [prof]);

  const { data: keys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase.from("user_api_keys").select("id, provider, label, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.from("profiles").upsert({ id: user!.id, ...profile });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addKey = useMutation({
    mutationFn: async () => {
      if (!keyForm.value.trim()) throw new Error("Value required");
      await saveUserApiKey({ data: { provider: keyForm.provider as any, value: keyForm.value.trim(), label: keyForm.label || null } });
    },
    onSuccess: () => { toast.success("Key added"); setKeyForm({ provider: "openai", value: "", label: "" }); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeKey = useMutation({
    mutationFn: async (id: string) => {
      await deleteUserApiKey({ data: { id } });
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Your sender identity and API integrations." />

      <Card>
        <CardHeader><CardTitle className="text-base">Sender identity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></div>
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending && <Loader2 className="size-4 animate-spin" />} <Save className="size-4" /> Save
          </Button>
        </CardContent>
      </Card>

      <SmtpSettingsCard />

      <SuppressionsCard />

      <SendPreferencesCard />

      <InboxHealthCard />

      <AiInstructionsCard />




      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="size-4" /> API keys</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px_auto] gap-2 items-end">
            <div className="space-y-1.5"><Label>Provider</Label>
              <Select value={keyForm.provider} onValueChange={(v) => setKeyForm({ ...keyForm, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Value</Label><Input type="password" value={keyForm.value} onChange={(e) => setKeyForm({ ...keyForm, value: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Label (optional)</Label><Input value={keyForm.label} onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })} placeholder="e.g. personal" /></div>
            <Button onClick={() => addKey.mutate()} disabled={addKey.isPending}>{addKey.isPending && <Loader2 className="size-4 animate-spin" />}<Plus className="size-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">{PROVIDERS.find((p) => p.id === keyForm.provider)?.desc}</p>

          {keys?.length ? (
            <div className="space-y-1">
              {keys.map((k: any) => (
                <div key={k.id} className="flex items-center gap-3 p-2 border rounded-md">
                  <span className="text-sm font-medium w-20">{k.provider}</span>
                  <span className="text-xs text-muted-foreground flex-1">{k.label || "—"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeKey.mutate(k.id)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No keys yet. The app works without keys — AI uses the Lovable AI Gateway, and email sends via your own SMTP (configure it in the SMTP tab above). Resend is only an optional fallback.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
