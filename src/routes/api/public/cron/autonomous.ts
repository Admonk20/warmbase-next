import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runAutonomousEngine } from "@/lib/autonomous-engine";

export const Route = createFileRoute("/api/public/cron/autonomous")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
          ?? request.headers.get("x-cron-key");
        
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          console.log("Starting WarmBase autonomous engine cron run...");
          await runAutonomousEngine(supabaseAdmin);
          return Response.json({ ok: true, timestamp: new Date().toISOString() });
        } catch (err: any) {
          console.error("Cron failed:", err);
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }
  }
});
