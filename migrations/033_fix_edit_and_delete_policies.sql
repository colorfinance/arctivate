-- Deleting a habit did nothing. Neither did deleting or editing a logged set.
--
-- All three were the same fault: the tables have row level security switched
-- on, but no policy covering the command. Postgres then removes or changes
-- nothing and reports no error, so the app's "if (error)" check passed, the
-- row vanished from the screen optimistically, and came back on the next load.
-- Members reported this as habits that "cross off instead of deleting".
--
-- Each policy below is scoped to the owner, matching the SELECT policies these
-- tables already had.

-- --- habits ------------------------------------------------------------------

DROP POLICY IF EXISTS "Users delete own habits" ON public.habits;
CREATE POLICY "Users delete own habits"
  ON public.habits FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- The old update policy admitted any signed-in user rather than the owner.
-- The owner-scoped SELECT policy meant nobody could actually reach someone
-- else's row through it, but the rule should say what it means.
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.habits;
DROP POLICY IF EXISTS "Users update own habits" ON public.habits;
CREATE POLICY "Users update own habits"
  ON public.habits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- workout_logs ------------------------------------------------------------

DROP POLICY IF EXISTS "Users update own logs" ON public.workout_logs;
CREATE POLICY "Users update own logs"
  ON public.workout_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own logs" ON public.workout_logs;
CREATE POLICY "Users delete own logs"
  ON public.workout_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
