
-- Extend email_event_type enum (no-op if values already exist)
DO $$ BEGIN
  ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'clicked';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'unsubscribed'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'bounced'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'complained'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'failed'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'replied'; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- sourcing_runs
CREATE TABLE IF NOT EXISTS public.sourcing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  icp JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sourcing_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sourcing_runs owner all" ON public.sourcing_runs;
CREATE POLICY "sourcing_runs owner all" ON public.sourcing_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sourcing_runs_touch BEFORE UPDATE ON public.sourcing_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS sourcing_runs_user_created ON public.sourcing_runs(user_id, created_at DESC);

-- sourcing_findings
CREATE TABLE IF NOT EXISTS public.sourcing_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  run_id UUID NOT NULL REFERENCES public.sourcing_runs(id) ON DELETE CASCADE,
  contact TEXT,
  title TEXT,
  company TEXT,
  email TEXT,
  linkedin_url TEXT,
  source_url TEXT,
  niche TEXT,
  score INT NOT NULL DEFAULT 5,
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sourcing_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sourcing_findings owner all" ON public.sourcing_findings;
CREATE POLICY "sourcing_findings owner all" ON public.sourcing_findings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS sourcing_findings_run ON public.sourcing_findings(run_id);
CREATE INDEX IF NOT EXISTS sourcing_findings_user ON public.sourcing_findings(user_id, created_at DESC);

-- lead_notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_notes owner all" ON public.lead_notes;
CREATE POLICY "lead_notes owner all" ON public.lead_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS lead_notes_lead ON public.lead_notes(lead_id, created_at DESC);

-- email_unsub_tokens (public-readable by token only via server fn / no RLS-anon)
CREATE TABLE IF NOT EXISTS public.email_unsub_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_unsub_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_unsub_tokens owner read" ON public.email_unsub_tokens;
CREATE POLICY "email_unsub_tokens owner read" ON public.email_unsub_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS email_unsub_tokens_user ON public.email_unsub_tokens(user_id);
