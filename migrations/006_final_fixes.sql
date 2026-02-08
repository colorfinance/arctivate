-- Migration 006: Final Fixes
-- Consolidates all remaining fixes with idempotent syntax

-- ===========================================
-- 1. ENSURE ALL RPC FUNCTIONS EXIST
-- ===========================================

-- increment_points: Award points to a user
create or replace function increment_points(row_id uuid, x int)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set total_points = coalesce(total_points, 0) + x
  where id = row_id;
end;
$$;

grant execute on function increment_points(uuid, int) to authenticated;

-- increment_high_five: Toggle high five on public feed
create or replace function increment_high_five(post_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  existing_high_five uuid;
  new_count int;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select id into existing_high_five
  from public.high_fives
  where feed_id = post_id and user_id = current_user_id;

  if existing_high_five is not null then
    delete from public.high_fives where id = existing_high_five;
    update public.public_feed
    set likes_count = greatest(likes_count - 1, 0)
    where id = post_id
    returning likes_count into new_count;

    return json_build_object('success', true, 'action', 'removed', 'likes_count', new_count);
  else
    insert into public.high_fives (feed_id, user_id) values (post_id, current_user_id);
    update public.public_feed
    set likes_count = likes_count + 1
    where id = post_id
    returning likes_count into new_count;

    return json_build_object('success', true, 'action', 'added', 'likes_count', new_count);
  end if;

exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'Already high-fived');
  when others then
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function increment_high_five(uuid) to authenticated;

-- toggle_message_like: Toggle like on community messages
create or replace function toggle_message_like(p_message_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing uuid;
  v_new_count int;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select id into v_existing from public.message_likes
  where message_id = p_message_id and user_id = v_user_id;

  if v_existing is not null then
    delete from public.message_likes where id = v_existing;
    update public.community_messages
    set likes_count = greatest(likes_count - 1, 0)
    where id = p_message_id
    returning likes_count into v_new_count;

    return json_build_object('success', true, 'action', 'unliked', 'likes_count', v_new_count);
  else
    insert into public.message_likes (message_id, user_id) values (p_message_id, v_user_id);
    update public.community_messages
    set likes_count = likes_count + 1
    where id = p_message_id
    returning likes_count into v_new_count;

    return json_build_object('success', true, 'action', 'liked', 'likes_count', v_new_count);
  end if;
end;
$$;

grant execute on function toggle_message_like(uuid) to authenticated;

-- calculate_streak: Calculate user's activity streak
create or replace function calculate_streak(p_user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  streak int := 0;
  check_date date := current_date;
  has_activity boolean;
begin
  loop
    select exists(
      select 1 from public.habit_logs where user_id = p_user_id and date = check_date
      union all
      select 1 from public.workout_logs where user_id = p_user_id and date(created_at) = check_date
    ) into has_activity;

    if has_activity then
      streak := streak + 1;
      check_date := check_date - interval '1 day';
    else
      if check_date = current_date then
        check_date := check_date - interval '1 day';
      else
        exit;
      end if;
    end if;

    if streak > 1000 then exit; end if;
  end loop;

  update public.profiles set current_streak = streak where id = p_user_id;
  return streak;
end;
$$;

grant execute on function calculate_streak(uuid) to authenticated;

-- redeem_code: Redeem reward codes or partner check-ins
create or replace function redeem_code(p_code text, p_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_reward record;
  v_partner record;
  v_points int;
begin
  if p_code is null or p_user_id is null then
    return json_build_object('success', false, 'error', 'Invalid parameters');
  end if;

  -- Find the reward code
  select * into v_reward from public.rewards_ledger where code = p_code;

  if v_reward is null then
    -- Check if it's a partner QR code
    select * into v_partner from public.partners where qr_uuid::text = p_code;

    if v_partner is not null then
      if exists(
        select 1 from public.check_ins
        where user_id = p_user_id and partner_id = v_partner.id
        and date(checked_in_at) = current_date
      ) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;

      v_points := 150;
      insert into public.check_ins (user_id, partner_id, awarded_points)
      values (p_user_id, v_partner.id, v_points);

      update public.profiles set total_points = coalesce(total_points, 0) + v_points where id = p_user_id;

      return json_build_object(
        'success', true, 'type', 'partner', 'points_awarded', v_points,
        'partner_name', v_partner.name, 'description', 'Checked in at ' || v_partner.name
      );
    end if;

    return json_build_object('success', false, 'error', 'Invalid code');
  end if;

  if v_reward.is_used then
    return json_build_object('success', false, 'error', 'Code already redeemed');
  end if;

  if v_reward.expires_at is not null and v_reward.expires_at < now() then
    return json_build_object('success', false, 'error', 'Code has expired');
  end if;

  update public.rewards_ledger
  set is_used = true, used_by = p_user_id, used_at = now()
  where id = v_reward.id;

  if v_reward.code_type = 'points' then
    update public.profiles set total_points = coalesce(total_points, 0) + v_reward.points_value where id = p_user_id;
    return json_build_object(
      'success', true, 'type', 'points', 'points_awarded', v_reward.points_value,
      'description', coalesce(v_reward.description, 'Points reward redeemed!')
    );
  end if;

  if v_reward.code_type = 'partner' then
    return json_build_object(
      'success', true, 'type', 'partner_access', 'partner_id', v_reward.partner_id,
      'description', coalesce(v_reward.description, 'Partner access granted!')
    );
  end if;

  return json_build_object('success', true, 'type', v_reward.code_type);
end;
$$;

grant execute on function redeem_code(text, uuid) to authenticated;

-- create_reward_code: Admin function to create reward codes
create or replace function create_reward_code(
  p_code text,
  p_code_type text,
  p_points_value int default 0,
  p_description text default null,
  p_name text default null,
  p_expires_at timestamptz default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_reward_id uuid;
begin
  v_user_id := auth.uid();
  select is_admin into v_is_admin from public.profiles where id = v_user_id;

  if not coalesce(v_is_admin, false) then
    return json_build_object('success', false, 'error', 'Admin access required');
  end if;

  if exists(select 1 from public.rewards_ledger where code = p_code) then
    return json_build_object('success', false, 'error', 'Code already exists');
  end if;

  insert into public.rewards_ledger (code, code_type, points_value, description, name, expires_at, created_by)
  values (p_code, p_code_type, p_points_value, p_description, p_name, p_expires_at, v_user_id)
  returning id into v_reward_id;

  return json_build_object('success', true, 'reward_id', v_reward_id);
end;
$$;

grant execute on function create_reward_code(text, text, int, text, text, timestamptz) to authenticated;

-- ===========================================
-- 2. ENSURE PROFILE COLUMNS EXIST
-- ===========================================

alter table public.profiles add column if not exists current_streak int default 0;
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists daily_calorie_goal int default 2800;

-- ===========================================
-- 3. ENSURE RLS POLICIES FOR ALL TABLES
-- ===========================================

-- Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles" on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

-- Habits RLS
alter table public.habits enable row level security;

drop policy if exists "Users can read own habits" on public.habits;
create policy "Users can read own habits" on public.habits for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create own habits" on public.habits;
create policy "Users can create own habits" on public.habits for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update own habits" on public.habits;
create policy "Users can update own habits" on public.habits for update to authenticated using (user_id = auth.uid());

drop policy if exists "Users can delete own habits" on public.habits;
create policy "Users can delete own habits" on public.habits for delete to authenticated using (user_id = auth.uid());

-- Habit Logs RLS
alter table public.habit_logs enable row level security;

drop policy if exists "Users can read own habit logs" on public.habit_logs;
create policy "Users can read own habit logs" on public.habit_logs for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create own habit logs" on public.habit_logs;
create policy "Users can create own habit logs" on public.habit_logs for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update own habit logs" on public.habit_logs;
create policy "Users can update own habit logs" on public.habit_logs for update to authenticated using (user_id = auth.uid());

drop policy if exists "Users can delete own habit logs" on public.habit_logs;
create policy "Users can delete own habit logs" on public.habit_logs for delete to authenticated using (user_id = auth.uid());

-- Food Logs RLS
alter table public.food_logs enable row level security;

drop policy if exists "Users can read own food logs" on public.food_logs;
create policy "Users can read own food logs" on public.food_logs for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create own food logs" on public.food_logs;
create policy "Users can create own food logs" on public.food_logs for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can delete own food logs" on public.food_logs;
create policy "Users can delete own food logs" on public.food_logs for delete to authenticated using (user_id = auth.uid());

-- ===========================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- ===========================================

create index if not exists idx_habit_logs_user_date on public.habit_logs(user_id, date);
create index if not exists idx_habit_logs_habit_date on public.habit_logs(habit_id, date);
create index if not exists idx_workout_logs_user_created on public.workout_logs(user_id, created_at desc);
create index if not exists idx_food_logs_user_eaten on public.food_logs(user_id, eaten_at desc);
create index if not exists idx_check_ins_user_date on public.check_ins(user_id, checked_in_at desc);
create index if not exists idx_rewards_ledger_code on public.rewards_ledger(code);
