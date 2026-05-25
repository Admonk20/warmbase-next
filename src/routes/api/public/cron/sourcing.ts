// Cron-driven background worker for sourcing runs. Picks up to N queued/running
// runs and advances each by one step. Authenticated with the Supabase anon key.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/sourcing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (key !== process.env.SUPABASE_PUBLISHABLE_KEY && key !== process.env.SUPABASE_ANON_KEY) {
          return new Response("unauthorized", { status: 401 });
        }
        const { data: runs } = await supabaseAdmin
          .from("sourcing_runs")
          .select("id, user_id")
          .in("status", ["queued", "running"])
          .order("updated_at", { ascending: true })
          .limit(5);

        const { runSourcingStepInternal } = await import("@/lib/sourcing.server");
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const r of runs ?? []) {
          try {
            await runSourcingStepInternal(supabaseAdmin, r.id, r.user_id);
            results.push({ id: r.id, ok: true });
          } catch (e: any) {
            results.push({ id: r.id, ok: false, error: String(e?.message ?? e).slice(0, 200) });
          }
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
