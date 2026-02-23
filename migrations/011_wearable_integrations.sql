-- Arctivate Phase 3: Wearable Device Integrations (Garmin, Fitbit)
-- Date: 2026-02-23

-- ========================================== --
-- 1. WEARABLE CONNECTIONS (OAuth tokens + status)
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.wearable_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null check (provider in ('garmin', 'fitbit', 'apple', 'manual')),

  -- OAuth tokens (encrypted before storage)
  access_token text,
  access_token_secret text,    -- Garmin OAuth 1.0a only
  refresh_token text,          -- Fitbit OAuth 2.0 only
  token_expires_at timestamptz,

  -- Connection metadata
  provider_user_id text,
  is_active boolean default true,
  last_sync_at timestamptz,
  sync_error text,
  sync_streak integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, provider)
);

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wearable connections" ON public.wearable_connections;
CREATE POLICY "Users can view own wearable connections"
  ON public.wearable_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wearable connections" ON public.wearable_connections;
CREATE POLICY "Users can insert own wearable connections"
  ON public.wearable_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wearable connections" ON public.wearable_connections;
CREATE POLICY "Users can update own wearable connections"
  ON public.wearable_connections FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wearable connections" ON public.wearable_connections;
CREATE POLICY "Users can delete own wearable connections"
  ON public.wearable_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user
  ON public.wearable_connections(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_wearable_connections_provider_active
  ON public.wearable_connections(provider, is_active)
  WHERE is_active = true;

-- ========================================== --
-- 2. EXPAND wearable_logs WITH RICHER DATA
-- ========================================== --
DO $$
BEGIN
    -- Source tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'source') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN source text default 'manual'
          check (source in ('manual', 'garmin', 'fitbit', 'apple', 'csv_import'));
    END IF;

    -- Steps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'steps') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN steps integer;
    END IF;

    -- Calories burned
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'calories_burned') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN calories_burned integer;
    END IF;

    -- Active minutes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'active_minutes') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN active_minutes integer;
    END IF;

    -- Stress score (Garmin)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'stress_score') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN stress_score numeric;
    END IF;

    -- SpO2
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'spo2') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN spo2 numeric;
    END IF;

    -- Body Battery (Garmin)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'body_battery') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN body_battery integer;
    END IF;

    -- Sleep stage breakdown
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'sleep_deep_hours') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN sleep_deep_hours numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'sleep_light_hours') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN sleep_light_hours numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'sleep_rem_hours') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN sleep_rem_hours numeric;
    END IF;

    -- Distance (meters)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'distance_meters') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN distance_meters numeric;
    END IF;

    -- Raw payload for debugging
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'raw_data') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN raw_data jsonb;
    END IF;

    -- Points awarded for this sync
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wearable_logs' AND column_name = 'points_awarded') THEN
        ALTER TABLE public.wearable_logs ADD COLUMN points_awarded integer default 0;
    END IF;
END $$;

-- Prevent duplicate entries for same user+source+date
CREATE UNIQUE INDEX IF NOT EXISTS idx_wearable_logs_unique_daily
  ON public.wearable_logs(user_id, source, logged_at)
  WHERE source != 'manual';

-- ========================================== --
-- 3. SYNC AUDIT LOG
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.wearable_sync_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  provider text not null,
  event_type text not null,
  payload jsonb,
  error_message text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user_date
  ON public.wearable_sync_log(user_id, created_at DESC);

ALTER TABLE public.wearable_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sync logs" ON public.wearable_sync_log;
CREATE POLICY "Users can view own sync logs"
  ON public.wearable_sync_log FOR SELECT
  USING (auth.uid() = user_id);
