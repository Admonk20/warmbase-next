-- Create automation_config table
CREATE TABLE IF NOT EXISTS public.automation_config (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    icp JSONB DEFAULT '{
        "titles": [],
        "industries": [],
        "geos": [],
        "keywords": [],
        "service": "",
        "limit": 10
    }'::JSONB,
    sender_name TEXT,
    sender_company TEXT,
    sender_title TEXT,
    services_offered TEXT,
    daily_lead_limit INTEGER DEFAULT 20,
    daily_email_limit INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for automation_config
ALTER TABLE public.automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automation config"
ON public.automation_config FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can edit their own automation config"
ON public.automation_config FOR ALL
USING (auth.uid() = user_id);

-- Create automation_runs table
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, partially_completed, failed
    leads_sourced INTEGER DEFAULT 0,
    leads_researched INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    logs JSONB[] DEFAULT '{}',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enable RLS for automation_runs
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automation runs"
ON public.automation_runs FOR SELECT
USING (auth.uid() = user_id);

-- Profile field for personal instructions (if missing)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_email_instructions TEXT;
