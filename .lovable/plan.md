# Fix the research + AI drafting wiring

## What's wrong today

Looking at the reference (ColdBase Pro) and our `lead-drafter.tsx`, two real bugs stand out:

1. **Research and draft are not linked.** The user has to remember to click **Deep research** *before* **Draft email**. If they skip it, `draftEmail` runs with `research = undefined` and `suggestedService = undefined`, so the AI falls back to a generic email — exactly the "half-assed" output you complained about. The reference site does it in one action ("Research & draft email with AI").
2. **Only the research `summary` is sent to the email model.** `pains`, `opportunities`, `why_this_service`, and `hook` — the actually useful signals — are dropped. So even when research runs, the email doesn't reflect it.

A third smaller issue: the **Draft email** button label doesn't make it obvious that deep research is running first, so users won't know why it takes a few seconds longer.

## Fix

### 1. `src/components/lead-drafter.tsx`
- Replace the two separate buttons (**Deep research** + **Draft email**) with **one** primary button: **Research & draft email** (matches the reference UX).
- Behavior on click:
  1. Always call `researchLead` first (deep research every time, as you asked).
  2. Immediately chain into `draftEmail`, passing the full research payload + the user's optional service.
  3. Render the research card (score, pains, opportunities, suggested service, hook) above the draft so the user sees the reasoning.
- Keep **Subject ideas** as a separate secondary action (runs on the current body).
- Keep the **Your service (optional)** input. If filled, it overrides the AI's pick and the same one-click button redrafts around it (label flips to **Redraft with my service**).
- Show a single combined loading state ("Researching…" → "Drafting…").

### 2. `src/lib/email.functions.ts` — `draftEmail`
- Accept a richer research object instead of just a string summary:
  ```ts
  research: z.object({
    summary: z.string(),
    pains: z.array(z.string()),
    opportunities: z.array(z.string()),
    why_this_service: z.string().optional(),
    hook: z.string().optional(),
  }).optional()
  ```
- Format all of it into the prompt under `RESEARCH` so the model uses the specific pains/opportunities/hook in the opening line — not just paraphrasing a summary. The existing Grade 9 + service-provider voice rules stay exactly as they are.
- Backwards-compatible: if a caller still passes a plain string (older code paths), accept that too.

### 3. No backend / DB / auth changes
- No migration, no RLS change, no new secrets.
- `researchLead` itself already returns the deep JSON we need — no prompt changes there. We just stop throwing most of it away.

## Out of scope (explicitly)
- Not changing the kanban card buttons or pipeline UI.
- Not touching the PIN / auth flow, settings, SMTP, sending, or any other server function.
- Not changing the system prompts' voice rules (Grade 9, service-provider framing, banned-word list all stay).

## Files touched
- `src/components/lead-drafter.tsx` — UI: merge buttons, chain calls, pass full research.
- `src/lib/email.functions.ts` — `draftEmail` input schema + prompt formatting only.
