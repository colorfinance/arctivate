-- Migration 009: Safety features for Apple Guideline 1.2 compliance
-- Blocked users, content reports, and delete-own-post support.

-- 1. Blocked users table
create table if not exists public.blocked_users (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can view own blocks" on public.blocked_users;
create policy "Users can view own blocks"
  on public.blocked_users for select
  using (auth.uid() = user_id);

drop policy if exists "Users can block others" on public.blocked_users;
create policy "Users can block others"
  on public.blocked_users for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unblock" on public.blocked_users;
create policy "Users can unblock"
  on public.blocked_users for delete
  using (auth.uid() = user_id);

-- 2. Content reports table
create table if not exists public.content_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  content_type text not null check (content_type in ('feed_post', 'community_message', 'direct_message')),
  content_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'hate_speech', 'inappropriate', 'other')),
  details text,
  status text default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz default now() not null
);

alter table public.content_reports enable row level security;

drop policy if exists "Users can create reports" on public.content_reports;
create policy "Users can create reports"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view own reports" on public.content_reports;
create policy "Users can view own reports"
  on public.content_reports for select
  using (auth.uid() = reporter_id);

-- 3. Allow users to delete their own public_feed posts
drop policy if exists "Users can delete own feed posts" on public.public_feed;
create policy "Users can delete own feed posts"
  on public.public_feed for delete
  using (auth.uid() = user_id);

-- 4. Allow users to delete their own community_messages
drop policy if exists "Users can delete own community messages" on public.community_messages;
create policy "Users can delete own community messages"
  on public.community_messages for delete
  using (auth.uid() = user_id);
