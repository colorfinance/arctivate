-- Migration 017: Per-user food favourites
-- Date: 2026-07-17
--
-- Users can save foods (their own custom entries or logged meals) as
-- favourites for quick one-tap re-logging.

CREATE TABLE IF NOT EXISTS public.food_favourites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  calories int not null default 0,
  macros jsonb,               -- { "p": 20, "c": 40, "f": 10 }
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_food_favourites_user ON public.food_favourites(user_id, created_at DESC);

ALTER TABLE public.food_favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own food favourites" ON public.food_favourites;
CREATE POLICY "Users manage own food favourites"
  ON public.food_favourites FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
