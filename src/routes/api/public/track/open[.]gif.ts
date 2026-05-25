import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const Route = createFileRoute("/api/public/track/open.gif")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const mid = url.searchParams.get("m");
          if (mid && /^[a-f0-9]{6,64}$/i.test(mid)) {
            // Look up the email_events row tagged with this message_id to set lead/user/campaign
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
                event_type: "opened",
                subject: prior.subject,
                metadata: { message_id: mid, ua: request.headers.get("user-agent") ?? null },
              });
            }
          }
        } catch (e) {
          console.error("open tracking failed", e);
        }
        return new Response(new Uint8Array(PIXEL), {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Content-Length": String(PIXEL.length),
          },
        });
      },
    },
  },
});
