
-- Suppression list (global per user — bounced, complained, manual)
CREATE TABLE public.suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE INDEX idx_suppressions_user_email ON public.suppressions(user_id, email);
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppressions owner all" ON public.suppressions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks / reminders
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid,
  title text NOT NULL,
  notes text,
  due_at timestamptz,
  completed_at timestamptz,
  priority int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, due_at) WHERE completed_at IS NULL;
CREATE INDEX idx_tasks_lead ON public.tasks(lead_id);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks owner all" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
