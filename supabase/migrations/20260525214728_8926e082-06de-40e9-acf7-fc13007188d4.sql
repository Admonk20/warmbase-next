
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS confidence text;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS meeting_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.deliverability_checks (
  user_id uuid PRIMARY KEY,
  spf boolean NOT NULL DEFAULT false,
  dkim boolean NOT NULL DEFAULT false,
  dmarc boolean NOT NULL DEFAULT false,
  domains boolean NOT NULL DEFAULT false,
  warmup boolean NOT NULL DEFAULT false,
  limits boolean NOT NULL DEFAULT false,
  reply boolean NOT NULL DEFAULT false,
  unsub boolean NOT NULL DEFAULT false,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  inboxes integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverability_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliverability owner all" ON public.deliverability_checks;
CREATE POLICY "deliverability owner all" ON public.deliverability_checks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER deliverability_checks_touch
  BEFORE UPDATE ON public.deliverability_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
