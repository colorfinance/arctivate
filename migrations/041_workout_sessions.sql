-- Sessions as the thing people see.
--
-- 741 exercise logs across 178 gym sessions, and six of them ever became
-- visible to another member. Sharing was an opt-in toggle on a single exercise
-- inside a success modal, so the unit was wrong (one lift, not a session) and
-- the default was wrong (silence). 425 of those logs were personal bests that
-- nobody else saw.
--
-- A session is now a real row with its own visibility, logs hang off it, and
-- finishing one puts it in front of the gym unless the member says otherwise.

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  notes text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  -- 'gym' is visible to other members of the same gym; 'private' is yours only.
  visibility text NOT NULL DEFAULT 'gym',
  gym_id uuid,
  daily_workout_id uuid,
  kudos_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_visibility_check CHECK ((visibility = ANY (ARRAY['gym'::text, 'private'::text])))
);

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE TABLE IF NOT EXISTS public.session_kudos (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_kudos_pkey PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.session_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_comments_pkey PRIMARY KEY (id),
  CONSTRAINT session_comments_body_check CHECK ((length(btrim(body)) > 0 AND length(body) <= 500))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_user_id_fkey') THEN
    -- profiles, not auth.users: PostgREST resolves `profiles:user_id (...)`
    -- from the foreign key, and an embed it cannot resolve fails the whole
    -- query. profiles.id is itself FK'd to auth.users ON DELETE CASCADE.
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_gym_id_fkey') THEN
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_gym_id_fkey
      FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_logs_session_id_fkey') THEN
    ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_kudos_session_id_fkey') THEN
    ALTER TABLE public.session_kudos ADD CONSTRAINT session_kudos_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_kudos_user_id_fkey') THEN
    ALTER TABLE public.session_kudos ADD CONSTRAINT session_kudos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_comments_session_id_fkey') THEN
    ALTER TABLE public.session_comments ADD CONSTRAINT session_comments_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_comments_user_id_fkey') THEN
    ALTER TABLE public.session_comments ADD CONSTRAINT session_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_feed ON public.workout_sessions USING btree (gym_id, started_at DESC) WHERE (visibility = 'gym');
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON public.workout_sessions USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_session ON public.workout_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_comments_session ON public.session_comments USING btree (session_id, created_at);

-- Can the caller see this session? Used by the log/kudos/comment policies so
-- the visibility rule lives in exactly one place.
CREATE OR REPLACE FUNCTION public.can_see_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.workout_sessions s
    WHERE s.id = p_session_id
      AND (
        s.user_id = auth.uid()
        OR (
          s.visibility = 'gym'
          AND s.gym_id IS NOT NULL
          AND s.gym_id = (SELECT p.gym_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.can_see_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_session(uuid) TO authenticated, service_role;

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_kudos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own or gym-visible sessions" ON public.workout_sessions;
CREATE POLICY "Members see own or gym-visible sessions" ON public.workout_sessions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (visibility = 'gym' AND gym_id IS NOT NULL
        AND gym_id = (SELECT p.gym_id FROM public.profiles p WHERE p.id = auth.uid()))
  );

DROP POLICY IF EXISTS "Members create own sessions" ON public.workout_sessions;
CREATE POLICY "Members create own sessions" ON public.workout_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members update own sessions" ON public.workout_sessions;
CREATE POLICY "Members update own sessions" ON public.workout_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own sessions" ON public.workout_sessions;
CREATE POLICY "Members delete own sessions" ON public.workout_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- kudos_count / comments_count are maintained by triggers, so a member must not
-- be able to hand themselves a hundred high fives by writing the column.
REVOKE UPDATE ON public.workout_sessions FROM authenticated;
GRANT UPDATE (title, notes, visibility, ended_at, daily_workout_id) ON public.workout_sessions TO authenticated;

DROP POLICY IF EXISTS "See kudos on sessions you can see" ON public.session_kudos;
CREATE POLICY "See kudos on sessions you can see" ON public.session_kudos FOR SELECT TO authenticated
  USING (public.can_see_session(session_id));

DROP POLICY IF EXISTS "Give kudos as yourself" ON public.session_kudos;
CREATE POLICY "Give kudos as yourself" ON public.session_kudos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_session(session_id));

DROP POLICY IF EXISTS "Take back your own kudos" ON public.session_kudos;
CREATE POLICY "Take back your own kudos" ON public.session_kudos FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "See comments on sessions you can see" ON public.session_comments;
CREATE POLICY "See comments on sessions you can see" ON public.session_comments FOR SELECT TO authenticated
  USING (public.can_see_session(session_id));

DROP POLICY IF EXISTS "Comment as yourself" ON public.session_comments;
CREATE POLICY "Comment as yourself" ON public.session_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_session(session_id));

-- Your own comment, or anything on your own session.
DROP POLICY IF EXISTS "Delete your comment or one on your session" ON public.session_comments;
CREATE POLICY "Delete your comment or one on your session" ON public.session_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- The feed has to show the lifts, so other members need to read the logs that
-- belong to a session they can see -- and nothing else. workout_logs keeps its
-- existing owner-only policy; this one only ever widens to rows whose session
-- is already visible, so a log with no session stays private as before.
DROP POLICY IF EXISTS "Read logs inside a visible session" ON public.workout_logs;
CREATE POLICY "Read logs inside a visible session" ON public.workout_logs FOR SELECT TO authenticated
  USING (session_id IS NOT NULL AND public.can_see_session(session_id));

CREATE OR REPLACE FUNCTION public.bump_session_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session uuid := COALESCE(NEW.session_id, OLD.session_id);
  v_delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
BEGIN
  IF TG_TABLE_NAME = 'session_kudos' THEN
    UPDATE public.workout_sessions
       SET kudos_count = GREATEST(0, kudos_count + v_delta)
     WHERE id = v_session;
  ELSE
    UPDATE public.workout_sessions
       SET comments_count = GREATEST(0, comments_count + v_delta)
     WHERE id = v_session;
  END IF;
  RETURN NULL;
END;
$function$;

-- A trigger function has no business being an RPC, and Postgres grants EXECUTE
-- on a new function to PUBLIC -- which put this on the REST API callable by
-- anon. Calling it outside a trigger errors on the missing NEW/OLD/TG_OP, so
-- nothing was exploitable, but this is the same mistake migration 037 cleaned up.
REVOKE EXECUTE ON FUNCTION public.bump_session_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_session_counts() TO service_role;

DROP TRIGGER IF EXISTS trg_session_kudos_count ON public.session_kudos;
CREATE TRIGGER trg_session_kudos_count
  AFTER INSERT OR DELETE ON public.session_kudos
  FOR EACH ROW EXECUTE FUNCTION public.bump_session_counts();

DROP TRIGGER IF EXISTS trg_session_comments_count ON public.session_comments;
CREATE TRIGGER trg_session_comments_count
  AFTER INSERT OR DELETE ON public.session_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_session_counts();

-- Backfill history as PRIVATE. Members logged these when nothing was shared,
-- and publishing them retroactively would be publishing work they did in
-- private. They get their history in the new shape; the gym sees none of it.
INSERT INTO public.workout_sessions (user_id, title, started_at, ended_at, visibility, gym_id, daily_workout_id, created_at)
SELECT
  g.user_id,
  COALESCE(dw.title, to_char(g.day, 'FMDay') || ' session'),
  g.first_at,
  g.last_at,
  'private',
  p.gym_id,
  g.daily_workout_id,
  g.first_at
FROM (
  SELECT user_id,
         created_at::date AS day,
         daily_workout_id,
         min(created_at) AS first_at,
         max(created_at) AS last_at
  FROM public.workout_logs
  WHERE session_id IS NULL
  GROUP BY user_id, created_at::date, daily_workout_id
) g
JOIN public.profiles p ON p.id = g.user_id
LEFT JOIN public.daily_workouts dw ON dw.id = g.daily_workout_id;

UPDATE public.workout_logs l
   SET session_id = s.id
  FROM public.workout_sessions s
 WHERE l.session_id IS NULL
   AND s.user_id = l.user_id
   AND s.visibility = 'private'
   AND l.created_at BETWEEN s.started_at AND s.ended_at
   AND COALESCE(s.daily_workout_id::text, '~') = COALESCE(l.daily_workout_id::text, '~');
