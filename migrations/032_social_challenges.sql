-- Migration 032: Gyms, friends, and challenges anyone can start
-- Date: 2026-08-16
--
-- Turns challenges from something a coach runs for one gym into something
-- members run with each other: start your own, invite people, and see where
-- you stand against your friends, your gym, and other gyms.
--
-- Four parts:
--   1. gyms + profiles.gym_id      — the app had no gym concept at all
--   2. friendships                 — needed before "challenge a friend" means anything
--   3. group_challenges extensions — ownership, who can see it, gym-vs-gym
--   4. challenge_invites           — challenging someone directly

-- --- 1. Gyms ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  city text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_gym ON public.profiles(gym_id);

-- Everyone already using the app belongs to the original gym. Without this the
-- gym leaderboard would be empty for all 48 existing members on day one.
INSERT INTO public.gyms (name, slug, city)
SELECT 'Arctivate', 'arctivate', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.gyms WHERE slug = 'arctivate');

UPDATE public.profiles
SET gym_id = (SELECT id FROM public.gyms WHERE slug = 'arctivate')
WHERE gym_id IS NULL;

-- --- 2. Friendships ---------------------------------------------------------
--
-- One row per pair, not two. `least/greatest` on the ids keeps it that way, so
-- A→B and B→A can't both exist. requester_id records who asked, which is what
-- the pending-request UI needs.

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT friendships_order_check CHECK (user_a < user_b),
  CONSTRAINT friendships_not_self CHECK (user_a <> user_b),
  UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_a ON public.friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON public.friendships(user_b);

-- --- 3. Challenges anyone can start ------------------------------------------

ALTER TABLE public.group_challenges
  -- 'public'  anyone can find and join
  -- 'gym'     members of the owning gym
  -- 'invite'  only people invited
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'gym',
  -- Set by a coach, so official challenges can be told apart from member ones.
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  -- When true the standings are gym vs gym, scored on member averages so a
  -- big gym doesn't beat a small one on headcount alone.
  ADD COLUMN IF NOT EXISTS gym_vs_gym boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_challenges_visibility_check'
  ) THEN
    ALTER TABLE public.group_challenges
      ADD CONSTRAINT group_challenges_visibility_check
      CHECK (visibility IN ('public', 'gym', 'invite'));
  END IF;
END $$;

-- Everything that existed before this migration was created by a coach.
UPDATE public.group_challenges SET is_official = true WHERE created_by IS NOT NULL AND is_official = false;
UPDATE public.group_challenges
SET gym_id = (SELECT id FROM public.gyms WHERE slug = 'arctivate')
WHERE gym_id IS NULL;

-- --- 4. Invites --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.challenge_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT challenge_invites_status_check CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT challenge_invites_not_self CHECK (inviter_id <> invitee_id),
  UNIQUE (challenge_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_invites_invitee ON public.challenge_invites(invitee_id, status);

-- --- Row level security ------------------------------------------------------

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view gyms" ON public.gyms;
CREATE POLICY "Anyone can view gyms"
  ON public.gyms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage gyms" ON public.gyms;
CREATE POLICY "Admins manage gyms"
  ON public.gyms FOR ALL TO authenticated
  USING (exists(select 1 from public.profiles where id = auth.uid() and is_admin = true))
  WITH CHECK (exists(select 1 from public.profiles where id = auth.uid() and is_admin = true));

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- You only ever see friendships you're part of.
DROP POLICY IF EXISTS "See own friendships" ON public.friendships;
CREATE POLICY "See own friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Send friend requests" ON public.friendships;
CREATE POLICY "Send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND (auth.uid() = user_a OR auth.uid() = user_b)
    AND status = 'pending'
  );

-- Either side can update: the other accepts or declines, and either can later
-- unfriend. The trigger below stops you accepting your own request.
DROP POLICY IF EXISTS "Respond to friend requests" ON public.friendships;
CREATE POLICY "Respond to friend requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Remove friendships" ON public.friendships;
CREATE POLICY "Remove friendships"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Accepting has to be the other person's doing, or a request would be
-- pointless: the sender could simply mark it accepted themselves.
CREATE OR REPLACE FUNCTION public.friendship_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND auth.uid() = OLD.requester_id THEN
    RAISE EXCEPTION 'The other person has to accept a friend request';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendship_guard_trg ON public.friendships;
CREATE TRIGGER friendship_guard_trg
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendship_guard();

ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "See own invites" ON public.challenge_invites;
CREATE POLICY "See own invites"
  ON public.challenge_invites FOR SELECT TO authenticated
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

-- Anyone in a challenge can bring someone else into it.
DROP POLICY IF EXISTS "Invite to a challenge you are in" ON public.challenge_invites;
CREATE POLICY "Invite to a challenge you are in"
  ON public.challenge_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND (
      exists(select 1 from public.group_challenges c where c.id = challenge_id and c.created_by = auth.uid())
      OR exists(
        select 1 from public.group_challenge_members m
        where m.challenge_id = challenge_invites.challenge_id
          and m.user_id = auth.uid() and m.status <> 'left'
      )
    )
  );

DROP POLICY IF EXISTS "Respond to invites" ON public.challenge_invites;
CREATE POLICY "Respond to invites"
  ON public.challenge_invites FOR UPDATE TO authenticated
  USING (auth.uid() = invitee_id) WITH CHECK (auth.uid() = invitee_id);

DROP POLICY IF EXISTS "Withdraw invites" ON public.challenge_invites;
CREATE POLICY "Withdraw invites"
  ON public.challenge_invites FOR DELETE TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- --- Challenges: members can now create them ---------------------------------

DROP POLICY IF EXISTS "Admins can create group challenges" ON public.group_challenges;
DROP POLICY IF EXISTS "Members can create group challenges" ON public.group_challenges;
CREATE POLICY "Members can create group challenges"
  ON public.group_challenges FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    -- Only a coach can post an official challenge.
    AND (
      is_official = false
      OR exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
    )
  );

-- The owner runs their own challenge; admins can still step in.
DROP POLICY IF EXISTS "Admins can update group challenges" ON public.group_challenges;
DROP POLICY IF EXISTS "Owner or admin can update group challenges" ON public.group_challenges;
CREATE POLICY "Owner or admin can update group challenges"
  ON public.group_challenges FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can delete group challenges" ON public.group_challenges;
DROP POLICY IF EXISTS "Owner or admin can delete group challenges" ON public.group_challenges;
CREATE POLICY "Owner or admin can delete group challenges"
  ON public.group_challenges FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Invite-only challenges shouldn't be listed to people who weren't asked.
DROP POLICY IF EXISTS "Members can view group challenges" ON public.group_challenges;
CREATE POLICY "Members can view group challenges"
  ON public.group_challenges FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR created_by = auth.uid()
    OR (visibility = 'gym' AND (
          gym_id IS NULL
          OR gym_id = (select gym_id from public.profiles where id = auth.uid())
       ))
    OR exists(
      select 1 from public.challenge_invites i
      where i.challenge_id = group_challenges.id and i.invitee_id = auth.uid()
    )
    OR exists(
      select 1 from public.group_challenge_members m
      where m.challenge_id = group_challenges.id and m.user_id = auth.uid()
    )
  );
