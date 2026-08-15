-- Migration 029: Attach a photo to a specific workout
-- Date: 2026-08-15
--
-- workout_photos was a flat per-user gallery with no link to a workout, so a
-- photo of the whiteboard or a lift couldn't sit with the session it belongs
-- to. NULL keeps the existing behaviour: a photo in the general gallery.

ALTER TABLE public.workout_photos
  ADD COLUMN IF NOT EXISTS daily_workout_id uuid
  REFERENCES public.daily_workouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_photos_workout
  ON public.workout_photos(daily_workout_id)
  WHERE daily_workout_id IS NOT NULL;
