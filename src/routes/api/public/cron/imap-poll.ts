// Cron-driven IMAP poller. Iterates all users with imap_enabled=true and
// processes new mail since their last UID.
// Auth: requires `Authorization: Bearer <CRON_SECRET>` — a server-only secret
// distinct from the public publishable key. The previous implementation
// accepted the publishable/anon key, which is embedded in the client bundle
// and therefore world-known; that allowed anyone to trigger server-wide IMAP
// polling. CRON_SECRET is server-only.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/imap-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
          ?? request.headers.get("x-cron-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { data: rows } = await supabaseAdmin
          .from("user_smtp_settings")
          .select("user_id")
          .eq("imap_enabled", true)
          .limit(50);

        const { pollImapForUser } = await import("@/lib/imap.server");
        let processed = 0;
        let failed = 0;
        for (const r of rows ?? []) {
          try {
            const res = await pollImapForUser(supabaseAdmin, r.user_id);
            if (res.ok) processed += res.processed;
            else failed++;
          } catch {
            failed++;
          }
        }
        // Return only aggregate counts — no per-user details, no error strings.
        return Response.json({ users: rows?.length ?? 0, processed, failed });
      },
    },
  },
});
