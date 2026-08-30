-- Nobody joins a challenge because there is never one to join.
--
-- 49 members. Two challenges, both created by the admin account, both
-- invite-only, one membership row between them. A member opens the app's first
-- tab and reads "NOTHING RUNNING YET -- be the one who starts it", above a form
-- asking for nine decisions and a stranger to call out. So nobody starts one,
-- so there is still nothing to join. It has been that way since the tab shipped.
--
-- The habit tick is the thing that already works: 48 of 49 members have habits,
-- 876 ticks between them. What is missing is not the mechanic, it is a reason
-- to open the tab -- something already running, with people already in it.
--
-- So every gym gets one, permanently. It is created the first time a member of
-- that gym opens the page, not by a nightly job, so a gym that gains its first
-- member on a Sunday has a challenge on Sunday.
--
-- Each member's thirty days start the day THEY join (group_challenge_members
-- carries its own start_date, and challengeDay() counts from it). That is the
-- part that matters: there is no start line to have missed and no finish line
-- to wait for, so joining is never badly timed.

-- One per gym. The partial unique index is what makes ensure_gym_challenge()
-- safe when two members of the same gym open the page at the same moment --
-- one insert wins, the other reads the winner's row.
CREATE UNIQUE INDEX IF NOT EXISTS group_challenges_one_house_per_gym
  ON public.group_challenges (gym_id)
  WHERE is_official = true AND is_active = true AND gym_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_gym_challenge()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_gym  uuid;
  v_id   uuid;
begin
  if v_user is null then return null; end if;

  select gym_id into v_gym from public.profiles where id = v_user;
  -- A member with no gym has nobody to do it with; the page falls back to
  -- what it always showed.
  if v_gym is null then return null; end if;

  select id into v_id
  from public.group_challenges
  where gym_id = v_gym and is_official = true and is_active = true
  limit 1;
  if v_id is not null then return v_id; end if;

  begin
    insert into public.group_challenges (
      title, description, start_date, length_days, strict,
      visibility, gym_vs_gym, is_official, gym_id, is_active, created_by
    ) values (
      'The Daily 3',
      'Three things, every day, for thirty days. Your whole gym is in it.',
      current_date, 30, false,
      'gym', false, true, v_gym, true,
      -- Nobody owns it, so nobody can quietly rewrite everyone's checklist.
      null
    )
    returning id into v_id;

    -- Short on purpose: three things you can finish on a bad day beat ten you
    -- cannot. Same list a new member gets for their own habits.
    insert into public.challenge_tasks (challenge_id, title, position) values
      (v_id, '45 minutes of movement', 0),
      (v_id, '3 litres of water', 1),
      (v_id, '10 minutes of reading', 2);
  exception when unique_violation then
    -- Somebody else's insert won the race. Theirs is as good as ours.
    select id into v_id
    from public.group_challenges
    where gym_id = v_gym and is_official = true and is_active = true
    limit 1;
  end;

  return v_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function.
REVOKE EXECUTE ON FUNCTION public.ensure_gym_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_gym_challenge() TO authenticated, service_role;

-- How many people at your gym ticked everything off today. This is the line
-- that makes the tab worth opening tomorrow, and a browser cannot work it out
-- for itself -- it can only see its own owner's ticks.
CREATE OR REPLACE FUNCTION public.challenge_today(p_challenge_id uuid)
RETURNS TABLE (members integer, done_today integer, ticked_today integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH task_count AS (
    SELECT count(*)::int AS n FROM public.challenge_tasks t WHERE t.challenge_id = p_challenge_id
  ), per_member AS (
    SELECT m.user_id, count(l.*)::int AS ticks
    FROM public.group_challenge_members m
    LEFT JOIN public.challenge_task_logs l
      ON l.user_id = m.user_id
     AND l.date = current_date
     AND l.task_id IN (SELECT t.id FROM public.challenge_tasks t WHERE t.challenge_id = p_challenge_id)
    WHERE m.challenge_id = p_challenge_id AND m.status = 'active'
    GROUP BY m.user_id
  )
  SELECT
    (SELECT count(*)::int FROM per_member),
    -- Everything ticked. A challenge with no tasks has nothing to finish, so
    -- nobody counts as done rather than everybody.
    (SELECT count(*)::int FROM per_member p, task_count c WHERE c.n > 0 AND p.ticks >= c.n),
    (SELECT count(*)::int FROM per_member p WHERE p.ticks > 0);
$$;

REVOKE EXECUTE ON FUNCTION public.challenge_today(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_today(uuid) TO authenticated, service_role;
