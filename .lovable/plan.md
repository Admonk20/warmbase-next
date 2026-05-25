# ColdBase Pro — Audit & Rebuild Plan

I went through the uploaded ZIP (React + Vite + Vercel serverless `/api`, 23 components, ~6.3k LOC). Below is what's wrong, then what I'll change. The project workspace itself is empty, so I'll port the app in cleanly rather than patch the legacy code in place.

## 1. Critical issues in the current build

### Security
- **Fake authentication.** `AuthGate.jsx` stores accounts in `localStorage` as `{ email, hash: sha256(email+":"+password) }`. Anyone with devtools can read every account, swap the hash, or flip `cbp3_active_uid` to impersonate any user. No salt, no rate limiting, no email verification, no password reset.
- **Per-user data is also in localStorage** keyed by a guessable `u_xxxx` UID — bypassable by editing one string in devtools.
- **Secrets handled client-side.** SMTP password, OpenAI key, Brave key, Hunter key are stored in `localStorage` and **POSTed from the browser to `/api/*` on every call**. They appear in network tabs, browser history, and any XSS payload exfiltrates everything.
- **`tls: { rejectUnauthorized: false }`** in `api/send-email.js` disables TLS validation — MITM risk.
- **No input validation / no rate limiting** on any `/api/*` route. `api/scrape-browser.js` (447 lines) accepts arbitrary URLs → SSRF risk against internal addresses.
- **CORS wide open**, no auth header checked on serverless functions, so anyone who finds the deployed URL can burn the user's OpenAI quota.
- **`main.jsx` is broken** — the file ends mid-statement (`ReactDOM.createRoot(...).render(` with no closing). The app as shipped does not boot.

### Architecture / UX
- **Inline styles everywhere** (AuthGate alone has ~40 style objects). No design system, inconsistent spacing, no dark-mode tokens — dark mode is a single body class toggling ad-hoc CSS in `App.css`.
- **No router.** Tools are swapped via a `useState` drawer; no deep links, no back button, no shareable URLs.
- **No persistence across devices.** Everything is localStorage, so leads/campaigns are lost on browser clear or device switch.
- **No real-time, no collaboration, no audit trail.**
- **Giant single-purpose components** (Pipeline 459 LOC, ResearchComposer 433, LeadScraper 422) mix data, UI, and API calls.
- **Two parallel auth concepts** (`cbp3_auth_cred` v1 + `cbp3_accounts` v2) with migration code still shipping.
- **Keyboard shortcuts hijack single letters** (`d`, `s`, `f`, `c`, `a`, `x`) — collides with normal typing the moment focus leaves an input.
- **Accessibility:** no focus rings, no aria labels on icon buttons, color-only status indicators, no skip links.

### Functionality gaps
- No email open / click tracking (claims deliverability features but never measures).
- No background sequence sender — "Sequences" only drafts; nothing actually schedules sends.
- No bounce / unsubscribe handling (legally required for cold email under CAN-SPAM / GDPR).
- No team / workspace concept despite "multi-account" UI.
- Chatbot context is the whole pipeline JSON shipped client-side to OpenAI — leaks PII and blows token limits at scale.

## 2. What I'll build

A clean rebuild on the standard Lovable stack (React + Vite + Tailwind + shadcn/ui) with **Lovable Cloud** as the backend so auth, database, storage, and edge functions are first-class.

### Backend (Lovable Cloud)
- Enable Lovable Cloud.
- **Real auth:** email/password + Google sign-in, email verification on, HIBP leaked-password check on, password reset page at `/reset-password`.
- **`profiles` table** (id → auth.users, name, company, title, avatar_url) auto-created via trigger on signup.
- **`user_roles` table** + `app_role` enum (`admin`, `member`) + `has_role()` security-definer function — never store roles on profiles.
- **Tables with RLS** (owner-only by default): `leads`, `campaigns`, `sequences`, `sequence_steps`, `email_events` (sent / opened / clicked / bounced / replied), `templates`, `ab_tests`, `api_keys` (encrypted column for user-supplied 3rd-party keys), `unsubscribes`.
- **Edge functions** replacing the `/api/*` routes — each one validates JWT, validates input with zod, enforces per-user rate limits, and pulls secrets server-side:
  - `send-email` (SMTP via user's stored creds, TLS validation **on**)
  - `verify-email`, `enrich-lead`, `research-lead`, `find-email`, `search-leads`
  - `draft-email`, `personalize`, `subject-lines`, `reply-draft`
  - `chat` (assistant, only sends summarized pipeline stats, not raw PII)
  - `scrape-url` (with allow-list / block private IP ranges to kill SSRF)
  - `sequence-runner` (scheduled cron — actually sends the day-1/3/7/14 follow-ups)
  - `track-open` / `track-click` (pixel + redirect for real deliverability metrics)
  - `unsubscribe` (one-click compliant link)
- **Secrets via Lovable AI Gateway** for OpenAI calls — no user OpenAI key required by default; user can still BYOK.
- **Storage bucket** for CSV imports and exports.

### Frontend (UI/UX overhaul)
- shadcn/ui components, Tailwind tokens (HSL semantic colors in `index.css` — primary, surface, muted, success, warning, danger). Light/dark with proper contrast.
- **Sidebar nav with router** (`react-router-dom`): `/dashboard`, `/leads`, `/leads/:id`, `/sequences`, `/campaigns`, `/inbox`, `/deliverability`, `/ab-tests`, `/settings/*`, `/auth`, `/reset-password`.
- **Command palette** (⌘K) replaces the single-letter shortcuts.
- **Pipeline kanban** with drag-and-drop, lead drawer with tabs (activity, emails, notes, AI research).
- **Live stats dashboard** powered by `email_events` (open rate, reply rate, bounce rate per campaign).
- **Bulk CSV import** with column mapping, dedupe, validation preview.
- **Empty states, skeletons, optimistic updates, toast feedback** everywhere.
- **Accessibility:** semantic HTML, focus-visible rings, aria labels on every icon button, keyboard-navigable kanban, prefers-reduced-motion respected.
- **SEO:** proper `<title>`, meta description, single H1 per route, canonical tag, JSON-LD on the landing page.

### Migration helper
A one-time "Import from old ColdBase" screen lets existing users paste their exported localStorage JSON to seed their new Cloud account — so nothing is lost.

## 3. Phasing

I'll ship in three reviewable steps so you can see progress fast:

1. **Foundation** — enable Cloud, schema + RLS + roles, auth pages (signup/login/Google/reset), profile bootstrap, app shell with sidebar + routing + theme tokens.
2. **Core CRM** — Leads CRUD, Pipeline kanban, lead drawer, CSV import, dashboard with real metrics, settings (profile, SMTP, BYOK).
3. **Engagement engine** — Sequences + cron runner, send-email edge function with tracking pixel + click redirect + unsubscribe, campaigns, A/B tests, AI assistant (chat, draft, personalize, research, subject lines) via Lovable AI Gateway, deliverability dashboard.

## 4. Technical notes (for reference)

- Stack: Vite + React + TS, Tailwind, shadcn/ui, react-router-dom, @tanstack/react-query, zod, react-hook-form, lucide-react, recharts.
- Backend: Lovable Cloud (Supabase under the hood) — Postgres + RLS + Edge Functions (Deno) + Auth + Storage + scheduled cron.
- All edge functions: zod-validated body, JWT-checked, CORS via `npm:@supabase/supabase-js@2/cors`, per-user rate limit table.
- All 3rd-party keys (OpenAI/Brave/Hunter/SMTP) live in a `user_api_keys` table with pgcrypto-encrypted values; never sent from the browser.
- Default LLM calls go through Lovable AI Gateway (`LOVABLE_API_KEY`) so the user doesn't need to supply OpenAI keys.

Approve this and I'll start with Phase 1.
