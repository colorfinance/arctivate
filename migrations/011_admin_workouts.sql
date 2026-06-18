-- Migration 011: Admin "Workout of the Day" (programmed workouts)
-- Date: 2026-06-18
--
-- Lets an admin publish a workout for a given day. Every user sees the
-- workout in the Train section and logs their own weights against each
-- prescribed movement (reusing the existing workout_logs flow).

-- ========================================== --
-- 1. DAILY WORKOUTS (one programmed workout per day)
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.daily_workouts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  workout_date date not null default CURRENT_DATE,
  source text not null default 'manual' check (source in ('manual', 'photo')),
  is_published boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========================================== --
-- 2. DAILY WORKOUT EXERCISES (the prescribed movements)
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.daily_workout_exercises (
  id uuid default gen_random_uuid() primary key,
  daily_workout_id uuid references public.daily_workouts(id) on delete cascade not null,
  name text not null,                         -- e.g. "Back Squat"
  metric_type text not null default 'weight'  -- matches public.exercises
    check (metric_type in ('weight', 'time', 'reps', 'distance')),
  target_sets int,
  target_reps int,
  target_value numeric,                       -- prescribed weight / time / distance
  notes text,
  position int default 0,                      -- display order
  created_at timestamptz default now()
);

-- ========================================== --
-- 3. LINK WORKOUT LOGS BACK TO THE WOD
-- ========================================== --
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'daily_workout_id') THEN
    ALTER TABLE public.workout_logs ADD COLUMN daily_workout_id uuid REFERENCES public.daily_workouts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'daily_workout_exercise_id') THEN
    ALTER TABLE public.workout_logs ADD COLUMN daily_workout_exercise_id uuid REFERENCES public.daily_workout_exercises(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================================== --
-- 4. INDEXES
-- ========================================== --
CREATE INDEX IF NOT EXISTS idx_daily_workouts_date ON public.daily_workouts(workout_date DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_daily_workout_exercises_workout ON public.daily_workout_exercises(daily_workout_id, position);
CREATE INDEX IF NOT EXISTS idx_workout_logs_daily_workout ON public.workout_logs(daily_workout_id);

-- ========================================== --
-- 5. ROW LEVEL SECURITY
-- ========================================== --
ALTER TABLE public.daily_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_workout_exercises ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read published workouts; admins can read all.
DROP POLICY IF EXISTS "Read published daily workouts" ON public.daily_workouts;
CREATE POLICY "Read published daily workouts"
  ON public.daily_workouts FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can create / update / delete daily workouts.
DROP POLICY IF EXISTS "Admins manage daily workouts" ON public.daily_workouts;
CREATE POLICY "Admins manage daily workouts"
  ON public.daily_workouts FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Exercises are readable when their parent workout is readable.
DROP POLICY IF EXISTS "Read daily workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Read daily workout exercises"
  ON public.daily_workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_workouts w
      WHERE w.id = daily_workout_id
        AND (
          w.is_published = true
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

DROP POLICY IF EXISTS "Admins manage daily workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Admins manage daily workout exercises"
  ON public.daily_workout_exercises FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
