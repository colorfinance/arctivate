-- Migration 018: Admin challenges + challenge reset
-- Date: 2026-07-19
--
-- Two things:
--   1. Admin-published "challenges" that show up in every user's Habits
--      (Protocol) list to tick off, alongside their personal habits.
--   2. A helper to reset every user's challenge back to Day 1.

-- ========================================== --
-- 1. CHALLENGES (admin-published, global)
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  points_reward int not null default 10,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges(created_at DESC) WHERE is_active = true;

-- ========================================== --
-- 2. CHALLENGE LOGS (per-user daily completion)
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.challenge_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  date date not null default CURRENT_DATE,
  completed_at timestamptz default now(),
  unique (user_id, challenge_id, date)
);

CREATE INDEX IF NOT EXISTS idx_challenge_logs_user_date ON public.challenge_logs(user_id, date);

-- ========================================== --
-- 3. ROW LEVEL SECURITY
-- ========================================== --
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_logs ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active challenges; admins can read all.
DROP POLICY IF EXISTS "Read active challenges" ON public.challenges;
CREATE POLICY "Read active challenges"
  ON public.challenges FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can create / update / delete challenges.
DROP POLICY IF EXISTS "Admins manage challenges" ON public.challenges;
CREATE POLICY "Admins manage challenges"
  ON public.challenges FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Users manage only their own challenge logs.
DROP POLICY IF EXISTS "Users manage own challenge logs" ON public.challenge_logs;
CREATE POLICY "Users manage own challenge logs"
  ON public.challenge_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================== --
-- 4. RESET EVERYONE TO DAY 1 (admin-only RPC)
-- ========================================== --
CREATE OR REPLACE FUNCTION public.reset_all_challenges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can reset challenges';
  END IF;

  UPDATE public.profiles SET challenge_start_date = now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_all_challenges() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_all_challenges() TO authenticated;
