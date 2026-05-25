# Status of the original 15

Shipped (infra + wiring):
1. Per-user SMTP settings (UI + encrypted storage)
2. Warm-up ramp + daily caps
3. AI reply classification → auto status updates
4. Engagement scoring (0–100 hotness, time-decayed)
5. Spintax + nested variables engine
6. Reusable email snippets
7. Duplicate detection + merge
8. Email finder (pattern guessing + MX validation)
9. AES-GCM credential encryption
10. IMAP reply polling
11. A/B test framework + auto-winner promotion
12. CSV exports (leads + activity)
13. Weekly digest stats
14. IMAP cron endpoint
15. Reports page UI

Partial / not wired end-to-end:
- Sourcing background cron (helper exists, no pg_cron schedule yet)
- Kanban multi-select bar (data model ready, UI not built)
- pg_cron schedules for `/api/public/cron/imap-poll` (needs SQL after publish)

---

# Next 15 upgrades

Grouped so we can ship in phases without breaking existing flows.

### Deliverability & sending (1–4)
1. **Bounce/complaint webhook** — `/api/public/hooks/email-events` to ingest Resend/SMTP bounces, auto-suppress hard bounces, decrement reputation.
2. **Suppression list** — global `suppressions` table (bounced, complained, manual). `sendEmail` checks before every send.
3. **Send-time optimization** — per-lead timezone + best-hour heuristic from past open events; queue sends to land 9–11am local.
4. **Link tracking + click attribution** — rewrite outbound links through `/api/public/t/:token`, log click events, attribute to lead/campaign.

### Sequences & campaigns (5–8)
5. **Sequence builder UI** — drag-to-reorder steps, per-step delay, A/B subject, conditional branches (replied → stop).
6. **Campaign scheduler** — start/end window, daily quota per campaign, throttle (e.g. 1 email / 90s) to look human.
7. **Reply-aware pause** — when a lead replies or books, auto-pause their sequence across all campaigns.
8. **Holiday / weekend skip** — per-user calendar of skip dates; sender respects them.

### Lead intelligence (9–11)
9. **Company enrichment** — on lead create, call Firecrawl on the company domain → fill industry, size hint, tech stack into `leads.metadata`.
10. **LinkedIn snapshot** — store last scraped headline/role/recent post for personalization tokens (`{{recent_post}}`).
11. **Saved views & smart segments** — filter combos saved as named views ("Hot SaaS founders", "Stale 30d+"), used as send targets.

### Pipeline & collaboration (12–13)
12. **Tasks & reminders** — `tasks` table linked to leads, due dates, snooze, dashboard "Today" widget.
13. **Team workspaces** — `workspaces` + `workspace_members` with roles (owner/admin/member); RLS scoped to workspace, not just user.

### Analytics & growth (14–15)
14. **Inbox health monitor** — daily IMAP check of spam folder via seed inboxes; surface placement % on dashboard.
15. **Funnel & cohort analytics** — sent → opened → replied → meeting → won, by campaign and by week cohort, on the Reports page.

---

## Technical notes

- All new tables get RLS scoped by `auth.uid()` (or `workspace_id` once #13 lands).
- Webhooks under `/api/public/hooks/*` with HMAC verification.
- Link tracker uses short tokens stored in a `tracked_links` table; redirect is a 302 with click logged async.
- Send-time optimization runs in the existing send loop — no new cron needed beyond what we have.
- #13 (workspaces) is the biggest migration; recommend doing it before #9–12 to avoid double-migrating RLS.

## Suggested rollout order

Phase A (low risk, high value): 1, 2, 4, 12, 15
Phase B (sending intelligence): 3, 6, 7, 8
Phase C (lead depth): 9, 10, 11
Phase D (structural): 13, then 5, 14

Want me to proceed in this order, or pick a different subset to start with?