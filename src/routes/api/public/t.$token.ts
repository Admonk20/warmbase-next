import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/** Public click-tracking redirect. /api/public/t/:token → 302 to target_url, logs click. */
export const Route = createFileRoute("/api/public/t/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length > 32) {
          return new Response("Bad token", { status: 400 });
        }
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );
        const { data: link } = await admin.from("tracked_links")
          .select("id, user_id, target_url, lead_id, campaign_id, click_count")
          .eq("token", token).maybeSingle();
        if (!link) return new Response("Not found", { status: 404 });

        // Fire-and-forget logging
        const logPromise = Promise.all([
          admin.from("tracked_links")
            .update({ click_count: (link.click_count ?? 0) + 1, last_clicked_at: new Date().toISOString() })
            .eq("id", link.id),
          admin.from("email_events").insert({
            user_id: link.user_id, lead_id: link.lead_id, campaign_id: link.campaign_id,
            event_type: "clicked", subject: null,
            metadata: { token, target_url: link.target_url },
          }),
        ]);
        // Don't await — keep redirect snappy. Workers will await this naturally if needed.
        try { await Promise.race([logPromise, new Promise((r) => setTimeout(r, 300))]); } catch {}

        return new Response(null, { status: 302, headers: { Location: link.target_url, "Cache-Control": "no-store" } });
      },
    },
  },
});
