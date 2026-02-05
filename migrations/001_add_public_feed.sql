-- Migration: Add Public Feed for Social Sharing
-- Created: 2024

-- 1. PUBLIC FEED TABLE
-- Stores shared workout achievements for the community feed
create table public.public_feed (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_data jsonb not null,
  -- Expected JSONB structure:
  -- {
  --   "exercise_name": "Bench Press",
  --   "value": 100,
  --   "metric_type": "weight",
  --   "is_new_pb": true,
  --   "points_earned": 150,
  --   "date": "2024-01-15"
  -- }
  created_at timestamptz default now() not null,
  likes_count int default 0 not null
);

-- Create index for efficient feed queries
create index idx_public_feed_created_at on public.public_feed(created_at desc);
create index idx_public_feed_user_id on public.public_feed(user_id);

-- 2. HIGH FIVES TABLE (to track who liked what, prevent duplicates)
create table public.high_fives (
  id uuid default gen_random_uuid() primary key,
  feed_id uuid references public.public_feed(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  -- Prevent duplicate likes from the same user
  unique(feed_id, user_id)
);

create index idx_high_fives_feed_id on public.high_fives(feed_id);
create index idx_high_fives_user_id on public.high_fives(user_id);

-- 3. ROW LEVEL SECURITY POLICIES

-- Enable RLS on public_feed
alter table public.public_feed enable row level security;

-- Policy: All authenticated users can read the feed
create policy "Authenticated users can read public feed"
  on public.public_feed for select
  to authenticated
  using (true);

-- Policy: Authenticated users can insert their own posts
create policy "Users can create their own posts"
  on public.public_feed for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Only the owner can delete their posts
create policy "Users can delete their own posts"
  on public.public_feed for delete
  to authenticated
  using (auth.uid() = user_id);

-- Policy: Only the owner can update their posts (for future editing)
create policy "Users can update their own posts"
  on public.public_feed for update
  to authenticated
  using (auth.uid() = user_id);

-- Enable RLS on high_fives
alter table public.high_fives enable row level security;

-- Policy: All authenticated users can read high fives
create policy "Authenticated users can read high fives"
  on public.high_fives for select
  to authenticated
  using (true);

-- Policy: Authenticated users can add high fives
create policy "Users can give high fives"
  on public.high_fives for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can remove their own high fives
create policy "Users can remove their high fives"
  on public.high_fives for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4. INCREMENT HIGH FIVE RPC FUNCTION
-- Allows users to 'like' a workout without duplicate votes
create or replace function increment_high_five(post_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  existing_high_five uuid;
  new_count int;
  result json;
begin
  -- Get current user
  current_user_id := auth.uid();

  if current_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Check if user already gave a high five
  select id into existing_high_five
  from public.high_fives
  where feed_id = post_id and user_id = current_user_id;

  if existing_high_five is not null then
    -- User already high-fived, remove it (toggle behavior)
    delete from public.high_fives where id = existing_high_five;

    -- Decrement the likes count
    update public.public_feed
    set likes_count = greatest(likes_count - 1, 0)
    where id = post_id
    returning likes_count into new_count;

    return json_build_object(
      'success', true,
      'action', 'removed',
      'likes_count', new_count
    );
  else
    -- Add new high five
    insert into public.high_fives (feed_id, user_id)
    values (post_id, current_user_id);

    -- Increment the likes count
    update public.public_feed
    set likes_count = likes_count + 1
    where id = post_id
    returning likes_count into new_count;

    return json_build_object(
      'success', true,
      'action', 'added',
      'likes_count', new_count
    );
  end if;

exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'Already high-fived');
  when others then
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function increment_high_five(uuid) to authenticated;
