import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", company: "", title: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const supabase = await getBrowserSupabase();
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) setProfile({ full_name: data.full_name || "", company: data.company || "", title: data.title || "" });
      setLoading(false);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const supabase = await getBrowserSupabase();
    const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="Your profile and workspace preferences." />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Used as the sender identity for outbound emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div className="space-y-1.5"><Label>Full name</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Company</Label><Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Title</Label><Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></div>
              </div>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} Save</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
