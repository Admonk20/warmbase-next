
-- Link click tracking
CREATE TABLE public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  target_url text NOT NULL,
  lead_id uuid,
  campaign_id uuid,
  click_count int NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracked_links_user ON public.tracked_links(user_id);
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracked_links owner all" ON public.tracked_links
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Saved views / segments
CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_views owner all" ON public.saved_views
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER saved_views_touch BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed inboxes for inbox-placement testing
CREATE TABLE public.seed_inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  provider text,
  last_inbox boolean,
  last_spam boolean,
  last_missing boolean,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
ALTER TABLE public.seed_inboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seed_inboxes owner all" ON public.seed_inboxes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-user sending preferences (send window + skip days)
CREATE TABLE public.user_send_preferences (
  user_id uuid PRIMARY KEY,
  send_start_hour int NOT NULL DEFAULT 9,
  send_end_hour int NOT NULL DEFAULT 17,
  skip_weekends boolean NOT NULL DEFAULT true,
  holiday_dates date[] NOT NULL DEFAULT '{}'::date[],
  default_timezone text NOT NULL DEFAULT 'UTC',
  throttle_seconds int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_send_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "send_prefs owner all" ON public.user_send_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER send_prefs_touch BEFORE UPDATE ON public.user_send_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Campaign scheduling
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_quota int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS throttle_seconds int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS send_start_hour int NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS send_end_hour int NOT NULL DEFAULT 17;

-- Lead enrichment + sequence pause
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS enrichment jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sequence_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS best_send_hour int;
