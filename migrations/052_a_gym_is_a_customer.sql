-- A gym is a customer.
--
-- Everything the app does well is already scoped to a gym -- the leaderboard,
-- gym-vs-gym challenges, the partner check-in, "5 members are in" -- but a gym
-- could not be created, joined or run from inside the app. Every sign-up landed
-- in the one gym (035), and nobody could see how their members were doing.
--
-- This gives a gym an owner, a join code, a plan, and a pulse: the numbers an
-- owner opens the app for. Members stay free. The gym is who pays.

-- --- the gym ------------------------------------------------------------------

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS join_code text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pilot'
    CHECK (plan IN ('pilot', 'paid', 'lapsed')),
  ADD COLUMN IF NOT EXISTS pilot_ends_at date;

CREATE UNIQUE INDEX IF NOT EXISTS gyms_join_code_key ON public.gyms (join_code);

-- Six characters, no ambiguous ones, easy to say across a front desk.
CREATE OR REPLACE FUNCTION public.new_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gyms WHERE join_code = code);
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.gyms SET join_code = public.new_join_code() WHERE join_code IS NULL;

-- --- who runs it ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gym_staff (
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'coach')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gym_id, user_id)
);

ALTER TABLE public.gym_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_gym_staff(p_gym uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_staff s WHERE s.gym_id = p_gym AND s.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin
  );
$$;

DROP POLICY IF EXISTS "See staff of your gym" ON public.gym_staff;
CREATE POLICY "See staff of your gym"
  ON public.gym_staff FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR gym_id = (SELECT gym_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_gym_staff(gym_id)
  );

DROP POLICY IF EXISTS "Owners add staff" ON public.gym_staff;
CREATE POLICY "Owners add staff"
  ON public.gym_staff FOR INSERT TO authenticated
  WITH CHECK (public.is_gym_staff(gym_id));

DROP POLICY IF EXISTS "Owners remove staff" ON public.gym_staff;
CREATE POLICY "Owners remove staff"
  ON public.gym_staff FOR DELETE TO authenticated
  USING (public.is_gym_staff(gym_id) AND user_id <> auth.uid());

-- Staff can rename their gym. The join code and the plan are not theirs to
-- edit by hand; the code comes from new_join_code() and the plan from billing.
DROP POLICY IF EXISTS "Staff update their gym" ON public.gyms;
CREATE POLICY "Staff update their gym"
  ON public.gyms FOR UPDATE TO authenticated
  USING (public.is_gym_staff(id))
  WITH CHECK (public.is_gym_staff(id));

-- --- creating and joining ------------------------------------------------------

-- Anyone can start a gym. They become its owner, they move into it, and it
-- starts on a 30-day pilot.
CREATE OR REPLACE FUNCTION public.create_gym(p_name text, p_city text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  clean text := left(btrim(coalesce(p_name, '')), 60);
  g public.gyms%ROWTYPE;
  base_slug text;
  s text;
  n int := 0;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF length(clean) < 2 THEN RAISE EXCEPTION 'A gym needs a name'; END IF;

  base_slug := regexp_replace(lower(clean), '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'gym'; END IF;
  s := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.gyms WHERE slug = s) LOOP
    n := n + 1; s := base_slug || '-' || n;
  END LOOP;

  INSERT INTO public.gyms (name, slug, city, join_code, plan, pilot_ends_at)
  VALUES (clean, s, nullif(btrim(coalesce(p_city, '')), ''), public.new_join_code(), 'pilot', current_date + 30)
  RETURNING * INTO g;

  INSERT INTO public.gym_staff (gym_id, user_id, role) VALUES (g.id, me, 'owner');
  UPDATE public.profiles SET gym_id = g.id WHERE id = me;

  RETURN jsonb_build_object('id', g.id, 'name', g.name, 'join_code', g.join_code, 'plan', g.plan, 'pilot_ends_at', g.pilot_ends_at);
END;
$$;

-- A member joins with the code on the front desk. Moving gym keeps everything
-- they have done; only who they are ranked against changes.
CREATE OR REPLACE FUNCTION public.join_gym(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  g public.gyms%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO g FROM public.gyms WHERE join_code = upper(btrim(coalesce(p_code, '')));
  IF NOT FOUND THEN RAISE EXCEPTION 'No gym has that code'; END IF;
  UPDATE public.profiles SET gym_id = g.id WHERE id = me;
  RETURN jsonb_build_object('id', g.id, 'name', g.name, 'city', g.city);
END;
$$;

-- --- the pulse -----------------------------------------------------------------

-- The numbers an owner opens the app for, in their own timezone. Only staff of
-- that gym get them; a member asking gets nothing.
--
-- "Active" means the member did anything the app records: a habit tick, a
-- challenge tick, a workout, a session, a meal. At risk is a member with a
-- streak that ends yesterday and nothing today. Quiet is a member who was
-- active this month but not this week.
CREATE OR REPLACE FUNCTION public.gym_pulse(p_gym uuid, p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  today date;
  result jsonb;
BEGIN
  IF NOT public.is_gym_staff(p_gym) THEN RAISE EXCEPTION 'not staff of this gym'; END IF;
  BEGIN
    today := (now() AT TIME ZONE p_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    today := current_date;
  END;

  WITH members AS (
    SELECT p.id, coalesce(p.username, 'Member') AS name, p.avatar_url, u.created_at AS joined_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.gym_id = p_gym AND coalesce(p.completed_onboarding, false)
  ),
  activity AS (
    SELECT l.user_id, l.date AS day FROM public.habit_logs l WHERE l.date >= today - 60
    UNION
    SELECT l.user_id, l.date FROM public.challenge_task_logs l WHERE l.date >= today - 60
    UNION
    SELECT w.user_id, (w.created_at AT TIME ZONE p_tz)::date FROM public.workout_logs w WHERE w.created_at >= now() - interval '61 days'
    UNION
    SELECT s.user_id, (s.created_at AT TIME ZONE p_tz)::date FROM public.workout_sessions s WHERE s.created_at >= now() - interval '61 days'
    UNION
    SELECT f.user_id, (f.eaten_at AT TIME ZONE p_tz)::date FROM public.food_logs f WHERE f.eaten_at >= now() - interval '61 days'
  ),
  act AS (
    SELECT a.user_id, a.day FROM activity a JOIN members m ON m.id = a.user_id
  ),
  last_seen AS (
    SELECT user_id, max(day) AS last_day FROM act GROUP BY user_id
  ),
  -- consecutive active days ending yesterday
  streaks AS (
    SELECT m.id AS user_id,
      (SELECT count(*) FROM generate_series(0, 60) AS g(k)
        WHERE NOT EXISTS (
          SELECT 1 FROM generate_series(0, g.k) AS h(j)
          WHERE NOT EXISTS (SELECT 1 FROM act a WHERE a.user_id = m.id AND a.day = today - 1 - h.j)
        )) AS to_yesterday
    FROM members m
  ),
  gym_ch AS (
    SELECT c.id, c.title
    FROM public.group_challenges c
    WHERE c.is_official AND c.gym_id = p_gym AND c.is_active
    ORDER BY c.created_at DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'today', today,
    'members', (SELECT count(*) FROM members),
    'active_today', (SELECT count(DISTINCT user_id) FROM act WHERE day = today),
    'active_7d', (SELECT count(DISTINCT user_id) FROM act WHERE day > today - 7),
    'active_30d', (SELECT count(DISTINCT user_id) FROM act WHERE day > today - 30),
    'signups_30d', (SELECT count(*) FROM members WHERE joined_at >= now() - interval '30 days'),
    'at_risk', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'avatar', m.avatar_url, 'streak', s.to_yesterday) ORDER BY s.to_yesterday DESC, m.name), '[]'::jsonb)
      FROM members m JOIN streaks s ON s.user_id = m.id
      WHERE s.to_yesterday >= 2
        AND NOT EXISTS (SELECT 1 FROM act a WHERE a.user_id = m.id AND a.day = today)
    ),
    'quiet', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'avatar', m.avatar_url, 'last_active', ls.last_day, 'days', today - ls.last_day) ORDER BY ls.last_day DESC, m.name), '[]'::jsonb)
      FROM members m JOIN last_seen ls ON ls.user_id = m.id
      WHERE ls.last_day <= today - 7 AND ls.last_day > today - 30
    ),
    'never_started', (SELECT count(*) FROM members m WHERE NOT EXISTS (SELECT 1 FROM act a WHERE a.user_id = m.id)),
    'challenge', (
      SELECT jsonb_build_object(
        'title', g.title,
        'in_it', (SELECT count(*) FROM public.group_challenge_members gm WHERE gm.challenge_id = g.id AND gm.status <> 'left'),
        'done_today', (
          SELECT count(*) FROM public.group_challenge_members gm
          WHERE gm.challenge_id = g.id AND gm.status <> 'left'
            AND EXISTS (SELECT 1 FROM public.completed_days_for(gm.user_id, today) d WHERE d.day = today)
        )
      ) FROM gym_ch g
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- --- locks --------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.new_join_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_gym_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_gym(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_gym(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gym_pulse(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gym_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_gym(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_gym(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_pulse(uuid, text) TO authenticated;
