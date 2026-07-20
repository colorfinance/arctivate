-- Migration 021: Personal (member-scanned) workouts
-- Date: 2026-07-20
--
-- Members can photograph a workout and have it loaded onto their account as a
-- personal workout they log against — reusing the daily_workouts machinery.
-- A personal workout has owner_id set; global admin WODs keep owner_id NULL.

ALTER TABLE public.daily_workouts
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_workouts_owner ON public.daily_workouts(owner_id, workout_date DESC);

-- ---- daily_workouts read: global published (owner NULL) + your own + admin ----
DROP POLICY IF EXISTS "Read published daily workouts" ON public.daily_workouts;
CREATE POLICY "Read published daily workouts"
  ON public.daily_workouts FOR SELECT
  TO authenticated
  USING (
    (is_published = true AND owner_id IS NULL)
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Members can create / update / delete their OWN personal workouts.
DROP POLICY IF EXISTS "Users manage own personal workouts" ON public.daily_workouts;
CREATE POLICY "Users manage own personal workouts"
  ON public.daily_workouts FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ---- daily_workout_exercises: readable when the parent workout is readable ----
DROP POLICY IF EXISTS "Read daily workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Read daily workout exercises"
  ON public.daily_workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_workouts w
      WHERE w.id = daily_workout_id
        AND (
          (w.is_published = true AND w.owner_id IS NULL)
          OR w.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

-- Members can manage exercises under their own personal workouts.
DROP POLICY IF EXISTS "Users manage own personal workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Users manage own personal workout exercises"
  ON public.daily_workout_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.daily_workouts w WHERE w.id = daily_workout_id AND w.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.daily_workouts w WHERE w.id = daily_workout_id AND w.owner_id = auth.uid())
  );
