// Cron-driven IMAP poller. Iterates all users with imap_enabled=true and
// processes new mail since their last UID. Authenticated with anon/publishable key.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/imap-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (key !== process.env.SUPABASE_PUBLISHABLE_KEY && key !== process.env.SUPABASE_ANON_KEY) {
          return new Response("unauthorized", { status: 401 });
        }
        const { data: rows } = await supabaseAdmin
          .from("user_smtp_settings")
          .select("user_id")
          .eq("imap_enabled", true)
          .limit(50);

        const { pollImapForUser } = await import("@/lib/imap.server");
        const results: { user_id: string; ok: boolean; processed: number; error?: string }[] = [];
        for (const r of rows ?? []) {
          try {
            const res = await pollImapForUser(supabaseAdmin, r.user_id);
            results.push({ user_id: r.user_id, ...res });
          } catch (e: any) {
            results.push({ user_id: r.user_id, ok: false, processed: 0, error: String(e?.message ?? e).slice(0, 200) });
          }
        }
        return Response.json({ users: results.length, results });
      },
    },
  },
});
