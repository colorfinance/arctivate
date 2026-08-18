-- Each challenge gets its own daily checklist.
--
-- Until now a challenge judged you on your personal habit list, so two people
-- in the same challenge were doing different work, and joining three
-- challenges was the same effort as joining one. Now the creator sets the
-- tasks, everyone in the challenge ticks the same list on the challenge card,
-- and a day is banked when all of them are ticked.
--
-- A challenge with no tasks keeps the old behaviour — it counts your own
-- daily habits — so everything already running is unaffected and the rule
-- stays one sentence long.

CREATE TABLE IF NOT EXISTS public.challenge_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  title text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenge_tasks_challenge
  ON public.challenge_tasks(challenge_id, "position");

CREATE TABLE IF NOT EXISTS public.challenge_task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.challenge_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ctl_user_date ON public.challenge_task_logs(user_id, date);

-- --- Row level security -------------------------------------------------------

ALTER TABLE public.challenge_tasks ENABLE ROW LEVEL SECURITY;

-- Reading a task list goes through the parent challenge, so invite-only
-- challenges keep their tasks as private as themselves.
DROP POLICY IF EXISTS "Tasks visible with their challenge" ON public.challenge_tasks;
CREATE POLICY "Tasks visible with their challenge"
  ON public.challenge_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_challenges c WHERE c.id = challenge_id));

DROP POLICY IF EXISTS "Owner writes the task list" ON public.challenge_tasks;
CREATE POLICY "Owner writes the task list"
  ON public.challenge_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_challenges c
    WHERE c.id = challenge_id
      AND (c.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  ));

DROP POLICY IF EXISTS "Owner edits the task list" ON public.challenge_tasks;
CREATE POLICY "Owner edits the task list"
  ON public.challenge_tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_challenges c
    WHERE c.id = challenge_id
      AND (c.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  ));

DROP POLICY IF EXISTS "Owner prunes the task list" ON public.challenge_tasks;
CREATE POLICY "Owner prunes the task list"
  ON public.challenge_tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_challenges c
    WHERE c.id = challenge_id
      AND (c.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  ));

ALTER TABLE public.challenge_task_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "See own task ticks" ON public.challenge_task_logs;
CREATE POLICY "See own task ticks"
  ON public.challenge_task_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Ticks may only land on today or the still-open catch-up day, and only from
-- someone actually in the challenge. This is the backfill window enforced at
-- the database, so the API can't be used to paint history green.
DROP POLICY IF EXISTS "Tick within the window" ON public.challenge_task_logs;
CREATE POLICY "Tick within the window"
  ON public.challenge_task_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND date <= current_date
    AND date >= current_date - 1
    AND EXISTS (
      SELECT 1 FROM public.challenge_tasks t
      JOIN public.group_challenge_members m
        ON m.challenge_id = t.challenge_id AND m.user_id = auth.uid() AND m.status <> 'left'
      WHERE t.id = task_id
    )
  );

DROP POLICY IF EXISTS "Untick own" ON public.challenge_task_logs;
CREATE POLICY "Untick own"
  ON public.challenge_task_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- --- Scoring knows about tasks now ---------------------------------------------

-- Per-membership: task-based when the challenge has tasks, habit-based when it
-- doesn't. Days past the challenge length no longer count either way, so a
-- finished 30-day run reads D30, not D34.
CREATE OR REPLACE FUNCTION public.recalc_my_challenge_progress()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  m record;
  n integer; last_day date; window_end date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  FOR m IN
    SELECT gcm.id, gcm.start_date, gcm.challenge_id, c.length_days
    FROM group_challenge_members gcm
    JOIN group_challenges c ON c.id = gcm.challenge_id
    WHERE gcm.user_id = me AND gcm.status <> 'left'
  LOOP
    window_end := LEAST(current_date, m.start_date + m.length_days - 1);

    IF EXISTS (SELECT 1 FROM challenge_tasks t WHERE t.challenge_id = m.challenge_id) THEN
      SELECT count(*), max(day) INTO n, last_day FROM (
        SELECT d::date AS day
        FROM generate_series(m.start_date, window_end, interval '1 day') AS d
        WHERE EXISTS (
                SELECT 1 FROM challenge_tasks t
                WHERE t.challenge_id = m.challenge_id
                  AND t.created_at <= (d + interval '1 day' - interval '1 second'))
          AND NOT EXISTS (
                SELECT 1 FROM challenge_tasks t
                WHERE t.challenge_id = m.challenge_id
                  AND t.created_at <= (d + interval '1 day' - interval '1 second')
                  AND NOT EXISTS (
                    SELECT 1 FROM challenge_task_logs l
                    WHERE l.task_id = t.id AND l.user_id = me AND l.date = d::date))
      ) x;
    ELSE
      SELECT count(*), max(day) INTO n, last_day
      FROM completed_days_for(me, m.start_date)
      WHERE day <= window_end;
    END IF;

    UPDATE group_challenge_members
    SET days_done = coalesce(n, 0),
        last_done_date = last_day,
        progress_checked_at = now()
    WHERE id = m.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_my_challenge_progress() TO authenticated;
