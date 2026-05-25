import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Linkedin, Globe, Map, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { INDUSTRIES, JOB_TITLES, COMPANY_SIZES, COUNTRIES, copyText } from "@/lib/coldbase-constants";
import { useAuth } from "@/hooks/use-auth";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/lead-finder")({ component: LeadFinder });

function LeadFinder() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ industry: "E-commerce", title: "CEO", location: "United States", size: "11-50", keywords: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [csv, setCsv] = useState("");

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const doCopy = (t: string, id: string) => { copyText(t); setCopied(id); toast.success("Copied"); setTimeout(() => setCopied(null), 1500); };

  const liUrl = useMemo(() => {
    const kw = [f.title, f.industry, f.keywords].filter(Boolean).join(" ");
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}&origin=GLOBAL_SEARCH_HEADER`;
  }, [f]);
  const liSalesUrl = useMemo(() => {
    const kw = [f.title, f.industry, f.keywords].filter(Boolean).join(" ");
    return `https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(kw)}`;
  }, [f]);
  const googleUrl = useMemo(() => {
    const q = `site:linkedin.com/in "${f.title}" "${f.industry}" "${f.location}" ${f.keywords}`;
    return `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
  }, [f]);
  const boolStr = useMemo(() => {
    const parts = [f.title ? `"${f.title}"` : "", f.industry ? `"${f.industry}"` : "", f.location ? `"${f.location}"` : ""].filter(Boolean);
    return `${parts.join(" AND ")}${f.keywords ? ` AND (${f.keywords.split(",").map((k) => `"${k.trim()}"`).join(" OR ")})` : ""}`;
  }, [f]);
  const apolloUrl = useMemo(() => `https://app.apollo.io/#/people?qKeywords=${encodeURIComponent(f.title + " " + f.industry)}&personLocations[]=${encodeURIComponent(f.location)}`, [f]);
  const mapsUrl = useMemo(() => `https://www.google.com/maps/search/${encodeURIComponent(f.industry + " " + f.location)}`, [f]);

  const importCsv = useMutation({
    mutationFn: async () => {
      const supabase = await getBrowserSupabase();
      const lines = csv.trim().split("\n").filter(Boolean);
      if (!lines.length) throw new Error("Empty CSV");
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const [contact, company, title, email, phone, niche] = cols;
        return { user_id: user!.id, contact: contact || "Unknown", company: company || null, title: title || null, email: email || null, phone: phone || null, niche: niche || null, status: "new" as const };
      }).filter((r) => r.contact && r.contact !== "Unknown");
      if (!rows.length) throw new Error("No valid rows");
      const { error } = await supabase.from("leads").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`Imported ${n} leads`); setCsv(""); qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message || "Import failed"),
  });

  const SearchRow = ({ id, icon, label, url }: { id: string; icon: any; label: string; url: string }) => {
    const Icon = icon;
    return (
      <div className="flex items-center gap-2 p-3 border rounded-md">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground truncate">{url}</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => doCopy(url, id)}>
          {copied === id ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
        <Button size="sm" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Lead Finder" description="Build prospecting search URLs and Boolean strings, or import a CSV." />
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1.5"><Label>Industry</Label>
            <Select value={f.industry} onValueChange={set("industry")}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Title</Label>
            <Select value={f.title} onValueChange={set("title")}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JOB_TITLES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Location</Label>
            <Select value={f.location} onValueChange={set("location")}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Size</Label>
            <Select value={f.size} onValueChange={set("size")}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMPANY_SIZES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Keywords</Label>
            <Input value={f.keywords} onChange={(e) => set("keywords")(e.target.value)} placeholder="e.g. fintech" /></div>
        </div>
      </Card>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search URLs</TabsTrigger>
          <TabsTrigger value="bool">Boolean</TabsTrigger>
          <TabsTrigger value="import">CSV import</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="space-y-2 mt-3">
          <SearchRow id="li" icon={Linkedin} label="LinkedIn People" url={liUrl} />
          <SearchRow id="lis" icon={Linkedin} label="LinkedIn Sales Navigator" url={liSalesUrl} />
          <SearchRow id="g" icon={Globe} label="Google X-ray" url={googleUrl} />
          <SearchRow id="ap" icon={Globe} label="Apollo.io" url={apolloUrl} />
          <SearchRow id="map" icon={Map} label="Google Maps" url={mapsUrl} />
        </TabsContent>
        <TabsContent value="bool" className="mt-3">
          <Card className="p-4">
            <Label className="text-xs">Boolean search string</Label>
            <Textarea value={boolStr} readOnly rows={4} className="mt-1 font-mono text-xs" />
            <Button size="sm" className="mt-2" onClick={() => doCopy(boolStr, "bool")}>
              {copied === "bool" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
            </Button>
          </Card>
        </TabsContent>
        <TabsContent value="import" className="mt-3">
          <Card className="p-4 space-y-3">
            <div>
              <Label className="text-xs flex items-center gap-2"><FileSpreadsheet className="size-4" /> CSV format: contact,company,title,email,phone,niche (header row required)</Label>
              <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={"contact,company,title,email,phone,niche\nJohn Doe,Acme,CEO,john@acme.com,+15551234567,SaaS"} className="font-mono text-xs mt-2" />
            </div>
            <Button onClick={() => importCsv.mutate()} disabled={importCsv.isPending}>
              {importCsv.isPending && <Loader2 className="size-4 animate-spin" />} Import
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
