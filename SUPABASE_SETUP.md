# Supabase setup (local & production)

This guide covers the minimal steps to configure Supabase for WarmBase so data is saved correctly and secrets remain safe.

1) Obtain keys
- Open your Supabase project → Settings → API
- Copy the **Project URL** and the **anon/public** key (publishable/anon key)
- Copy the **service_role** key (this is a privileged server-only key)

2) Local `.env`
- Copy `./.env.example` → `./.env` and fill the values. Example entries (local only):

```env
  # KEEP SECRET, server-only
```

3) Deploy / production env
- Add the same variables in your host (Vercel, Fly, etc.). Ensure `SUPABASE_SERVICE_ROLE_KEY` is marked as secret and not exposed to the client.

4) Migrations
- Migrations are in `supabase/migrations/`. You can push them with the Supabase CLI or run the SQL files in the Supabase SQL editor.

Example (Supabase CLI):
```bash
# login and push local migrations
npx supabase login
npx supabase db push --project-ref <project-ref>
```

5) Verify RLS & encryption
- The shipped migrations enable Row Level Security (RLS) for user-owned tables (`profiles`, `leads`, `user_api_keys`, etc.) and create triggers to enforce that `user_api_keys.value_enc` is encrypted.
- After adding an API key via the Settings UI, verify the DB row contains an encrypted value (starts with `v1:`):

```sql
select id, user_id, provider, value_enc from public.user_api_keys where user_id = '<your-user-id>' limit 10;
```

6) Quick smoke test
- Start dev server:
```bash
npm run dev
```
- Sign up / sign in in the browser, go to `/settings`, add an API key (provider: `openai`), then confirm the row exists and `value_enc` starts with `v1:`.

7) Security notes
- Never store `SUPABASE_SERVICE_ROLE_KEY` in client code or commit it to the repo.
- If you need to perform privileged operations, use server-only code paths (`src/integrations/supabase/client.server.ts` / server functions).
- Ensure `.env` is in `.gitignore` (the repo already keeps `.env.example` tracked but not `.env`).

If you want, I can run a local smoke test now — I will need the `SUPABASE_SERVICE_ROLE_KEY` set in your local environment (you can paste it here if you want me to run it). Otherwise you can follow the steps above and tell me when it's ready.
