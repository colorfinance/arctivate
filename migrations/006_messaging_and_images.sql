-- Migration: Direct Messaging & Image Support
-- Adds DM conversations, image support for posts

-- ===========================================
-- 1. ADD IMAGE URL TO COMMUNITY MESSAGES
-- ===========================================
alter table public.community_messages add column if not exists image_url text;

-- ===========================================
-- 2. DIRECT MESSAGES TABLE
-- ===========================================
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  image_url text,
  is_read boolean default false,
  created_at timestamptz default now() not null
);

create index if not exists idx_dm_sender on public.direct_messages(sender_id);
create index if not exists idx_dm_receiver on public.direct_messages(receiver_id);
create index if not exists idx_dm_created_at on public.direct_messages(created_at desc);

-- ===========================================
-- 3. DM CONVERSATIONS VIEW HELPER
-- ===========================================

-- RLS for direct messages
alter table public.direct_messages enable row level security;

create policy "Users can view own DMs"
  on public.direct_messages for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users can send DMs"
  on public.direct_messages for insert
  to authenticated
  with check (sender_id = auth.uid());

create policy "Users can delete own sent DMs"
  on public.direct_messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- Mark DMs as read
create policy "Receivers can update DMs read status"
  on public.direct_messages for update
  to authenticated
  using (receiver_id = auth.uid());

-- ===========================================
-- 4. RPC: Send Direct Message
-- ===========================================
create or replace function send_dm(
  p_receiver_id uuid,
  p_content text,
  p_image_url text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_sender_id uuid;
  v_dm_id uuid;
begin
  v_sender_id := auth.uid();

  if v_sender_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if v_sender_id = p_receiver_id then
    return json_build_object('success', false, 'error', 'Cannot message yourself');
  end if;

  insert into public.direct_messages (sender_id, receiver_id, content, image_url)
  values (v_sender_id, p_receiver_id, p_content, p_image_url)
  returning id into v_dm_id;

  return json_build_object('success', true, 'dm_id', v_dm_id);
end;
$$;

grant execute on function send_dm(uuid, text, text) to authenticated;

-- ===========================================
-- 5. RPC: Mark DMs as read
-- ===========================================
create or replace function mark_dms_read(p_sender_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  update public.direct_messages
  set is_read = true
  where sender_id = p_sender_id and receiver_id = v_user_id and is_read = false;

  return json_build_object('success', true);
end;
$$;

grant execute on function mark_dms_read(uuid) to authenticated;

-- ===========================================
-- 6. ADD DAILY CALORIE GOAL TO PROFILES
-- ===========================================
alter table public.profiles add column if not exists daily_calorie_goal int default 2800;
