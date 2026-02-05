-- Migration: Core Functionality Fixes
-- Fixes critical issues identified in code review

-- 1. ADD INCREMENT_POINTS RPC FUNCTION (CRITICAL - was missing)
create or replace function increment_points(row_id uuid, x int)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set total_points = total_points + x
  where id = row_id;
end;
$$;

grant execute on function increment_points(uuid, int) to authenticated;

-- 2. ADD USER_ID TO EXERCISES TABLE (CRITICAL - query was broken)
-- Allow null for global exercises, non-null for user-created
alter table public.exercises add column if not exists user_id uuid references public.profiles(id);

-- Create index for user exercises lookup
create index if not exists idx_exercises_user_id on public.exercises(user_id);

-- 3. ADD UNIQUE CONSTRAINT ON HABIT_LOGS (prevent duplicate daily completions)
alter table public.habit_logs add constraint habit_logs_unique_daily
  unique (user_id, habit_id, date);

-- 4. RLS POLICIES FOR EXERCISES TABLE
alter table public.exercises enable row level security;

-- Users can read global exercises (user_id is null) or their own exercises
create policy "Users can read global and own exercises"
  on public.exercises for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

-- Users can only insert their own exercises
create policy "Users can create own exercises"
  on public.exercises for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can only update/delete their own exercises
create policy "Users can update own exercises"
  on public.exercises for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own exercises"
  on public.exercises for delete
  to authenticated
  using (user_id = auth.uid());

-- 5. RLS POLICIES FOR HABITS TABLE
alter table public.habits enable row level security;

create policy "Users can read own habits"
  on public.habits for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own habits"
  on public.habits for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own habits"
  on public.habits for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own habits"
  on public.habits for delete
  to authenticated
  using (user_id = auth.uid());

-- 6. RLS POLICIES FOR HABIT_LOGS TABLE
alter table public.habit_logs enable row level security;

create policy "Users can read own habit logs"
  on public.habit_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own habit logs"
  on public.habit_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own habit logs"
  on public.habit_logs for delete
  to authenticated
  using (user_id = auth.uid());

-- 7. RLS POLICIES FOR WORKOUT_LOGS TABLE
alter table public.workout_logs enable row level security;

create policy "Users can read own workout logs"
  on public.workout_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own workout logs"
  on public.workout_logs for insert
  to authenticated
  with check (user_id = auth.uid());

-- 8. RLS POLICIES FOR FOOD_LOGS TABLE
alter table public.food_logs enable row level security;

create policy "Users can read own food logs"
  on public.food_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own food logs"
  on public.food_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own food logs"
  on public.food_logs for delete
  to authenticated
  using (user_id = auth.uid());

-- 9. RLS POLICIES FOR PERSONAL_BESTS TABLE
alter table public.personal_bests enable row level security;

create policy "Users can read own personal bests"
  on public.personal_bests for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can manage own personal bests"
  on public.personal_bests for all
  to authenticated
  using (user_id = auth.uid());

-- 10. CREATE PROFILE ON SIGNUP (Trigger function)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, total_points, current_streak, challenge_start_date, challenge_days_goal)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    0,
    0,
    now(),
    75
  );
  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 11. STREAK CALCULATION FUNCTION
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
    -- Check if user had any activity on this date
    select exists(
      select 1 from public.habit_logs where user_id = p_user_id and date = check_date
      union all
      select 1 from public.workout_logs where user_id = p_user_id and date(created_at) = check_date
    ) into has_activity;

    if has_activity then
      streak := streak + 1;
      check_date := check_date - interval '1 day';
    else
      -- If no activity today, check if we should start from yesterday
      if check_date = current_date then
        check_date := check_date - interval '1 day';
      else
        exit;
      end if;
    end if;

    -- Safety limit
    if streak > 1000 then exit; end if;
  end loop;

  -- Update the user's streak in profiles
  update public.profiles set current_streak = streak where id = p_user_id;

  return streak;
end;
$$;

grant execute on function calculate_streak(uuid) to authenticated;

-- 12. GET DAILY CALORIES FUNCTION
create or replace function get_daily_calories(p_user_id uuid, p_date date default current_date)
returns json
language plpgsql
security definer
as $$
declare
  total_cals int;
  total_protein int;
  total_carbs int;
  total_fat int;
begin
  select
    coalesce(sum(calories), 0),
    coalesce(sum((macros->>'p')::int), 0),
    coalesce(sum((macros->>'c')::int), 0),
    coalesce(sum((macros->>'f')::int), 0)
  into total_cals, total_protein, total_carbs, total_fat
  from public.food_logs
  where user_id = p_user_id
    and date(eaten_at) = p_date;

  return json_build_object(
    'calories', total_cals,
    'protein', total_protein,
    'carbs', total_carbs,
    'fat', total_fat
  );
end;
$$;

grant execute on function get_daily_calories(uuid, date) to authenticated;

-- 13. ENSURE PROFILES HAS REQUIRED COLUMNS
alter table public.profiles add column if not exists challenge_start_date timestamptz default now();
alter table public.profiles add column if not exists challenge_days_goal int default 75;
alter table public.profiles add column if not exists partner_id uuid references public.partners(id);
alter table public.profiles add column if not exists daily_calorie_goal int default 2800;
