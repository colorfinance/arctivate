-- The streak was never real.
--
-- `profiles.current_streak` is read in four places -- a whole leaderboard tab,
-- the flame on the friends page, the coach page's "N-day streak", and the
-- context handed to the AI coach -- and nothing has ever written it. All 49
-- members sit at 0. So the streak board ranks everyone equal-last, the flame
-- never appears, and the coach is told every member has no streak while
-- telling them to protect it.
--
-- The one honest streak in the app is computed in the browser on the training
-- page, from workout_logs and workout_completions. It is never stored, so no
-- other page can see it, and it only counts training -- ticking five habits
-- every day for a month counts for nothing.
--
-- A streak is the whole daily hook, so it should mean "you showed up", not
-- "you lifted". A day counts if you did ANY of: logged a set, ticked a
-- workout complete, ticked a habit, or ticked a challenge task.
--
-- Computed at read time rather than cached in a column. A cached streak is
-- wrong the moment somebody stops opening the app -- it would keep showing 12
-- days for a member who quit a fortnight ago, which is the one number a
-- streak must never get wrong.

CREATE OR REPLACE FUNCTION public.member_streaks(p_tz text DEFAULT 'UTC')
RETURNS TABLE (
  user_id uuid,
  current_streak integer,
  longest_streak integer,
  active_today boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH tz AS (
    -- An unknown timezone name would abort the whole query, and a wrong
    -- streak is better than a blank page.
    SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names n WHERE n.name = p_tz)
                THEN p_tz ELSE 'UTC' END AS name
  ), today AS (
    SELECT ((now() AT TIME ZONE (SELECT name FROM tz))::date) AS d
  ), days AS (
    -- Everything that counts as showing up, in the viewer's own day frame.
    -- The three tick tables already store a local date; only workout_logs
    -- carries a timestamp, so only it needs converting.
    SELECT l.user_id, ((l.created_at AT TIME ZONE (SELECT name FROM tz))::date) AS d
    FROM public.workout_logs l
    UNION
    SELECT c.user_id, c.date FROM public.workout_completions c WHERE c.date IS NOT NULL
    UNION
    SELECT h.user_id, h.date FROM public.habit_logs h WHERE h.date IS NOT NULL
    UNION
    SELECT t.user_id, t.date FROM public.challenge_task_logs t WHERE t.date IS NOT NULL
  ), numbered AS (
    -- Consecutive dates share (date - row_number), which is the cheapest way
    -- to find runs of days without a recursive walk.
    SELECT d2.user_id, d2.d,
           d2.d - (row_number() OVER (PARTITION BY d2.user_id ORDER BY d2.d))::int AS grp
    FROM (SELECT DISTINCT user_id, d FROM days) d2
  ), runs AS (
    SELECT n.user_id, count(*)::int AS len, max(n.d) AS last_day
    FROM numbered n GROUP BY n.user_id, n.grp
  )
  SELECT
    r.user_id,
    -- A run only counts as current if it reaches today or yesterday. Today
    -- not being done yet must not read as a broken streak -- the day isn't
    -- over.
    coalesce(max(r.len) FILTER (WHERE r.last_day >= (SELECT d FROM today) - 1), 0)::int,
    max(r.len)::int,
    bool_or(r.last_day = (SELECT d FROM today))
  FROM runs r
  GROUP BY r.user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.member_streaks(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_streaks(text) TO authenticated, service_role;
