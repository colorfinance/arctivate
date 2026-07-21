-- Migration 022: Pantry quantities, units & brands (Food)
-- Date: 2026-07-21
--
-- Rework favourites into a "pantry": each item stores its macros for a
-- REFERENCE amount (e.g. per 100 g, or per 1 wrap) + an optional brand.
-- When logging you enter how much you ate and the app scales the macros,
-- recording the actual quantity so meals are replicable.

-- ---- Pantry items: reference amount + unit + brand ----
ALTER TABLE public.food_favourites
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS base_qty numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_unit text NOT NULL DEFAULT 'serving';

-- Existing rows keep working as "per 1 serving" (their macros as-is).

-- ---- Food log: record the quantity/unit eaten + link to the pantry item ----
ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS favourite_id uuid REFERENCES public.food_favourites(id) ON DELETE SET NULL;
