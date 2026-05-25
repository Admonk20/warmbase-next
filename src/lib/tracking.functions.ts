import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAppBaseUrl } from "./email-tracking.server";

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

/**
 * Wrap all http(s) links in an email body with tracked redirect URLs.
 * Returns the rewritten body and the inserted token list.
 */
export const wrapTrackedLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    body: z.string().max(40000),
    leadId: z.string().uuid().optional(),
    campaignId: z.string().uuid().optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    const baseUrl = getAppBaseUrl();
    const urlRe = /\bhttps?:\/\/[^\s<>"')]+/g;
    const inserts: Array<{ user_id: string; token: string; target_url: string; lead_id: string | null; campaign_id: string | null }> = [];
    const wrapped = data.body.replace(urlRe, (url) => {
      // Skip our own tracking pixel / unsubscribe links to avoid double-wrapping
      if (url.includes("/api/public/track/") || url.includes("/api/public/unsubscribe") || url.includes("/api/public/t/")) {
        return url;
      }
      const token = newToken();
      inserts.push({
        user_id: context.userId, token, target_url: url,
        lead_id: data.leadId ?? null, campaign_id: data.campaignId ?? null,
      });
      return `${baseUrl}/api/public/t/${token}`;
    });
    if (inserts.length > 0) {
      await context.supabase.from("tracked_links").insert(inserts);
    }
    return { body: wrapped, count: inserts.length };
  });

export const linkClickStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(1).max(365).default(30) }).parse)
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows } = await context.supabase.from("tracked_links")
      .select("target_url, click_count, last_clicked_at")
      .eq("user_id", context.userId)
      .gte("created_at", since)
      .order("click_count", { ascending: false })
      .limit(50);
    return { links: rows ?? [] };
  });
