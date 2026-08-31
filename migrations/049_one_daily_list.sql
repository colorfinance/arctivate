-- The day's checklist existed twice.
--
-- 045 gave every gym The Daily 3 with its own three tasks -- 45 minutes of
-- movement, 3 litres of water, 10 minutes of reading. Those are almost exactly
-- the preset habits every member already has: "45 minutes of movement every
-- day", "3+ litres of water every day", "10+ minutes of self-development every
-- day".
--
-- So anyone who joined had to tick the same three things twice, in two tabs,
-- as two separate records. Checked against a real member: all three of her
-- Daily 3 tasks had a near-identical personal habit sitting beside them. That
-- is worse than what was there before, and it is my own doing.
--
-- The fix is a mechanism that already exists rather than a new one: a
-- challenge with no tasks of its own is scored against the member's personal
-- daily habits. recalc_my_challenge_progress() already branches on exactly
-- this, falling through to completed_days_for(), and the strict-mode check in
-- the client does the same. So The Daily 3 keeps no list, and the one list
-- lives with the habits.
--
-- The existing ticks are deliberately not migrated: participation so far is
-- test-level and the member's own habit ticks for those days already exist
-- where they now count.

-- The tasks, and their logs with them (challenge_task_logs cascades).
DELETE FROM public.challenge_tasks t
USING public.group_challenges c
WHERE t.challenge_id = c.id
  AND c.is_official = true
  AND c.title = 'The Daily 3';

-- And stop making them for gyms that get one from here on.
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
      'Your daily habits, every day, for thirty days. Your whole gym is in it.',
      current_date, 30, false,
      'gym', false, true, v_gym, true,
      null
    )
    returning id into v_id;
    -- No task list on purpose. With none of its own it is scored on each
    -- member's daily habits, so there is one place to tick and one set of
    -- records behind it.
  exception when unique_violation then
    select id into v_id
    from public.group_challenges
    where gym_id = v_gym and is_official = true and is_active = true
    limit 1;
  end;

  return v_id;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_gym_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_gym_challenge() TO authenticated, service_role;

-- The description on the gym challenges that already exist should match.
UPDATE public.group_challenges
SET description = 'Your daily habits, every day, for thirty days. Your whole gym is in it.'
WHERE is_official = true AND title = 'The Daily 3';
