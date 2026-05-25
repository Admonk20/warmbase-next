import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/track/click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mid = url.searchParams.get("m");
        const target = url.searchParams.get("u");
        let dest = "/";
        if (target) {
          try {
            const parsed = new URL(decodeURIComponent(target));
            if (parsed.protocol === "http:" || parsed.protocol === "https:") {
              dest = parsed.toString();
            }
          } catch {
            /* keep dest */
          }
        }
        try {
          if (mid && /^[a-f0-9]{6,64}$/i.test(mid)) {
            const { data: prior } = await supabaseAdmin
              .from("email_events")
              .select("user_id, lead_id, campaign_id, subject")
              .contains("metadata", { message_id: mid })
              .limit(1)
              .maybeSingle();
            if (prior) {
              await supabaseAdmin.from("email_events").insert({
                user_id: prior.user_id,
                lead_id: prior.lead_id,
                campaign_id: prior.campaign_id,
                event_type: "clicked",
                subject: prior.subject,
                metadata: { message_id: mid, url: dest },
              });
            }
          }
        } catch (e) {
          console.error("click tracking failed", e);
        }
        return new Response(null, {
          status: 302,
          headers: { Location: dest, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
