-- Standings that mean something, and badges that certify real work.
--
-- Until now a challenge counted the days since you joined, so in a non-strict
-- challenge the leader was whoever joined first and ticking nothing cost you
-- nothing. This counts the days you actually completed.
--
-- It has to be the database that counts them. `habits` and `habit_logs` are
-- readable only by their owner, so no member's browser can see another
-- member's ticks — standings computed client-side would only ever know about
-- the person looking at them. The count therefore lives on the membership row,
-- which everyone can read, and is written by a function rather than by the
-- client, so a member cannot simply type a bigger number. That matters more
-- once there is money on the entry.

-- --- 1. What the standings read ---------------------------------------------

ALTER TABLE public.group_challenge_members
  ADD COLUMN IF NOT EXISTS days_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_done_date date,
  ADD COLUMN IF NOT EXISTS progress_checked_at timestamptz;

-- A day counts when every daily habit that already existed on it was ticked
-- for that date. Same rule the strict reset uses, so the two can never
-- disagree about what "a completed day" means.
CREATE OR REPLACE FUNCTION public.completed_days_for(uid uuid, since date)
RETURNS TABLE (day date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT d::date
  FROM generate_series(since, current_date, interval '1 day') AS d
  WHERE EXISTS (
          SELECT 1 FROM habits h
          WHERE h.user_id = uid AND coalesce(h.frequency,'daily') <> 'weekly'
            AND h.created_at <= (d + interval '1 day' - interval '1 second'))
    AND NOT EXISTS (
          SELECT 1 FROM habits h
          WHERE h.user_id = uid AND coalesce(h.frequency,'daily') <> 'weekly'
            AND h.created_at <= (d + interval '1 day' - interval '1 second')
            AND NOT EXISTS (
              SELECT 1 FROM habit_logs l
              WHERE l.habit_id = h.id AND l.user_id = uid AND l.date = d::date));
$$;

-- Recounts the caller's own progress in every challenge they are in.
-- SECURITY DEFINER so it can read the caller's habits, but it only ever looks
-- at auth.uid() — it cannot be pointed at anybody else.
CREATE OR REPLACE FUNCTION public.recalc_my_challenge_progress()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid(); m record; n integer; last_day date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  FOR m IN SELECT id, start_date FROM group_challenge_members
           WHERE user_id = me AND status <> 'left' LOOP
    SELECT count(*), max(day) INTO n, last_day FROM completed_days_for(me, m.start_date);
    UPDATE group_challenge_members
    SET days_done = coalesce(n,0), last_done_date = last_day, progress_checked_at = now()
    WHERE id = m.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.completed_days_for(uuid, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_my_challenge_progress() TO authenticated;

-- The client may still leave a challenge or restart, but it must not write its
-- own score. Table-level UPDATE is replaced with column-level grants.
REVOKE UPDATE ON public.group_challenge_members FROM authenticated;
GRANT UPDATE (status, start_date, last_checked, restarts)
  ON public.group_challenge_members TO authenticated;

-- --- 2. Badges ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.badges (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,              -- emoji, rendered as-is
  sort_order integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES public.badges(key) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  challenge_id uuid REFERENCES public.group_challenges(id) ON DELETE SET NULL,
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id, earned_at DESC);

INSERT INTO public.badges (key, name, description, icon, sort_order) VALUES
  ('first_join',   'In The Arena',    'Joined your first challenge',                   '🎟️', 10),
  ('first_day',    'Day One',         'Completed your first full day',                 '✅', 20),
  ('week_one',     'Seven Straight',  'Completed 7 days in one challenge',             '🔥', 30),
  ('halfway',      'Halfway',         'Reached the halfway point of a challenge',      '🌗', 40),
  ('finisher',     'Finisher',        'Completed every day of a challenge',            '🏆', 50),
  ('clean_run',    'Spotless',        'Finished a challenge without a single restart', '💎', 60),
  ('caller',       'Instigator',      'Challenged five different people',              '📣', 70),
  ('answered',     'Never Backs Down','Accepted a challenge someone sent you',         '🤝', 80)
ON CONFLICT (key) DO UPDATE
  SET name = excluded.name, description = excluded.description,
      icon = excluded.icon, sort_order = excluded.sort_order;

-- Awards whatever the caller has earned and returns only the new ones, so the
-- app knows what to celebrate. Badges are never taken away once given.
--
-- One statement rather than staging rows in a temp table: an unqualified
-- DELETE is refused on this database, and the CTE says the same thing more
-- directly anyway.
CREATE OR REPLACE FUNCTION public.award_my_badges()
RETURNS TABLE (key text, name text, description text, icon text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH earned AS (
    SELECT 'first_join'::text AS k WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND status <> 'left')
    UNION ALL SELECT 'first_day' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND days_done >= 1)
    UNION ALL SELECT 'week_one' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND days_done >= 7)
    UNION ALL SELECT 'halfway' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done * 2 >= c.length_days)
    UNION ALL SELECT 'finisher' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done >= c.length_days)
    UNION ALL SELECT 'clean_run' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done >= c.length_days AND coalesce(m.restarts,0) = 0)
    UNION ALL SELECT 'caller' WHERE (
      SELECT count(DISTINCT invitee_id) FROM challenge_invites WHERE inviter_id = me) >= 5
    UNION ALL SELECT 'answered' WHERE EXISTS (
      SELECT 1 FROM challenge_invites WHERE invitee_id = me AND status = 'accepted')
  ), inserted AS (
    INSERT INTO user_badges (user_id, badge_key)
    SELECT me, k FROM earned
    ON CONFLICT (user_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  SELECT b.key, b.name, b.description, b.icon
  FROM inserted i JOIN badges b ON b.key = i.badge_key
  ORDER BY b.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_my_badges() TO authenticated;

-- --- 3. Row level security ---------------------------------------------------

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read the badge list" ON public.badges;
CREATE POLICY "Anyone can read the badge list"
  ON public.badges FOR SELECT TO authenticated USING (true);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
-- Badges are a boast, so everyone can see everyone's.
DROP POLICY IF EXISTS "Anyone can see earned badges" ON public.user_badges;
CREATE POLICY "Anyone can see earned badges"
  ON public.user_badges FOR SELECT TO authenticated USING (true);

-- Only the award function writes them; there is deliberately no client
-- INSERT or UPDATE policy.
