-- A tick you can see, and a tick you can prove.
--
-- Two things were true before this:
--
--   1. A challenge with its own checklist had no checklist on screen. The
--      ticks were fetched and never drawn (the list was stripped off the
--      Challenge tab in 092 along with the Today code), so members of
--      "100 Squats" and "Run 10km" could not tick anything at all.
--
--   2. A tick was a row with a task, a user and a date. Nothing on it could
--      show the others that the squats happened. A wager is a lot more fun
--      when the loser can't argue.
--
-- So a tick can now carry a photo or a short video, a challenge can insist
-- on one, and everyone in the challenge can see each other's ticks -- which
-- is what standings are for. The file lives in a private bucket and is read
-- through signed URLs that storage only mints for someone in the challenge.

-- --- the tick ------------------------------------------------------------------

ALTER TABLE public.challenge_task_logs
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS proof_type text
    CHECK (proof_type IS NULL OR proof_type IN ('image', 'video'));

ALTER TABLE public.group_challenges
  ADD COLUMN IF NOT EXISTS proof_required boolean NOT NULL DEFAULT false;

-- Members of a challenge see each other's ticks in it. RLS is permissive, so
-- "See own task ticks" still stands and this only widens.
DROP POLICY IF EXISTS "See ticks in a challenge you are in" ON public.challenge_task_logs;
CREATE POLICY "See ticks in a challenge you are in"
  ON public.challenge_task_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_tasks t
      JOIN public.group_challenge_members m
        ON m.challenge_id = t.challenge_id
       AND m.user_id = auth.uid()
      WHERE t.id = challenge_task_logs.task_id
    )
  );

-- Attaching proof to a tick that already exists is an update, and there was
-- no update policy at all. Only your own, only within the same window a tick
-- can be made in.
DROP POLICY IF EXISTS "Attach proof to own tick" ON public.challenge_task_logs;
CREATE POLICY "Attach proof to own tick"
  ON public.challenge_task_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND date <= current_date AND date >= current_date - 1);

-- --- the file ------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'challenge-proof', 'challenge-proof', false, 52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Files live under <user id>/... so ownership is in the path.
DROP POLICY IF EXISTS "Upload own proof" ON storage.objects;
CREATE POLICY "Upload own proof"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'challenge-proof'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Remove own proof" ON storage.objects;
CREATE POLICY "Remove own proof"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'challenge-proof'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Yours always. Anyone else's when it is on a tick in a challenge you're in.
DROP POLICY IF EXISTS "See proof in a challenge you are in" ON storage.objects;
CREATE POLICY "See proof in a challenge you are in"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'challenge-proof'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.challenge_task_logs l
        JOIN public.challenge_tasks t ON t.id = l.task_id
        JOIN public.group_challenge_members m
          ON m.challenge_id = t.challenge_id
         AND m.user_id = auth.uid()
        WHERE l.proof_path = storage.objects.name
      )
    )
  );

-- --- the score -----------------------------------------------------------------

-- When a challenge asks for proof, a tick without any is a promise, not a
-- day. Everything else is 050's rule: any three of the day's tasks.
CREATE OR REPLACE FUNCTION public.recalc_my_challenge_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  m record;
  n integer; last_day date; window_end date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  FOR m IN
    SELECT gcm.id, gcm.start_date, gcm.challenge_id, c.length_days, c.proof_required
    FROM group_challenge_members gcm
    JOIN group_challenges c ON c.id = gcm.challenge_id
    WHERE gcm.user_id = me AND gcm.status <> 'left'
  LOOP
    window_end := LEAST(current_date, m.start_date + m.length_days - 1);

    IF EXISTS (SELECT 1 FROM challenge_tasks t WHERE t.challenge_id = m.challenge_id) THEN
      SELECT count(*), max(day) INTO n, last_day FROM (
        WITH days AS (
          SELECT d::date AS day
          FROM generate_series(m.start_date, window_end, interval '1 day') AS d
        ),
        due AS (
          SELECT days.day, t.id AS task_id
          FROM days
          JOIN challenge_tasks t
            ON t.challenge_id = m.challenge_id
           AND t.created_at <= (days.day + interval '1 day' - interval '1 second')
        ),
        tally AS (
          SELECT due.day,
                 count(*) AS n_due,
                 count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM challenge_task_logs l
                   WHERE l.task_id = due.task_id AND l.user_id = me AND l.date = due.day
                     AND (NOT m.proof_required OR l.proof_path IS NOT NULL))) AS n_done
          FROM due
          GROUP BY due.day
        )
        SELECT day FROM tally
        WHERE n_due > 0 AND n_done >= LEAST(3, n_due)
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
