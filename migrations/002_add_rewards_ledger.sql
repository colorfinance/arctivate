-- Migration: Add Rewards Ledger for QR Code Redemption
-- Created: 2024

-- 1. REWARDS LEDGER TABLE
-- Stores redeemable codes for points and partner access
create table public.rewards_ledger (
  id uuid default gen_random_uuid() primary key,
  code text unique not null, -- The QR code string (can be UUID or custom string)
  code_type text not null check (code_type in ('points', 'partner')),
  -- For 'points' type: the amount of points to award
  points_value int default 0,
  -- For 'partner' type: the partner to link
  partner_id uuid references public.partners(id),
  -- Redemption tracking
  is_used boolean default false,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  -- Metadata
  description text, -- Optional description like "Welcome Bonus" or "Partner: Record Recovery"
  expires_at timestamptz, -- Optional expiration date
  created_at timestamptz default now() not null
);

-- Create indexes for efficient lookups
create index idx_rewards_ledger_code on public.rewards_ledger(code);
create index idx_rewards_ledger_is_used on public.rewards_ledger(is_used) where is_used = false;

-- 2. ADD partner_id TO PROFILES (for B2B linking)
alter table public.profiles add column if not exists partner_id uuid references public.partners(id);

-- 3. ROW LEVEL SECURITY POLICIES

-- Enable RLS on rewards_ledger
alter table public.rewards_ledger enable row level security;

-- Policy: Authenticated users can read codes (to check validity)
create policy "Authenticated users can check codes"
  on public.rewards_ledger for select
  to authenticated
  using (true);

-- Policy: Only the system (via API route with service role) can insert/update codes
-- Regular users cannot modify the ledger directly

-- 4. RPC FUNCTION: REDEEM CODE
-- Handles the full redemption logic atomically
create or replace function redeem_code(code_string text, redeemer_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  reward record;
  result json;
begin
  -- Find the reward code
  select * into reward
  from public.rewards_ledger
  where code = code_string
  for update; -- Lock the row to prevent race conditions

  -- Check if code exists
  if reward is null then
    return json_build_object(
      'success', false,
      'error', 'Invalid code'
    );
  end if;

  -- Check if already used
  if reward.is_used then
    return json_build_object(
      'success', false,
      'error', 'Code already redeemed'
    );
  end if;

  -- Check if expired
  if reward.expires_at is not null and reward.expires_at < now() then
    return json_build_object(
      'success', false,
      'error', 'Code has expired'
    );
  end if;

  -- Process based on code type
  if reward.code_type = 'points' then
    -- Award points to the user
    update public.profiles
    set total_points = total_points + reward.points_value
    where id = redeemer_id;

    -- Mark code as used
    update public.rewards_ledger
    set is_used = true, used_by = redeemer_id, used_at = now()
    where id = reward.id;

    return json_build_object(
      'success', true,
      'type', 'points',
      'points_awarded', reward.points_value,
      'description', coalesce(reward.description, 'Points Reward')
    );

  elsif reward.code_type = 'partner' then
    -- Link user to partner
    update public.profiles
    set partner_id = reward.partner_id
    where id = redeemer_id;

    -- Mark code as used
    update public.rewards_ledger
    set is_used = true, used_by = redeemer_id, used_at = now()
    where id = reward.id;

    -- Get partner name for response
    return json_build_object(
      'success', true,
      'type', 'partner',
      'partner_id', reward.partner_id,
      'description', coalesce(reward.description, 'Partner Access Granted')
    );

  else
    return json_build_object(
      'success', false,
      'error', 'Unknown code type'
    );
  end if;

exception
  when others then
    return json_build_object(
      'success', false,
      'error', sqlerrm
    );
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function redeem_code(text, uuid) to authenticated;

-- 5. SAMPLE DATA (Optional - for testing)
-- Uncomment to add test codes
/*
insert into public.rewards_ledger (code, code_type, points_value, description)
values
  ('WELCOME100', 'points', 100, 'Welcome Bonus'),
  ('BONUS50', 'points', 50, 'Referral Bonus');
*/
