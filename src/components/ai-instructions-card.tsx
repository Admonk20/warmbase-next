import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Sparkles } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const PLACEHOLDER = `Examples:
- Always mention I'm based in Lagos and work with West African SMEs.
- Use British spelling.
- Keep the CTA to a Loom video review instead of a call.
- Never mention pricing in the first email.
- My service is fractional CMO work — frame everything around that.`;

export function AiInstructionsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ai-instructions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = await getBrowserSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .select("ai_email_instructions")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.ai_email_instructions ?? "";
    },
  });

  useEffect(() => {
    if (typeof data === "string") setValue(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, ai_email_instructions: value.trim() || null } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("AI instructions saved");
      qc.invalidateQueries({ queryKey: ["ai-instructions", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4" /> AI email drafter — custom instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These instructions are added to every email the AI drafts. Use them to lock in your voice,
          your service, banned words, signature style, or anything else the AI should always remember.
        </p>
        <div className="space-y-1.5">
          <Label>Custom instructions</Label>
          <Textarea
            rows={10}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PLACEHOLDER}
            disabled={isLoading}
            maxLength={4000}
          />
          <p className="text-xs text-muted-foreground">{value.length}/4000 characters</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save instructions
        </Button>
      </CardContent>
    </Card>
  );
}
