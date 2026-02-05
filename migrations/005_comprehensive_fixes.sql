-- Migration: Comprehensive Fixes
-- Fixes food tracking, habits, check-in, and admin functionality

-- ===========================================
-- 1. FIX HABITS - Add missing RLS and constraints
-- ===========================================

-- Drop existing constraint if it exists (to avoid error on re-run)
alter table public.habit_logs drop constraint if exists habit_logs_unique_daily;

-- Add unique constraint (prevents duplicate logs for same habit on same day)
alter table public.habit_logs add constraint habit_logs_unique_daily
  unique (user_id, habit_id, date);

-- Ensure we have all RLS policies for habit_logs
drop policy if exists "Users can update own habit logs" on public.habit_logs;
create policy "Users can update own habit logs"
  on public.habit_logs for update
  to authenticated
  using (user_id = auth.uid());

-- ===========================================
-- 2. FIX FOOD LOGS - Add manual entry support
-- ===========================================

-- Add image_url column for food photos (optional)
alter table public.food_logs add column if not exists image_url text;

-- Add meal_type column for categorization
alter table public.food_logs add column if not exists meal_type text
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));

-- Add serving_size for better tracking
alter table public.food_logs add column if not exists serving_size text;

-- ===========================================
-- 3. REWARDS/CHECK-IN SYSTEM IMPROVEMENTS
-- ===========================================

-- Add is_admin column to profiles for admin users
alter table public.profiles add column if not exists is_admin boolean default false;

-- Add created_by to rewards_ledger for admin tracking
alter table public.rewards_ledger add column if not exists created_by uuid references public.profiles(id);

-- Add name for better display
alter table public.rewards_ledger add column if not exists name text;

-- Enable RLS on rewards_ledger
alter table public.rewards_ledger enable row level security;

-- Anyone can view active reward codes (for validation)
drop policy if exists "Anyone can view reward codes" on public.rewards_ledger;
create policy "Anyone can view reward codes"
  on public.rewards_ledger for select
  to authenticated
  using (true);

-- Admins can create reward codes
drop policy if exists "Admins can create reward codes" on public.rewards_ledger;
create policy "Admins can create reward codes"
  on public.rewards_ledger for insert
  to authenticated
  with check (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admins can update reward codes
drop policy if exists "Admins can update reward codes" on public.rewards_ledger;
create policy "Admins can update reward codes"
  on public.rewards_ledger for update
  to authenticated
  using (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admins can delete reward codes
drop policy if exists "Admins can delete reward codes" on public.rewards_ledger;
create policy "Admins can delete reward codes"
  on public.rewards_ledger for delete
  to authenticated
  using (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Enable RLS on check_ins
alter table public.check_ins enable row level security;

drop policy if exists "Users can view own check_ins" on public.check_ins;
create policy "Users can view own check_ins"
  on public.check_ins for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create check_ins" on public.check_ins;
create policy "Users can create check_ins"
  on public.check_ins for insert
  to authenticated
  with check (user_id = auth.uid());

-- Enable RLS on partners
alter table public.partners enable row level security;

drop policy if exists "Anyone can view partners" on public.partners;
create policy "Anyone can view partners"
  on public.partners for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage partners" on public.partners;
create policy "Admins can manage partners"
  on public.partners for all
  to authenticated
  using (
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ===========================================
-- 4. REDEEM CODE RPC FUNCTION (more robust)
-- ===========================================

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
  -- Validate inputs
  if p_code is null or p_user_id is null then
    return json_build_object('success', false, 'error', 'Invalid parameters');
  end if;

  -- Find the reward code
  select * into v_reward from public.rewards_ledger
  where code = p_code;

  -- Check if code exists
  if v_reward is null then
    -- Check if it's a partner QR code
    select * into v_partner from public.partners where qr_uuid::text = p_code;

    if v_partner is not null then
      -- Partner check-in
      -- Check if already checked in today
      if exists(
        select 1 from public.check_ins
        where user_id = p_user_id
        and partner_id = v_partner.id
        and date(checked_in_at) = current_date
      ) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;

      -- Award check-in points
      v_points := 150;

      insert into public.check_ins (user_id, partner_id, awarded_points)
      values (p_user_id, v_partner.id, v_points);

      -- Update user points
      update public.profiles
      set total_points = total_points + v_points
      where id = p_user_id;

      return json_build_object(
        'success', true,
        'type', 'partner',
        'points_awarded', v_points,
        'partner_name', v_partner.name,
        'description', 'Checked in at ' || v_partner.name
      );
    end if;

    return json_build_object('success', false, 'error', 'Invalid code');
  end if;

  -- Check if code is already used
  if v_reward.is_used then
    return json_build_object('success', false, 'error', 'Code already redeemed');
  end if;

  -- Check if code is expired
  if v_reward.expires_at is not null and v_reward.expires_at < now() then
    return json_build_object('success', false, 'error', 'Code has expired');
  end if;

  -- Redeem the code
  update public.rewards_ledger
  set is_used = true, used_by = p_user_id, used_at = now()
  where id = v_reward.id;

  -- Award points if it's a points reward
  if v_reward.code_type = 'points' then
    update public.profiles
    set total_points = total_points + v_reward.points_value
    where id = p_user_id;

    return json_build_object(
      'success', true,
      'type', 'points',
      'points_awarded', v_reward.points_value,
      'description', coalesce(v_reward.description, 'Points reward redeemed!')
    );
  end if;

  -- Partner access reward
  if v_reward.code_type = 'partner' then
    return json_build_object(
      'success', true,
      'type', 'partner_access',
      'partner_id', v_reward.partner_id,
      'description', coalesce(v_reward.description, 'Partner access granted!')
    );
  end if;

  return json_build_object('success', true, 'type', v_reward.code_type);
end;
$$;

grant execute on function redeem_code(text, uuid) to authenticated;

-- ===========================================
-- 5. CREATE REWARD CODE RPC (for admins)
-- ===========================================

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

  -- Check if user is admin
  select is_admin into v_is_admin from public.profiles where id = v_user_id;

  if not coalesce(v_is_admin, false) then
    return json_build_object('success', false, 'error', 'Admin access required');
  end if;

  -- Check if code already exists
  if exists(select 1 from public.rewards_ledger where code = p_code) then
    return json_build_object('success', false, 'error', 'Code already exists');
  end if;

  -- Create the reward code
  insert into public.rewards_ledger (code, code_type, points_value, description, name, expires_at, created_by)
  values (p_code, p_code_type, p_points_value, p_description, p_name, p_expires_at, v_user_id)
  returning id into v_reward_id;

  return json_build_object(
    'success', true,
    'reward_id', v_reward_id
  );
end;
$$;

grant execute on function create_reward_code(text, text, int, text, text, timestamptz) to authenticated;

-- ===========================================
-- 6. LOG FOOD RPC (for manual entry)
-- ===========================================

create or replace function log_food(
  p_item_name text,
  p_calories int,
  p_protein int default 0,
  p_carbs int default 0,
  p_fat int default 0,
  p_meal_type text default null,
  p_serving_size text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_log_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  insert into public.food_logs (user_id, item_name, calories, macros, meal_type, serving_size)
  values (
    v_user_id,
    p_item_name,
    p_calories,
    json_build_object('p', p_protein, 'c', p_carbs, 'f', p_fat),
    p_meal_type,
    p_serving_size
  )
  returning id into v_log_id;

  return json_build_object(
    'success', true,
    'log_id', v_log_id,
    'calories', p_calories
  );
end;
$$;

grant execute on function log_food(text, int, int, int, int, text, text) to authenticated;

-- ===========================================
-- 7. FIX PROFILES RLS
-- ===========================================

alter table public.profiles enable row level security;

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
