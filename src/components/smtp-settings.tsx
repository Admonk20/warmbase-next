import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Plug, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { getSmtpSettings, saveSmtpSettings, testSmtpConnection } from "@/lib/smtp.functions";
import { sendEmail } from "@/lib/email.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const PRESETS: Record<string, { host: string; port: number; secure: boolean; imap_host?: string }> = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false, imap_host: "imap.gmail.com" },
  outlook: { host: "smtp.office365.com", port: 587, secure: false, imap_host: "outlook.office365.com" },
  zoho: { host: "smtp.zoho.com", port: 587, secure: false, imap_host: "imap.zoho.com" },
  fastmail: { host: "smtp.fastmail.com", port: 465, secure: true, imap_host: "imap.fastmail.com" },
};

const empty = {
  host: "", port: 587, secure: false, username: "", password: "",
  from_email: "", from_name: "", reply_to: "",
  daily_cap: 50, warmup_enabled: true,
  imap_host: "", imap_port: 993, imap_username: "", imap_password: "", imap_enabled: false,
};

export function SmtpSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSmtpSettings);
  const saveFn = useServerFn(saveSmtpSettings);
  const testFn = useServerFn(testSmtpConnection);
  const sendFn = useServerFn(sendEmail);
  const [form, setForm] = useState(empty);
  const [testTo, setTestTo] = useState("");

  const { data } = useQuery({ queryKey: ["smtp"], queryFn: () => getFn() });
  useEffect(() => {
    if (data) setForm({
      ...empty,
      host: data.host, port: data.port, secure: data.secure, username: data.username,
      from_email: data.from_email, from_name: data.from_name ?? "", reply_to: data.reply_to ?? "",
      daily_cap: data.daily_cap, warmup_enabled: data.warmup_enabled,
      imap_host: data.imap_host ?? "", imap_port: data.imap_port ?? 993,
      imap_username: data.imap_username ?? "", imap_enabled: data.imap_enabled,
      password: "", imap_password: "",
    });
  }, [data]);

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const applyPreset = (k: string) => { const p = PRESETS[k]; if (p) set({ host: p.host, port: p.port, secure: p.secure, imap_host: p.imap_host ?? "" }); };

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...form, password: form.password || undefined, imap_password: form.imap_password || undefined } as any }),
    onSuccess: () => { toast.success("SMTP settings saved"); qc.invalidateQueries({ queryKey: ["smtp"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: () => testFn({ data: { ...form, password: form.password || undefined, imap_password: form.imap_password || undefined } as any }),
    onSuccess: (r: any) => r.ok ? toast.success("Connection OK") : toast.error("Failed: " + r.error),
    onError: (e: any) => toast.error(e.message),
  });
  const sendTest = useMutation({
    mutationFn: () => sendFn({ data: {
      to: testTo || form.from_email,
      subject: "ColdBase Pro — test email ✅",
      body: `If you can read this, your SMTP setup works.\n\nClick this tracked link to verify click tracking: https://example.com/coldbase-test\n\n— sent ${new Date().toLocaleString()}`,
      ignoreSendWindow: true,
    } }),
    onSuccess: () => toast.success("Test email sent — check your inbox"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="size-4" /> SMTP sending
          {data?.verified_at && <CheckCircle2 className="size-4 text-green-600" />}
          {data?.last_error && <AlertCircle className="size-4 text-destructive" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Presets:</span>
          {Object.keys(PRESETS).map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => applyPreset(k)}>{k}</Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>SMTP host</Label><Input value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.gmail.com" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.port} onChange={(e) => set({ port: +e.target.value })} /></div>
            <div className="space-y-1.5 flex flex-col"><Label>SSL (465)</Label><Switch checked={form.secure} onCheckedChange={(v) => set({ secure: v })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Username</Label><Input value={form.username} onChange={(e) => set({ username: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Password / App password</Label><Input type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder={data ? "(unchanged)" : ""} /></div>
          <div className="space-y-1.5"><Label>From email</Label><Input type="email" value={form.from_email} onChange={(e) => set({ from_email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>From name</Label><Input value={form.from_name} onChange={(e) => set({ from_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Reply-to (optional)</Label><Input value={form.reply_to} onChange={(e) => set({ reply_to: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Daily cap</Label><Input type="number" value={form.daily_cap} onChange={(e) => set({ daily_cap: +e.target.value })} /></div>
            <div className="space-y-1.5 flex flex-col"><Label>Warm-up</Label><Switch checked={form.warmup_enabled} onCheckedChange={(v) => set({ warmup_enabled: v })} /></div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div><Label>IMAP reply tracking</Label><p className="text-xs text-muted-foreground">Auto-detect replies and mark leads as engaged.</p></div>
            <Switch checked={form.imap_enabled} onCheckedChange={(v) => set({ imap_enabled: v })} />
          </div>
          {form.imap_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>IMAP host</Label><Input value={form.imap_host} onChange={(e) => set({ imap_host: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>IMAP port</Label><Input type="number" value={form.imap_port} onChange={(e) => set({ imap_port: +e.target.value })} /></div>
              <div className="space-y-1.5"><Label>IMAP username</Label><Input value={form.imap_username} onChange={(e) => set({ imap_username: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>IMAP password</Label><Input type="password" value={form.imap_password} onChange={(e) => set({ imap_password: e.target.value })} placeholder={data?.imap_username ? "(unchanged)" : ""} /></div>
            </div>
          )}
        </div>

        {data?.last_error && <p className="text-xs text-destructive">Last error: {data.last_error}</p>}

        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />}<Save className="size-4" /> Save</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>{test.isPending && <Loader2 className="size-4 animate-spin" />} Test connection</Button>
        </div>

        <div className="border-t pt-3 space-y-2">
          <Label className="text-sm">Send a real test email</Label>
          <p className="text-xs text-muted-foreground">Sends via your saved SMTP. Includes a tracked link so you can verify the redirect endpoint. Leave blank to send to your "from" address.</p>
          <div className="flex gap-2">
            <Input type="email" placeholder={form.from_email || "you@example.com"} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Button variant="secondary" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !data}>
              {sendTest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
