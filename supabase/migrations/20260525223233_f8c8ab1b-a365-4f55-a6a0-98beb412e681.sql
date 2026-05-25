
-- Per-user SMTP / IMAP settings
CREATE TABLE IF NOT EXISTS public.user_smtp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  username TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  daily_cap INTEGER NOT NULL DEFAULT 50,
  sent_today INTEGER NOT NULL DEFAULT 0,
  warmup_day INTEGER NOT NULL DEFAULT 0,
  warmup_enabled BOOLEAN NOT NULL DEFAULT true,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  verified_at TIMESTAMPTZ,
  last_error TEXT,
  -- optional IMAP for reply detection
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT,
  imap_password_enc TEXT,
  imap_last_uid INTEGER NOT NULL DEFAULT 0,
  imap_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_smtp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smtp owner all" ON public.user_smtp_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER smtp_touch BEFORE UPDATE ON public.user_smtp_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reusable snippets
CREATE TABLE IF NOT EXISTS public.email_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shortcode TEXT NOT NULL,
  body TEXT NOT NULL,
  description TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, shortcode)
);
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snippets owner all" ON public.email_snippets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER snippets_touch BEFORE UPDATE ON public.email_snippets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lead scoring / merge
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_engaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- A/B on steps
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS subject_b TEXT,
  ADD COLUMN IF NOT EXISTS ab_test_id UUID;

-- Sourcing worker state
ALTER TABLE public.sourcing_runs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS max_findings INTEGER NOT NULL DEFAULT 50;

-- Event classification reason
ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS reason TEXT;
