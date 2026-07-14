-- Migration 016: Editable profile body metrics
-- Date: 2026-06-27
--
-- Ensures the demographic columns the profile editor writes to exist. age /
-- weight / gender / fitness_level / goal are written by onboarding; height is
-- new. All nullable so nothing breaks for existing rows.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height numeric;   -- cm
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fitness_level text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal text;
