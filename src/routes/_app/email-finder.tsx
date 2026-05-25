import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Mail, Download, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { genEmails, csvExport, copyText } from "@/lib/coldbase-constants";
import { verifyEmail } from "@/lib/email.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email-finder")({ component: EmailFinder });

function EmailFinder() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState<{ id: string; label: string; email: string }[]>([]);
  const [verifyMap, setVerifyMap] = useState<Record<string, { valid: boolean; reason: string }>>({});
  const [bulk, setBulk] = useState("");
  const [bulkRes, setBulkRes] = useState<{ name: string; emails: string[] }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const verifyFn = useServerFn(verifyEmail);
  const verify = useMutation({
    mutationFn: (email: string) => verifyFn({ data: { email } }),
    onSuccess: (data, email) => setVerifyMap((p) => ({ ...p, [email]: { valid: data.valid, reason: data.reason } })),
    onError: (e: any) => toast.error(e?.message ?? "Verify failed"),
  });

  const doCopy = (t: string, id: string) => { copyText(t); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  const find = () => setResults(genEmails(first, last, domain));

  const findBulk = () => {
    const lines = bulk.trim().split("\n").filter(Boolean);
    const res = lines.slice(1).map((line) => {
      const [f, l, d] = line.split(",").map((s) => s.trim());
      const emails = genEmails(f || "", l || "", d || "").map((r) => r.email);
      return { name: `${f} ${l}`, emails };
    });
    setBulkRes(res);
  };

  const exportBulk = () => {
    const rows: any[][] = [["name", ...Array.from({ length: 10 }, (_, i) => `email_${i + 1}`)]];
    bulkRes.forEach((r) => rows.push([r.name, ...r.emails]));
    csvExport(rows, "emails.csv");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Email Finder" description="Generate likely email patterns from a name and domain, then verify." />
      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="bulk">Bulk (CSV)</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-3 space-y-3">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5"><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Domain</Label><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" /></div>
              <Button onClick={find}>Generate</Button>
            </div>
          </Card>
          {results.length > 0 && (
            <Card className="p-2">
              <div className="space-y-1">
                {results.map((r) => {
                  const v = verifyMap[r.email];
                  return (
                    <div key={r.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 rounded">
                      <Badge variant="outline" className="font-mono text-xs">{r.label}</Badge>
                      <span className="flex-1 font-mono text-sm">{r.email}</span>
                      {v && <Badge className={v.valid ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}>{v.reason}</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => verify.mutate(r.email)} disabled={verify.isPending}>
                        {verify.isPending && verify.variables === r.email ? <Loader2 className="size-3 animate-spin" /> : "Verify"}
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`mailto:${r.email}?subject=Quick%20test`}><Mail className="size-3" /></a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => doCopy(r.email, r.id)}>
                        {copied === r.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="bulk" className="mt-3 space-y-3">
          <Card className="p-4 space-y-3">
            <Label className="text-xs">CSV: first,last,domain (header row required)</Label>
            <Textarea rows={6} className="font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"first,last,domain\nJohn,Doe,acme.com"} />
            <div className="flex gap-2">
              <Button onClick={findBulk}>Generate</Button>
              {bulkRes.length > 0 && <Button variant="outline" onClick={exportBulk}><Download className="size-4" /> Export CSV</Button>}
            </div>
          </Card>
          {bulkRes.length > 0 && (
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">{bulkRes.length} contact(s)</div>
              <div className="space-y-1">
                {bulkRes.map((r, i) => (
                  <div key={i} className="text-xs"><span className="font-medium">{r.name}:</span> <span className="font-mono text-muted-foreground">{r.emails.slice(0, 3).join(", ")}…</span></div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
