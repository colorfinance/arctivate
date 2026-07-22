-- Migration 024: Workout completions (tick a whole workout off)
-- Date: 2026-07-22
--
-- Members tick a workout (coach's Workout of the Day, or their own) as done
-- for the day, rather than logging each movement. One row per user/workout/day.

CREATE TABLE IF NOT EXISTS public.workout_completions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  daily_workout_id uuid references public.daily_workouts(id) on delete cascade not null,
  date date not null default CURRENT_DATE,
  completed_at timestamptz default now(),
  unique (user_id, daily_workout_id, date)
);

CREATE INDEX IF NOT EXISTS idx_workout_completions_user_date ON public.workout_completions(user_id, date);

ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workout completions" ON public.workout_completions;
CREATE POLICY "Users manage own workout completions"
  ON public.workout_completions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
