import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,Arial,sans-serif;background:#0b0d10;color:#e7e9ec;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{max-width:480px;width:100%;background:#15181d;border:1px solid #2a2f37;border-radius:16px;padding:28px;text-align:center}
h1{font-size:20px;margin:0 0 8px} p{color:#9ca3af;line-height:1.5;margin:0}
</style></head><body><div class="card">${body}</div></body></html>`;
}

export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        if (!token || !/^[a-f0-9]{20,64}$/i.test(token)) {
          return new Response(htmlPage("Unsubscribe", "<h1>Invalid link</h1><p>This unsubscribe link is malformed.</p>"), {
            status: 400, headers: { "Content-Type": "text/html" },
          });
        }
        try {
          const { data: tok } = await supabaseAdmin
            .from("email_unsub_tokens")
            .select("user_id, email")
            .eq("token", token)
            .maybeSingle();
          if (!tok) {
            return new Response(htmlPage("Unsubscribe", "<h1>Link expired</h1><p>We couldn't find this unsubscribe link.</p>"), {
              status: 404, headers: { "Content-Type": "text/html" },
            });
          }
          await supabaseAdmin
            .from("unsubscribes")
            .upsert({ user_id: tok.user_id, email: tok.email, reason: "one-click" }, { onConflict: "user_id,email" });
          await supabaseAdmin.from("email_events").insert({
            user_id: tok.user_id,
            event_type: "unsubscribed",
            subject: "Unsubscribe",
            metadata: { email: tok.email, token },
          });
          return new Response(
            htmlPage(
              "Unsubscribed",
              `<h1>You're unsubscribed</h1><p><strong>${tok.email}</strong> will no longer receive emails from this sender.</p>`,
            ),
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        } catch (e) {
          console.error("unsubscribe failed", e);
          return new Response(htmlPage("Unsubscribe", "<h1>Something went wrong</h1><p>Please try again later.</p>"), {
            status: 500, headers: { "Content-Type": "text/html" },
          });
        }
      },
    },
  },
});
