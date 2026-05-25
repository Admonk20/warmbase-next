## Goal

Turn ColdBase into a focused outbound platform: an agentic lead-sourcing engine (Firecrawl + AI), Lovable Emails with open/click/unsubscribe tracking, a kanban pipeline, a deep lead drawer, a real deliverability dashboard, and a robust CSV importer — with redundant pages removed and the UI polished.

## Decisions locked from your answers

- **Email sending → Lovable Emails (built-in).** Free, works with your custom domain, queued with retries and a suppression list. We add open/click/unsubscribe on top.
- **Lead sourcing → Agentic web pipeline using Firecrawl + Lovable AI.** No paid contact DB; we search the web, scrape company sites/LinkedIn results, extract people + roles, enrich, score, and dedupe. You'll be prompted to connect Firecrawl (has a free tier).
- **Removals:** Playbook page, old Deliverability checklist page, Email Finder as its own page (folded into Lead Finder as a tab).

---

## 1. Lead sourcing engine — agentic, Apollo-style flow

New page **Sourcing** plus a background job model.

```text
ICP form ─▶ Plan (AI breaks into sub-queries)
        ─▶ Firecrawl search (Google/LinkedIn/company sites, paged)
        ─▶ Firecrawl scrape on result URLs (markdown + links)
        ─▶ AI extractor: people, titles, companies, niche, fit
        ─▶ Email finder (pattern guess + Hunter optional + MX verify)
        ─▶ Enrichment (Clearbit autocomplete, site meta, LinkedIn URL)
        ─▶ Score (1–10) + dedupe vs existing leads
        ─▶ Insert into `leads` linked to a sourcing_run
```

- New tables: `sourcing_runs` (icp jsonb, status, counts) and `sourcing_findings` (run_id, raw payload, lead_id once promoted). RLS by user_id.
- Server functions in `src/lib/sourcing.functions.ts`: `startRun`, `runStep` (chunked work to stay under Worker time limits), `promoteFindings`, `getRun`.
- UI: ICP wizard (titles, industries, geos, keywords, size), live progress with per-step counts, results table with checkboxes → promote to leads.
- Falls back gracefully when Firecrawl isn't connected (uses existing Serper key flow or shows connect-Firecrawl CTA).

## 2. Email sending on Lovable Emails + tracking

- Switch outbound from Resend to **Lovable Emails** via the queued infra (`enqueue_email` RPC → process-email-queue dispatcher). Uses your verified domain, no per-email cost.
- New `tracking_pixels` and `unsubscribe_tokens` tables (or reuse `email_unsubscribe_tokens` from infra).
- Public server routes under `src/routes/api/public/`:
  - `track/open.gif` — 1×1 GIF, logs `event_type='opened'` to `email_events`.
  - `track/click` — 302 redirect, logs `event_type='clicked'` with destination URL.
  - `unsubscribe` — token-based page, writes to `unsubscribes` + `suppressed_emails`, logs `event_type='unsubscribed'`.
- Outbound email body is rewritten on send: links wrapped via `track/click?t=…&u=…`, pixel appended, unsubscribe footer added.
- `sendEmail` server fn now: checks suppression → enqueues via Lovable Emails → inserts `pending` row → dispatcher updates to `sent`/`failed`.

## 3. Deliverability dashboard (replaces checklist page)

Built from `email_events` + `email_send_log`:
- Time filter (24h / 7d / 30d / custom), template filter, campaign filter.
- Stat cards: sent, delivered, open rate, click rate, reply rate, bounce, unsubscribe.
- Cohort view: rows = send-date cohort, columns = days since send, cells = open/reply % (heatmap).
- Trend chart (sends + opens + replies over time, Recharts).
- Top-replying campaigns and worst-bouncing domains.
- All queries deduplicate `email_send_log` by `message_id` (latest status wins).

## 4. Lead drawer with activity timeline

Replaces the current edit modal on the Leads page.
- Tabs: **Overview**, **Activity**, **Email history**, **Notes**, **Draft email**.
- Activity = merged timeline of `email_events` (sent/opened/clicked/replied/unsubscribed), status changes, and manual notes, sorted desc.
- Email history = grouped by thread (subject), expandable to see body + events.
- Notes = append-only with timestamp; stored in `lead_notes` table (new, RLS by user_id).
- Draft email tab = the existing LeadDrafter, embedded.

## 5. Kanban pipeline

New `/pipeline` route using `@dnd-kit/core` (Worker-compatible, no native deps).
- Columns = lead statuses (`new → contacted → engaged → meeting → won/lost`).
- Cards show contact, company, last activity badge, score, value.
- Drag updates `leads.status` via Supabase, optimistic UI, undo toast.
- Per-column WIP counts and total $ value (sum of `leads.value`).
- Click card → opens the new lead drawer.

## 6. CSV importer with field mapping + dedupe

Replaces the silent CSV path on the Leads page.
- Step 1: drop CSV, parse headers with PapaParse.
- Step 2: visual mapper — left: detected columns, right: target fields (contact/email/company/title/phone/niche/linkedin_url/notes/status), with auto-suggest from header names.
- Step 3: duplicate policy — `skip`, `update existing`, or `create new` (matched on email, then contact+company).
- Step 4: preview first 10 rows, validation errors highlighted (zod).
- Step 5: chunked insert with progress bar; summary at end (imported / updated / skipped / errors).

## 7. Cleanup + UI polish

- Delete `src/routes/_app/playbook.tsx`, `src/routes/_app/email-finder.tsx`, `src/routes/_app/deliverability.tsx` (old).
- Fold Email Finder into Lead Finder as a "Find emails" tab.
- Refreshed sidebar: Dashboard · Pipeline · Leads · Sourcing · Sequences · Campaigns · Deliverability · Settings.
- Update `coldbase-constants.ts`, `app-shell.tsx`, `routeTree.gen.ts` (auto).
- Tighten spacing, unify card/empty/loading states, replace ad-hoc colors with semantic tokens, add framer-motion page transitions.

---

## Technical section

**New deps:** `@dnd-kit/core`, `@dnd-kit/sortable`, `papaparse`, `@mendable/firecrawl-js`, `react-markdown`, `remark-gfm`, `recharts` (if not present), `framer-motion`.

**New tables (migration):**
- `sourcing_runs` (id, user_id, icp jsonb, status, totals jsonb, created_at, updated_at)
- `sourcing_findings` (id, run_id, user_id, payload jsonb, lead_id nullable, score int, created_at)
- `lead_notes` (id, lead_id, user_id, body text, created_at)
- Extend `email_events` `event_type` enum if missing: `clicked`, `unsubscribed`, `bounced`
- All RLS = `auth.uid() = user_id`.

**Connectors / infra:**
- Connect **Firecrawl** (you'll get the connect prompt) — falls back to existing Serper key if not connected.
- Run `email_domain--setup_email_infra` if not already set, then scaffold transactional sender.

**Server fns (new):** `sourcing.functions.ts`, `tracking.functions.ts`, `notes.functions.ts`, plus updates to `email.functions.ts` (Lovable Emails enqueue + link wrapping + suppression check).

**Public server routes:** `routes/api/public/track/open.gif.ts`, `routes/api/public/track/click.ts`, `routes/api/public/unsubscribe.ts` — input-validated, idempotent, no PII leakage.

**Migration safety:** All deletions are file-level only; no DB drops. Existing rows in `leads`, `campaigns`, `email_events` keep working — schema is additive.

---

## What you'll see when it's done

A polished sidebar, a kanban you can drag leads through, a lead drawer that shows every touchpoint, a Sourcing screen where you describe your ICP and watch the agent fill the pipeline, real open/click/reply rates with cohorts, and emails that send from your own domain at $0/email.
