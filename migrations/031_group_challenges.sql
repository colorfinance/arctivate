-- Migration 031: Joinable group challenges
-- Date: 2026-08-16
--
-- Several challenges can run at once and members choose which to join.
--
-- Named group_challenges, NOT challenges: `challenges` is already the coach's
-- 24-hour daily challenge (live, 2 active, 26 completions) and repurposing it
-- would break that feature.
--
-- Each member keeps their own start_date inside a challenge. That means a late
-- joiner isn't judged on days before they arrived, and a strict reset can send
-- someone back to their own Day 1 without disturbing anyone else's count.

CREATE TABLE IF NOT EXISTS public.group_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  length_days integer NOT NULL DEFAULT 75,
  -- Miss a day of your daily habits and you go back to Day 1 of this challenge.
  strict boolean NOT NULL DEFAULT false,
  -- Whether it still accepts new members / shows in the list.
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT group_challenges_length_check CHECK (length_days > 0 AND length_days <= 400)
);

CREATE TABLE IF NOT EXISTS public.group_challenge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  -- This member's Day 1. Moves forward on a strict reset.
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  restarts integer NOT NULL DEFAULT 0,
  -- Stops the strict check re-walking days it has already judged.
  last_checked date,
  UNIQUE (challenge_id, user_id),
  CONSTRAINT group_challenge_members_status_check
    CHECK (status IN ('active', 'completed', 'left'))
);

CREATE INDEX IF NOT EXISTS idx_gcm_user ON public.group_challenge_members(user_id);
CREATE INDEX IF NOT EXISTS idx_gcm_challenge ON public.group_challenge_members(challenge_id);
CREATE INDEX IF NOT EXISTS idx_gc_active ON public.group_challenges(is_active) WHERE is_active;

-- --- Row level security ------------------------------------------------------

ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can browse challenges to decide whether to join.
DROP POLICY IF EXISTS "Members can view group challenges" ON public.group_challenges;
CREATE POLICY "Members can view group challenges"
  ON public.group_challenges FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create group challenges" ON public.group_challenges;
CREATE POLICY "Admins can create group challenges"
  ON public.group_challenges FOR INSERT
  TO authenticated
  WITH CHECK (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update group challenges" ON public.group_challenges;
CREATE POLICY "Admins can update group challenges"
  ON public.group_challenges FOR UPDATE
  TO authenticated
  USING (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can delete group challenges" ON public.group_challenges;
CREATE POLICY "Admins can delete group challenges"
  ON public.group_challenges FOR DELETE
  TO authenticated
  USING (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

ALTER TABLE public.group_challenge_members ENABLE ROW LEVEL SECURITY;

-- Memberships are visible to everyone signed in: a challenge you can't see the
-- other entrants of isn't a group challenge. Consistent with the feed already
-- showing who trained.
DROP POLICY IF EXISTS "Members can view challenge membership" ON public.group_challenge_members;
CREATE POLICY "Members can view challenge membership"
  ON public.group_challenge_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Members can join challenges" ON public.group_challenge_members;
CREATE POLICY "Members can join challenges"
  ON public.group_challenge_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update own membership" ON public.group_challenge_members;
CREATE POLICY "Members can update own membership"
  ON public.group_challenge_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can leave challenges" ON public.group_challenge_members;
CREATE POLICY "Members can leave challenges"
  ON public.group_challenge_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- --- Keeping the standings honest -------------------------------------------
--
-- Members need UPDATE on their own row (joining, leaving, strict resets), but
-- that also lets someone backdate start_date and appear near the top of the
-- leaderboard. RLS can't express "not before the challenge began", so a trigger
-- does it: your Day 1 can't be before the challenge started, and can't be in
-- the future. Admins are exempt so they can fix a member's row by hand.

CREATE OR REPLACE FUNCTION public.gcm_validate_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_start date;
BEGIN
  IF exists(select 1 from public.profiles where id = auth.uid() and is_admin = true) THEN
    RETURN NEW;
  END IF;

  SELECT start_date INTO challenge_start
  FROM public.group_challenges WHERE id = NEW.challenge_id;

  IF challenge_start IS NOT NULL AND NEW.start_date < challenge_start THEN
    NEW.start_date := challenge_start;
  END IF;

  IF NEW.start_date > CURRENT_DATE THEN
    -- Joining before the off is fine; that's the challenge's own start date.
    IF challenge_start IS NULL OR NEW.start_date <> challenge_start THEN
      NEW.start_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gcm_validate_start_date_trg ON public.group_challenge_members;
CREATE TRIGGER gcm_validate_start_date_trg
  BEFORE INSERT OR UPDATE ON public.group_challenge_members
  FOR EACH ROW EXECUTE FUNCTION public.gcm_validate_start_date();
