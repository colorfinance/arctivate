-- Migration 015: Per-user nutrition goals (macro / carb targets)
-- Date: 2026-06-26
--
-- Adds optional daily macro targets so users can track against a carb goal
-- (carbs-only plans) or a full protein/carbs/fat split. Calorie goal already
-- exists (profiles.daily_calorie_goal).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_carb_goal int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_protein_goal int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_fat_goal int;

-- (daily_calorie_goal is added by an earlier migration / already present.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_calorie_goal int;
