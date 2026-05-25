# Restore Missing ColdBase Pro Features

The current build kept the auth + database shell but stripped the actual product. The original is a 943-line React app with 8 feature modules and 13 backend endpoints. This plan ports every one of them onto the new Supabase-backed architecture (RLS-protected, multi-user, no localStorage data).

## What's missing today

Current routes (`leads`, `dashboard`, `campaigns`, `sequences`, `deliverability`, `settings`) are stubs (5 of them are ~18 lines). None of the AI tools, lead-finder URL generators, email-pattern generator, sequence templates, deliverability checklist, playbook, or AI chatbot exist.

## What gets rebuilt

### Frontend modules (each becomes its own route under `_app/`)

1. **Dashboard** — KPI cards (emails sent, open rate, reply rate, meetings, pipeline $, won $), funnel chart, status distribution chart. Data sourced from `campaigns` + `leads` + `email_events` already in Supabase. Uses `recharts` (already installed by shadcn) instead of chart.js.
2. **Lead Finder** — generates LinkedIn X-ray, Sales Navigator, Google, Apollo, and Maps search URLs from filters (industry/title/location/size/keywords) + Boolean string builder + CSV paste import → writes to `leads` table.
3. **CRM (Leads)** — full table with status filters, search, status counts, add/edit modal, delete, CSV export. Replaces the current 199-line stub with the original's complete UX.
4. **Email Finder** — single + bulk email-pattern generator (`first.last@`, `flast@`, etc.), Gmail mailto test, CSV export of bulk results. Pure client-side.
5. **Sequence Studio** — niche-specific email templates (`NICHE_TEMPLATES` constant), variable replacement (first_name, company, role…), 4-step sequence preview, copy-to-clipboard, mailto open. Templates persist per-user in the existing `sequences` + `sequence_steps` tables; user variable defaults live in `profiles`.
6. **Campaigns** — list / create / edit campaigns with status, prospects, sent/opened/replied/meetings counters.
7. **Deliverability** — SPF/DKIM/DMARC/domain/warmup checklist (persisted per-user in a new `deliverability_checks` row keyed by `user_id`), warm-up day/inbox calculator.
8. **Playbook** — static guide content (cold email best-practices, deliverability, sequencing).
9. **AI Assistant** — floating chat widget available on every `_app/*` route, calls the chat server fn with the user's pipeline as context.

### Backend (TanStack `createServerFn`, replacing the original Vercel `/api/*.js`)

All 13 endpoints get rewritten as `createServerFn` files in `src/lib/*.functions.ts`, protected with `requireSupabaseAuth`. API keys (OpenAI, Hunter, Serper, Brave, SMTP) come from the existing `user_api_keys` table — never from the client request body.

| Original | New server fn | Purpose |
|---|---|---|
| `api/chat.js` | `assistant.functions.ts` → `chat` | AI assistant with pipeline context |
| `api/clean-leads.js` | `leads.functions.ts` → `cleanLeads` | GPT normalization of scraped leads |
| `api/draft-email.js` | `email.functions.ts` → `draftEmail` | Stage-aware personalized cold email |
| `api/enrich.js` | `enrich.functions.ts` → `enrichCompany` | Clearbit autocomplete + meta scrape |
| `api/hunter.js` | `hunter.functions.ts` → `hunterSearch` | Hunter.io proxy |
| `api/personalize.js` | `email.functions.ts` → `personalizeBatch` | Batch opening lines |
| `api/reply-draft.js` | `email.functions.ts` → `draftReply` | Objection-aware reply draft |
| `api/research-lead.js` | `research.functions.ts` → `researchLead` | OpenAI web-search lead research |
| `api/scrape-browser.js` | `research.functions.ts` → `searchLeads` | Hybrid OpenAI + Brave lead search |
| `api/search-leads.js` | `research.functions.ts` → `serperSearch` | Serper/Google CSE proxy |
| `api/send-email.js` | `email.functions.ts` → `sendEmail` | SMTP send via nodemailer + logs event |
| `api/subject-lines.js` | `email.functions.ts` → `subjectLines` | 5 alt subject lines |
| `api/verify-email.js` | `email.functions.ts` → `verifyEmail` | Format + MX-record validation |

Every email send writes a row to `email_events` so the dashboard stays live. AI calls default to **Lovable AI Gateway (`google/gemini-2.5-flash`)** when the user has no OpenAI key in `user_api_keys`, so the app works out of the box without secrets.

### Database additions (one small migration)

- `deliverability_checks` — one row per user storing the checklist toggles + warmup config.
- Add `linkedin_url`, `confidence` columns to `leads` (needed by research/clean endpoints).
- Encrypt `user_api_keys.value_enc` writes with `pgcrypto` (table is already prepared for this); store provider names: `openai`, `hunter`, `serper`, `brave`, `smtp`.

### Settings page

Becomes the API-key + sender-identity (`yourName`, `yourCompany`, `services`, default SMTP) editor backed by `profiles` + `user_api_keys`. Replaces the current 67-line stub.

## Out of scope

- Stripe/payments, team workspaces, scheduled-send cron, inbox sync (IMAP). The original didn't have these either.
- The original `Playbook` is static markdown content — ported as-is, not made editable.

## Delivery order

1. **Migration** — add columns/table, enable `pgcrypto`.
2. **Server fns** — port all 13 endpoints, wired to `user_api_keys` + Lovable AI Gateway fallback.
3. **Routes** — replace each stub route with the ported feature (Dashboard, Leads/CRM, Lead Finder, Email Finder, Sequence Studio, Campaigns, Deliverability, Playbook, Settings).
4. **AI Assistant** — global floating widget.
5. **Sanity check** — open every route logged-in, confirm no console errors, confirm one email send writes to `email_events`.
