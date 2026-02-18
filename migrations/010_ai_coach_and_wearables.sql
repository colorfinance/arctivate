-- Arctivate Phase 3: AI Coach, Wearables & Recovery
-- Date: 2026-02-18

-- ========================================== --
-- 1. WEARABLE DATA LOGS
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.wearable_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  hrv numeric,               -- Heart Rate Variability (ms)
  rhr numeric,               -- Resting Heart Rate (bpm)
  sleep_hours numeric,       -- Sleep duration in hours
  sleep_quality text check (sleep_quality in ('poor', 'fair', 'good', 'excellent')),
  logged_at date default CURRENT_DATE,
  created_at timestamptz default now()
);

-- ========================================== --
-- 2. AI COACH CONVERSATION HISTORY
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.coach_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ========================================== --
-- 3. ADD RPE TO WORKOUT LOGS
-- ========================================== --
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'rpe') THEN
        ALTER TABLE public.workout_logs ADD COLUMN rpe integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'notes') THEN
        ALTER TABLE public.workout_logs ADD COLUMN notes text;
    END IF;
END $$;

-- ========================================== --
-- 4. EXERCISE-TO-MUSCLE MAPPING
-- ========================================== --
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercises' AND column_name = 'muscle_group') THEN
        ALTER TABLE public.exercises ADD COLUMN muscle_group text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercises' AND column_name = 'user_id') THEN
        ALTER TABLE public.exercises ADD COLUMN user_id uuid references public.profiles(id);
    END IF;
END $$;

-- ========================================== --
-- 5. ROW LEVEL SECURITY
-- ========================================== --
ALTER TABLE public.wearable_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can view own wearable logs" ON public.wearable_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can insert own wearable logs" ON public.wearable_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own coach messages" ON public.coach_messages;
CREATE POLICY "Users can view own coach messages" ON public.coach_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own coach messages" ON public.coach_messages;
CREATE POLICY "Users can insert own coach messages" ON public.coach_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========================================== --
-- 6. INDEXES FOR PERFORMANCE
-- ========================================== --
CREATE INDEX IF NOT EXISTS idx_wearable_logs_user_date ON public.wearable_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_messages_user ON public.coach_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON public.workout_logs(user_id, created_at DESC);
