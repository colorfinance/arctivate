-- Leaderboards per lift. Strava segments, for a gym.
--
-- Two things about the data shaped this.
--
-- First, exercises are not shared. Only three rows are gym-wide benchmarks
-- (5k Run, Bench Press, Deadlift); everything else is created per member, so
-- "Ski Erg" exists three times and "Lap" three times, one row each. Ranking by
-- exercise_id would produce a pile of one-person boards. Boards are keyed on
-- the trimmed, lowercased name plus metric type instead, so people doing the
-- same movement land on the same board whoever created their row.
--
-- Second, visibility. A board only ever counts lifts from sessions the member
-- chose to share with their gym, exactly like a Strava segment ignores private
-- activities. Every session in the database today is private (migration 041
-- backfilled history that way on purpose), so these boards start empty and fill
-- as people share. That is the honest behaviour: publishing someone's numbers
-- because they once logged them privately is not a leaderboard, it is a leak.
--
-- The functions are SECURITY DEFINER because they have to read across members,
-- and each one is pinned to the caller's own gym and to gym-visible sessions.

-- One row per lift with a board in the caller's gym.
CREATE OR REPLACE FUNCTION public.gym_lift_boards()
RETURNS TABLE (
  lift text,
  display_name text,
  metric_type text,
  entrants integer,
  leader_name text,
  leader_avatar text,
  leader_value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT gym_id FROM public.profiles WHERE id = auth.uid()
  ),
  shared AS (
    SELECT
      lower(btrim(e.name)) AS lift,
      btrim(e.name)        AS display_name,
      COALESCE(e.metric_type, 'weight') AS metric_type,
      l.user_id,
      l.value
    FROM public.workout_logs l
    JOIN public.workout_sessions s ON s.id = l.session_id
    JOIN public.exercises e        ON e.id = l.exercise_id
    CROSS JOIN me
    WHERE s.visibility = 'gym'
      AND s.ended_at IS NOT NULL
      AND s.gym_id IS NOT NULL
      AND me.gym_id IS NOT NULL
      AND s.gym_id = me.gym_id
  ),
  -- The spelling most people used, rather than whichever happens to sort
  -- first: min() picked "bench press zz" over "Bench Press ZZ".
  names AS (
    SELECT lift, metric_type, mode() WITHIN GROUP (ORDER BY display_name) AS display_name
    FROM shared GROUP BY lift, metric_type
  ),
  -- One entry per member per lift: their best, direction depending on metric.
  bests AS (
    SELECT lift, metric_type, user_id,
           CASE WHEN metric_type = 'time' THEN min(value) ELSE max(value) END AS best
    FROM shared
    GROUP BY lift, metric_type, user_id
  ),
  ranked AS (
    SELECT b.*,
           row_number() OVER (
             PARTITION BY b.lift, b.metric_type
             ORDER BY CASE WHEN b.metric_type = 'time' THEN b.best END ASC NULLS LAST,
                      CASE WHEN b.metric_type <> 'time' THEN b.best END DESC NULLS LAST
           ) AS pos,
           -- Counted here rather than in the outer SELECT. WHERE runs before
           -- window functions, so counting out there only ever saw the single
           -- row that survived `pos = 1`, and every board claimed one entrant.
           count(*) OVER (PARTITION BY b.lift, b.metric_type)::int AS entrants
    FROM bests b
  )
  SELECT r.lift, n.display_name, r.metric_type, r.entrants, p.username, p.avatar_url, r.best
  FROM ranked r
  JOIN public.profiles p ON p.id = r.user_id
  JOIN names n ON n.lift = r.lift AND n.metric_type = r.metric_type
  WHERE r.pos = 1
  ORDER BY r.entrants DESC, n.display_name;
$function$;

-- The board itself, for one lift.
CREATE OR REPLACE FUNCTION public.gym_lift_board(p_lift text, p_metric text, p_limit integer DEFAULT 20)
RETURNS TABLE (
  board_position integer,
  user_id uuid,
  username text,
  avatar_url text,
  best numeric,
  achieved_at timestamp with time zone,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT gym_id FROM public.profiles WHERE id = auth.uid()
  ),
  shared AS (
    SELECT l.user_id, l.value, l.created_at
    FROM public.workout_logs l
    JOIN public.workout_sessions s ON s.id = l.session_id
    JOIN public.exercises e        ON e.id = l.exercise_id
    CROSS JOIN me
    WHERE s.visibility = 'gym'
      AND s.ended_at IS NOT NULL
      AND s.gym_id IS NOT NULL
      AND me.gym_id IS NOT NULL
      AND s.gym_id = me.gym_id
      AND lower(btrim(e.name)) = lower(btrim(p_lift))
      AND COALESCE(e.metric_type, 'weight') = COALESCE(p_metric, 'weight')
  ),
  bests AS (
    SELECT DISTINCT ON (user_id)
           user_id, value AS best, created_at
    FROM shared
    ORDER BY user_id,
             CASE WHEN COALESCE(p_metric,'weight') = 'time' THEN value END ASC NULLS LAST,
             CASE WHEN COALESCE(p_metric,'weight') <> 'time' THEN value END DESC NULLS LAST,
             created_at ASC
  )
  SELECT
    row_number() OVER (
      ORDER BY CASE WHEN COALESCE(p_metric,'weight') = 'time' THEN b.best END ASC NULLS LAST,
               CASE WHEN COALESCE(p_metric,'weight') <> 'time' THEN b.best END DESC NULLS LAST,
               b.created_at ASC
    )::int,
    b.user_id,
    p.username,
    p.avatar_url,
    b.best,
    b.created_at,
    (b.user_id = auth.uid())
  FROM bests b
  JOIN public.profiles p ON p.id = b.user_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$function$;

-- The caller's own best per lift, across ALL their sessions including private
-- ones -- it is their data. `on_board` says whether that best is one the gym
-- can see, which is what makes "share a session to get on the board" honest
-- rather than a nag.
CREATE OR REPLACE FUNCTION public.my_lift_bests()
RETURNS TABLE (
  lift text,
  display_name text,
  metric_type text,
  best numeric,
  achieved_at timestamp with time zone,
  on_board boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mine AS (
    SELECT
      lower(btrim(e.name)) AS lift,
      btrim(e.name)        AS display_name,
      COALESCE(e.metric_type, 'weight') AS metric_type,
      l.value,
      l.created_at,
      (s.id IS NOT NULL AND s.visibility = 'gym' AND s.ended_at IS NOT NULL) AS shared
    FROM public.workout_logs l
    JOIN public.exercises e ON e.id = l.exercise_id
    LEFT JOIN public.workout_sessions s ON s.id = l.session_id
    WHERE l.user_id = auth.uid()
  ),
  names AS (
    SELECT lift, metric_type, mode() WITHIN GROUP (ORDER BY display_name) AS display_name
    FROM mine GROUP BY lift, metric_type
  ),
  best AS (
    SELECT DISTINCT ON (lift, metric_type) lift, metric_type, value, created_at, shared
    FROM mine
    ORDER BY lift, metric_type,
             CASE WHEN metric_type = 'time' THEN value END ASC NULLS LAST,
             CASE WHEN metric_type <> 'time' THEN value END DESC NULLS LAST,
             created_at ASC
  )
  SELECT b.lift, n.display_name, b.metric_type, b.value, b.created_at, b.shared
  FROM best b JOIN names n ON n.lift = b.lift AND n.metric_type = b.metric_type
  ORDER BY n.display_name;
$function$;

REVOKE EXECUTE ON FUNCTION public.gym_lift_boards() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gym_lift_board(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_lift_bests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gym_lift_boards() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gym_lift_board(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_lift_bests() TO authenticated, service_role;

-- The board joins logs to sessions to exercises for every member of a gym, so
-- it wants an index that starts from the shared sessions rather than the member.
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_session
  ON public.workout_logs USING btree (exercise_id, session_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name_lower
  ON public.exercises USING btree (lower(btrim(name)));
