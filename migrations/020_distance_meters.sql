-- Migration 020: Distance in metres
-- Date: 2026-07-20
--
-- Adds a 'distance_m' metric type so movements measured in metres (rower,
-- bike, ski-erg — e.g. 500m) can be logged, alongside the existing 'distance'
-- which is kilometres.

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_metric_type_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_metric_type_check
  CHECK (metric_type IN ('weight', 'time', 'reps', 'distance', 'distance_m'));

ALTER TABLE public.daily_workout_exercises DROP CONSTRAINT IF EXISTS daily_workout_exercises_metric_type_check;
ALTER TABLE public.daily_workout_exercises
  ADD CONSTRAINT daily_workout_exercises_metric_type_check
  CHECK (metric_type IN ('weight', 'time', 'reps', 'distance', 'distance_m'));
