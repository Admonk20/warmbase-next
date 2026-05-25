import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Resend webhook receiver. Configure in Resend dashboard:
 *   URL:  https://<your-domain>/api/public/hooks/email-events
 *   Send the signing secret via the `X-Webhook-Key` header (header-only;
 *   query-param auth is rejected to keep the secret out of access logs).
 */
export const Route = createFileRoute("/api/public/hooks/email-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-key");
        const expected = process.env.RESEND_WEBHOOK_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = (await request.json().catch(() => null)) as
          | { type?: string; data?: { email_id?: string; to?: string | string[]; bounce?: { type?: string }; reason?: string } }
          | null;
        if (!payload?.type || !payload.data) {
          return new Response("Bad payload", { status: 400 });
        }

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const toRaw = Array.isArray(payload.data.to) ? payload.data.to[0] : payload.data.to;
        const to = (toRaw ?? "").toLowerCase();
        const emailId = payload.data.email_id ?? "";

        // Find the originating sent event to recover user_id / lead_id / campaign_id
        const { data: origin } = await admin
          .from("email_events")
          .select("user_id, lead_id, campaign_id, subject")
          .eq("event_type", "sent")
          .filter("metadata->>provider_id", "eq", emailId)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!origin) {
          // Still 200 so Resend doesn't retry indefinitely
          return Response.json({ ok: true, matched: false });
        }

        const map: Record<string, "bounced" | "complained" | "opened" | "clicked" | "failed"> = {
          "email.bounced": "bounced",
          "email.complained": "complained",
          "email.opened": "opened",
          "email.clicked": "clicked",
          "email.delivery_delayed": "failed",
        };
        const evtType = map[payload.type];
        if (!evtType) return Response.json({ ok: true, ignored: payload.type });

        await admin.from("email_events").insert({
          user_id: origin.user_id,
          lead_id: origin.lead_id,
          campaign_id: origin.campaign_id,
          event_type: evtType,
          subject: origin.subject,
          metadata: { to, provider_id: emailId, source: "resend_webhook", raw: payload.data },
        });

        // Auto-suppress hard bounces and complaints
        const bounceType = payload.data.bounce?.type ?? "";
        const isHard = evtType === "bounced" && /hard|permanent/i.test(bounceType);
        if (isHard || evtType === "complained") {
          await admin.from("suppressions").upsert({
            user_id: origin.user_id,
            email: to,
            reason: evtType,
            source: "resend_webhook",
          }, { onConflict: "user_id,email" });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
