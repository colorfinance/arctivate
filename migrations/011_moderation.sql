-- Arctivate moderation layer (Apple UGC guideline 1.2)
-- Adds: user blocking, content reporting, soft-hide for offending posts,
-- and RPCs callable from the client under RLS.
--
-- Foreign keys point at auth.users (always present on Supabase) so this
-- migration runs on projects where public.profiles hasn't been created yet.

-- 1. User blocks -------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
  for delete using (auth.uid() = blocker_id);

-- 2. Content reports ---------------------------------------------------------
create table if not exists public.content_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('feed', 'message', 'user', 'dm')),
  content_id uuid not null,
  reason text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz default now() not null
);

create index if not exists content_reports_content_idx
  on public.content_reports (content_type, content_id);
create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at);

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert_auth on public.content_reports;
create policy content_reports_insert_auth on public.content_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own on public.content_reports
  for select using (auth.uid() = reporter_id);

-- 3. Soft-hide columns -------------------------------------------------------
-- Guarded so the migration still succeeds on projects that haven't created
-- the public_feed / community_messages tables yet.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'public_feed') then
    execute 'alter table public.public_feed add column if not exists hidden_at timestamptz';
  end if;
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'community_messages') then
    execute 'alter table public.community_messages add column if not exists hidden_at timestamptz';
  end if;
end $$;

-- 4. RPCs --------------------------------------------------------------------

-- Block / unblock another user.
create or replace function public.block_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if p_user_id is null or p_user_id = v_me then
    return jsonb_build_object('success', false, 'error', 'invalid_target');
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
    values (v_me, p_user_id)
    on conflict do nothing;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  delete from public.user_blocks
    where blocker_id = v_me and blocked_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.unblock_user(uuid) to authenticated;

-- Report a piece of content. Auto-hides it immediately so the reporter no
-- longer sees it while moderators review (Apple 1.2 "immediately remove").
create or replace function public.report_content(
  p_content_type text,
  p_content_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if p_content_type not in ('feed', 'message', 'user', 'dm') then
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  insert into public.content_reports (reporter_id, content_type, content_id, reason)
    values (v_me, p_content_type, p_content_id, left(coalesce(p_reason, ''), 500));

  if p_content_type = 'feed'
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'public_feed'
                   and column_name = 'hidden_at') then
    execute 'update public.public_feed set hidden_at = now() where id = $1 and hidden_at is null'
      using p_content_id;
  elsif p_content_type = 'message'
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'community_messages'
                   and column_name = 'hidden_at') then
    execute 'update public.community_messages set hidden_at = now() where id = $1 and hidden_at is null'
      using p_content_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.report_content(text, uuid, text) to authenticated;

-- Let a user delete their own feed post / community message immediately.
create or replace function public.delete_own_feed_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'public_feed') then
    return jsonb_build_object('success', false, 'error', 'table_missing');
  end if;
  execute 'delete from public.public_feed where id = $1 and user_id = $2'
    using p_post_id, v_me;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return jsonb_build_object('success', false, 'error', 'not_found_or_not_owner');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.delete_own_feed_post(uuid) to authenticated;

create or replace function public.delete_own_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'community_messages') then
    return jsonb_build_object('success', false, 'error', 'table_missing');
  end if;
  execute 'delete from public.community_messages where id = $1 and user_id = $2'
    using p_message_id, v_me;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return jsonb_build_object('success', false, 'error', 'not_found_or_not_owner');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.delete_own_message(uuid) to authenticated;

