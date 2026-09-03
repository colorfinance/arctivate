-- A day only counted if you ticked every single habit you had.
--
-- Members average 6.7 daily habits; 35 of 49 have five, and several have nine
-- or ten. To bank a day you had to tick all of them.
--
-- Across the 189 days where somebody actually ticked something:
--
--   all of them (the rule)   77 days   41%
--   at least four           131 days   69%
--   at least three          155 days   82%
--   at least two            168 days   89%
--
-- So 59% of the days people showed up scored zero. They tick 4.9 out of 6.7 --
-- a good day -- and get nothing for it. And because the bar was "all of them",
-- adding a tenth habit retroactively made every future day harder: the keenest
-- members were punished the hardest. One member has nine habits and zero
-- banked days while being active enough to be in three challenges at once.
--
-- Three things banks the day. It counts 82% of real effort instead of 41%, it
-- is one sentence to explain, and it is already the name of the gym challenge
-- everyone is in: The Daily 3.
--
-- Somebody who keeps fewer than three habits still has to be able to finish a
-- day, so the bar is never higher than the number they actually keep.
--
-- This recalculates history: day counts will rise the next time somebody opens
-- the app. That is the point -- they did the work, the rule just wasn't
-- counting it.

CREATE OR REPLACE FUNCTION public.completed_days_for(uid uuid, since date)
RETURNS TABLE(day date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d::date
  FROM generate_series(since, current_date, interval '1 day') AS d
  WHERE (
    SELECT count(*) FROM public.habits h
    WHERE h.user_id = uid
      AND coalesce(h.frequency,'daily') <> 'weekly'
      AND h.created_at <= (d + interval '1 day' - interval '1 second')
  ) > 0
  AND (
    -- Ticked today, out of the habits that existed by the end of that day.
    SELECT count(*) FROM public.habits h
    WHERE h.user_id = uid
      AND coalesce(h.frequency,'daily') <> 'weekly'
      AND h.created_at <= (d + interval '1 day' - interval '1 second')
      AND EXISTS (
        SELECT 1 FROM public.habit_logs l
        WHERE l.habit_id = h.id AND l.user_id = uid AND l.date = d::date)
  ) >= LEAST(
    3,
    -- ...never asking for more than they keep.
    (SELECT count(*) FROM public.habits h
     WHERE h.user_id = uid
       AND coalesce(h.frequency,'daily') <> 'weekly'
       AND h.created_at <= (d + interval '1 day' - interval '1 second'))
  );
$$;
