-- Migration 027: Notes attach to an individual workout
-- Date: 2026-07-27
--
-- training_notes held one note per user per day, shared across every workout
-- that day. Notes can now hang off a specific workout, so a member doing two
-- sessions can keep separate notes for each. daily_workout_id NULL keeps the
-- existing behaviour: a general note for the day.

ALTER TABLE public.training_notes
  ADD COLUMN IF NOT EXISTS daily_workout_id uuid
  REFERENCES public.daily_workouts(id) ON DELETE CASCADE;

-- The old (user_id, date) constraint would block a per-workout note sitting
-- alongside the day note, so replace it with two partial unique indexes.
-- (NULLs compare as distinct in Postgres, so a plain 3-column unique wouldn't
-- keep the day note unique.)
-- Dropped by lookup rather than by name, so it goes regardless of what the
-- constraint ended up being called.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'training_notes'
      AND con.contype = 'u'
  LOOP
    IF r.def IN ('UNIQUE (user_id, date)', 'UNIQUE (date, user_id)') THEN
      EXECUTE format('ALTER TABLE public.training_notes DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_notes_day
  ON public.training_notes(user_id, date)
  WHERE daily_workout_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_notes_workout
  ON public.training_notes(user_id, date, daily_workout_id)
  WHERE daily_workout_id IS NOT NULL;
