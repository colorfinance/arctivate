-- Migration 019: Habit frequency (daily vs weekly) + preset marker
-- Date: 2026-07-19
--
-- The 30-day challenge seeds a set of preset habits. Most are daily, but a
-- few are weekly (4+ ARC workouts, weekly photo, weekly weigh-in) and must
-- reset once a week rather than every day.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'habits' AND constraint_name = 'habits_frequency_check'
  ) THEN
    ALTER TABLE public.habits
      ADD CONSTRAINT habits_frequency_check CHECK (frequency IN ('daily', 'weekly'));
  END IF;
END $$;

-- Marks habits that were auto-seeded as challenge presets (vs. user-created).
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS is_preset boolean NOT NULL DEFAULT false;
