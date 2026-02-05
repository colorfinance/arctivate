-- Migration: Social Features - Messaging and Groups
-- Created: 2024

-- ===========================================
-- 1. GROUPS TABLE
-- ===========================================
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  is_public boolean default true,
  member_count int default 1,
  created_at timestamptz default now() not null
);

create index idx_groups_created_at on public.groups(created_at desc);
create index idx_groups_created_by on public.groups(created_by);

-- ===========================================
-- 2. GROUP MEMBERS TABLE
-- ===========================================
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

create index idx_group_members_group_id on public.group_members(group_id);
create index idx_group_members_user_id on public.group_members(user_id);

-- ===========================================
-- 3. COMMUNITY MESSAGES TABLE
-- ===========================================
create table public.community_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade, -- null = global feed
  content text not null,
  message_type text default 'text' check (message_type in ('text', 'workout', 'achievement', 'milestone')),
  -- For workout/achievement posts, store additional data
  metadata jsonb,
  likes_count int default 0,
  replies_count int default 0,
  created_at timestamptz default now() not null
);

create index idx_community_messages_created_at on public.community_messages(created_at desc);
create index idx_community_messages_user_id on public.community_messages(user_id);
create index idx_community_messages_group_id on public.community_messages(group_id);

-- ===========================================
-- 4. MESSAGE LIKES TABLE
-- ===========================================
create table public.message_likes (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.community_messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(message_id, user_id)
);

create index idx_message_likes_message_id on public.message_likes(message_id);

-- ===========================================
-- 5. MESSAGE REPLIES TABLE
-- ===========================================
create table public.message_replies (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.community_messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now() not null
);

create index idx_message_replies_message_id on public.message_replies(message_id);

-- ===========================================
-- 6. ROW LEVEL SECURITY
-- ===========================================

-- Groups RLS
alter table public.groups enable row level security;

create policy "Anyone can view public groups"
  on public.groups for select
  to authenticated
  using (is_public = true or exists(
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid()
  ));

create policy "Authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Group owners can update their groups"
  on public.groups for update
  to authenticated
  using (created_by = auth.uid() or exists(
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role in ('owner', 'admin')
  ));

create policy "Group owners can delete their groups"
  on public.groups for delete
  to authenticated
  using (created_by = auth.uid());

-- Group Members RLS
alter table public.group_members enable row level security;

create policy "Users can view group members"
  on public.group_members for select
  to authenticated
  using (true);

create policy "Users can join public groups"
  on public.group_members for insert
  to authenticated
  with check (
    auth.uid() = user_id and
    exists(select 1 from public.groups where id = group_id and is_public = true)
  );

create policy "Users can leave groups"
  on public.group_members for delete
  to authenticated
  using (user_id = auth.uid() or exists(
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
    and gm.user_id = auth.uid()
    and gm.role in ('owner', 'admin')
  ));

-- Community Messages RLS
alter table public.community_messages enable row level security;

create policy "Users can view messages"
  on public.community_messages for select
  to authenticated
  using (
    group_id is null or -- global messages
    exists(select 1 from public.group_members where group_id = community_messages.group_id and user_id = auth.uid())
  );

create policy "Users can create messages"
  on public.community_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id and
    (group_id is null or exists(select 1 from public.group_members where group_id = community_messages.group_id and user_id = auth.uid()))
  );

create policy "Users can delete own messages"
  on public.community_messages for delete
  to authenticated
  using (user_id = auth.uid());

-- Message Likes RLS
alter table public.message_likes enable row level security;

create policy "Users can view likes"
  on public.message_likes for select
  to authenticated
  using (true);

create policy "Users can like messages"
  on public.message_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unlike messages"
  on public.message_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- Message Replies RLS
alter table public.message_replies enable row level security;

create policy "Users can view replies"
  on public.message_replies for select
  to authenticated
  using (true);

create policy "Users can create replies"
  on public.message_replies for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own replies"
  on public.message_replies for delete
  to authenticated
  using (user_id = auth.uid());

-- ===========================================
-- 7. RPC FUNCTIONS
-- ===========================================

-- Create Group Function
create or replace function create_group(
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Create the group
  insert into public.groups (name, description, is_public, created_by)
  values (p_name, p_description, p_is_public, v_user_id)
  returning id into v_group_id;

  -- Add creator as owner
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'owner');

  return json_build_object(
    'success', true,
    'group_id', v_group_id
  );
end;
$$;

grant execute on function create_group(text, text, boolean) to authenticated;

-- Join Group Function
create or replace function join_group(p_group_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_group record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Check if group exists and is public
  select * into v_group from public.groups where id = p_group_id;

  if v_group is null then
    return json_build_object('success', false, 'error', 'Group not found');
  end if;

  if not v_group.is_public then
    return json_build_object('success', false, 'error', 'Group is private');
  end if;

  -- Check if already a member
  if exists(select 1 from public.group_members where group_id = p_group_id and user_id = v_user_id) then
    return json_build_object('success', false, 'error', 'Already a member');
  end if;

  -- Join the group
  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, v_user_id, 'member');

  -- Update member count
  update public.groups set member_count = member_count + 1 where id = p_group_id;

  return json_build_object('success', true);
end;
$$;

grant execute on function join_group(uuid) to authenticated;

-- Leave Group Function
create or replace function leave_group(p_group_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_member record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Check membership
  select * into v_member from public.group_members
  where group_id = p_group_id and user_id = v_user_id;

  if v_member is null then
    return json_build_object('success', false, 'error', 'Not a member');
  end if;

  if v_member.role = 'owner' then
    return json_build_object('success', false, 'error', 'Owner cannot leave. Transfer ownership first.');
  end if;

  -- Leave the group
  delete from public.group_members where group_id = p_group_id and user_id = v_user_id;

  -- Update member count
  update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group_id;

  return json_build_object('success', true);
end;
$$;

grant execute on function leave_group(uuid) to authenticated;

-- Toggle Message Like Function
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

  -- Check if already liked
  select id into v_existing from public.message_likes
  where message_id = p_message_id and user_id = v_user_id;

  if v_existing is not null then
    -- Unlike
    delete from public.message_likes where id = v_existing;
    update public.community_messages
    set likes_count = greatest(likes_count - 1, 0)
    where id = p_message_id
    returning likes_count into v_new_count;

    return json_build_object('success', true, 'action', 'unliked', 'likes_count', v_new_count);
  else
    -- Like
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
