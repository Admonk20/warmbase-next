// Engagement score recalculation. Score 0-100 with time decay.
// + opens (2 each, max 10), clicks (5 each, max 20), replies (40),
// + ICP score from sourcing (0-10 scaled), - bounces/unsubscribes.
// Decay: -1 per 7 days since last_engaged_at.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function recomputeLeadScore(supabase: SupabaseClient, leadId: string) {
  const { data: events } = await supabase
    .from("email_events")
    .select("event_type, occurred_at")
    .eq("lead_id", leadId);
  let opens = 0, clicks = 0, replies = 0, bounces = 0, unsubs = 0;
  let lastEngaged: string | null = null;
  for (const e of events ?? []) {
    if (e.event_type === "opened") opens++;
    else if (e.event_type === "clicked") clicks++;
    else if (e.event_type === "replied") replies++;
    else if (e.event_type === "bounced") bounces++;
    else if (e.event_type === "unsubscribed") unsubs++;
    if (["opened","clicked","replied"].includes(e.event_type as string)) {
      if (!lastEngaged || e.occurred_at! > lastEngaged) lastEngaged = e.occurred_at!;
    }
  }
  let score = Math.min(10, opens * 2) + Math.min(20, clicks * 5) + (replies > 0 ? 40 : 0);
  score -= bounces * 15 + unsubs * 30;
  if (lastEngaged) {
    const days = (Date.now() - new Date(lastEngaged).getTime()) / 86400000;
    score -= Math.floor(days / 7);
  }
  score = Math.max(0, Math.min(100, score));
  await supabase.from("leads").update({
    engagement_score: score,
    last_engaged_at: lastEngaged,
    replied_at: replies > 0 ? lastEngaged : null,
    temperature: score >= 60 ? "hot" : score >= 30 ? "warm" : "cold",
  }).eq("id", leadId);
  return score;
}

export async function recomputeAllScores(supabase: SupabaseClient, userId: string) {
  const { data: leads } = await supabase.from("leads").select("id").eq("user_id", userId);
  let n = 0;
  for (const l of leads ?? []) { await recomputeLeadScore(supabase, l.id); n++; }
  return n;
}
