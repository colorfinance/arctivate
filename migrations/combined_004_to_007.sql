-- ============================================================
-- COMBINED IDEMPOTENT MIGRATION: 004 through 007
-- Safe to run multiple times on any database state.
-- ============================================================

-- **********************************************************
-- 004_social_features.sql
-- **********************************************************

-- ===========================================
-- 004-1. GROUPS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  is_public boolean default true,
  member_count int default 1,
  created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_groups_created_at ON public.groups(created_at desc);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups(created_by);

-- ===========================================
-- 004-2. GROUP MEMBERS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- ===========================================
-- 004-3. COMMUNITY MESSAGES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade,
  content text not null,
  message_type text default 'text' check (message_type in ('text', 'workout', 'achievement', 'milestone')),
  metadata jsonb,
  likes_count int default 0,
  replies_count int default 0,
  created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON public.community_messages(created_at desc);
CREATE INDEX IF NOT EXISTS idx_community_messages_user_id ON public.community_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_group_id ON public.community_messages(group_id);

-- ===========================================
-- 004-4. MESSAGE LIKES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.message_likes (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.community_messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_likes_message_id ON public.message_likes(message_id);

-- ===========================================
-- 004-5. MESSAGE REPLIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.message_replies (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.community_messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_message_replies_message_id ON public.message_replies(message_id);

-- ===========================================
-- 004-6. ROW LEVEL SECURITY
-- ===========================================

-- Groups RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;
CREATE POLICY "Anyone can view public groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (is_public = true OR EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id AND user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group owners can update their groups" ON public.groups;
CREATE POLICY "Group owners can update their groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "Group owners can delete their groups" ON public.groups;
CREATE POLICY "Group owners can delete their groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Group Members RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can join public groups" ON public.group_members;
CREATE POLICY "Users can join public groups"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.groups WHERE id = group_id AND is_public = true)
  );

DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
CREATE POLICY "Users can leave groups"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS(
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  ));

-- Community Messages RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages" ON public.community_messages;
CREATE POLICY "Users can view messages"
  ON public.community_messages FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL OR
    EXISTS(SELECT 1 FROM public.group_members WHERE group_id = community_messages.group_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create messages" ON public.community_messages;
CREATE POLICY "Users can create messages"
  ON public.community_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (group_id IS NULL OR EXISTS(SELECT 1 FROM public.group_members WHERE group_id = community_messages.group_id AND user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;
CREATE POLICY "Users can delete own messages"
  ON public.community_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Message Likes RLS
ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view likes" ON public.message_likes;
CREATE POLICY "Users can view likes"
  ON public.message_likes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can like messages" ON public.message_likes;
CREATE POLICY "Users can like messages"
  ON public.message_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike messages" ON public.message_likes;
CREATE POLICY "Users can unlike messages"
  ON public.message_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Message Replies RLS
ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view replies" ON public.message_replies;
CREATE POLICY "Users can view replies"
  ON public.message_replies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create replies" ON public.message_replies;
CREATE POLICY "Users can create replies"
  ON public.message_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own replies" ON public.message_replies;
CREATE POLICY "Users can delete own replies"
  ON public.message_replies FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ===========================================
-- 004-7. RPC FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION create_group(
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_group_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  insert into public.groups (name, description, is_public, created_by)
  values (p_name, p_description, p_is_public, v_user_id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'owner');

  return json_build_object(
    'success', true,
    'group_id', v_group_id
  );
end;
$$;

GRANT EXECUTE ON FUNCTION create_group(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION join_group(p_group_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_group record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into v_group from public.groups where id = p_group_id;

  if v_group is null then
    return json_build_object('success', false, 'error', 'Group not found');
  end if;

  if not v_group.is_public then
    return json_build_object('success', false, 'error', 'Group is private');
  end if;

  if exists(select 1 from public.group_members where group_id = p_group_id and user_id = v_user_id) then
    return json_build_object('success', false, 'error', 'Already a member');
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, v_user_id, 'member');

  update public.groups set member_count = member_count + 1 where id = p_group_id;

  return json_build_object('success', true);
end;
$$;

GRANT EXECUTE ON FUNCTION join_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION leave_group(p_group_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_member record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into v_member from public.group_members
  where group_id = p_group_id and user_id = v_user_id;

  if v_member is null then
    return json_build_object('success', false, 'error', 'Not a member');
  end if;

  if v_member.role = 'owner' then
    return json_build_object('success', false, 'error', 'Owner cannot leave. Transfer ownership first.');
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = v_user_id;

  update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group_id;

  return json_build_object('success', true);
end;
$$;

GRANT EXECUTE ON FUNCTION leave_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION toggle_message_like(p_message_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

GRANT EXECUTE ON FUNCTION toggle_message_like(uuid) TO authenticated;


-- **********************************************************
-- 005_comprehensive_fixes.sql
-- **********************************************************

-- ===========================================
-- 005-1. FIX HABITS - Add missing RLS and constraints
-- ===========================================

ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_unique_daily;

ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_unique_daily
  UNIQUE (user_id, habit_id, date);

DROP POLICY IF EXISTS "Users can update own habit logs" ON public.habit_logs;
CREATE POLICY "Users can update own habit logs"
  ON public.habit_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ===========================================
-- 005-2. FIX FOOD LOGS - Add manual entry support
-- ===========================================

ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS meal_type text
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));

ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS serving_size text;

-- ===========================================
-- 005-3. REWARDS/CHECK-IN SYSTEM IMPROVEMENTS
-- ===========================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean default false;

ALTER TABLE public.rewards_ledger ADD COLUMN IF NOT EXISTS created_by uuid references public.profiles(id);

ALTER TABLE public.rewards_ledger ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.rewards_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reward codes" ON public.rewards_ledger;
CREATE POLICY "Anyone can view reward codes"
  ON public.rewards_ledger FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can create reward codes"
  ON public.rewards_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can update reward codes"
  ON public.rewards_ledger FOR UPDATE
  TO authenticated
  USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can delete reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can delete reward codes"
  ON public.rewards_ledger FOR DELETE
  TO authenticated
  USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own check_ins" ON public.check_ins;
CREATE POLICY "Users can view own check_ins"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create check_ins" ON public.check_ins;
CREATE POLICY "Users can create check_ins"
  ON public.check_ins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view partners" ON public.partners;
CREATE POLICY "Anyone can view partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===========================================
-- 005-4. REDEEM CODE RPC FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION redeem_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_reward record;
  v_partner record;
  v_points int;
begin
  if p_code is null or p_user_id is null then
    return json_build_object('success', false, 'error', 'Invalid parameters');
  end if;

  select * into v_reward from public.rewards_ledger
  where code = p_code;

  if v_reward is null then
    select * into v_partner from public.partners where qr_uuid::text = p_code;

    if v_partner is not null then
      if exists(
        select 1 from public.check_ins
        where user_id = p_user_id
        and partner_id = v_partner.id
        and date(checked_in_at) = current_date
      ) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;

      v_points := 150;

      insert into public.check_ins (user_id, partner_id, awarded_points)
      values (p_user_id, v_partner.id, v_points);

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

GRANT EXECUTE ON FUNCTION redeem_code(text, uuid) TO authenticated;

-- ===========================================
-- 005-5. CREATE REWARD CODE RPC (for admins)
-- ===========================================

CREATE OR REPLACE FUNCTION create_reward_code(
  p_code text,
  p_code_type text,
  p_points_value int default 0,
  p_description text default null,
  p_name text default null,
  p_expires_at timestamptz default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  return json_build_object(
    'success', true,
    'reward_id', v_reward_id
  );
end;
$$;

GRANT EXECUTE ON FUNCTION create_reward_code(text, text, int, text, text, timestamptz) TO authenticated;

-- ===========================================
-- 005-6. LOG FOOD RPC (for manual entry)
-- ===========================================

CREATE OR REPLACE FUNCTION log_food(
  p_item_name text,
  p_calories int,
  p_protein int default 0,
  p_carbs int default 0,
  p_fat int default 0,
  p_meal_type text default null,
  p_serving_size text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

GRANT EXECUTE ON FUNCTION log_food(text, int, int, int, int, text, text) TO authenticated;

-- ===========================================
-- 005-7. FIX PROFILES RLS
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());


-- **********************************************************
-- 006_messaging_and_images.sql
-- **********************************************************

-- ===========================================
-- 006-1. ADD IMAGE URL TO COMMUNITY MESSAGES
-- ===========================================
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS image_url text;

-- ===========================================
-- 006-2. DIRECT MESSAGES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  image_url text,
  is_read boolean default false,
  created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON public.direct_messages(created_at desc);

-- ===========================================
-- 006-3. DM RLS
-- ===========================================

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own DMs" ON public.direct_messages;
CREATE POLICY "Users can view own DMs"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
CREATE POLICY "Users can send DMs"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own sent DMs" ON public.direct_messages;
CREATE POLICY "Users can delete own sent DMs"
  ON public.direct_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Receivers can update DMs read status" ON public.direct_messages;
CREATE POLICY "Receivers can update DMs read status"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid());

-- ===========================================
-- 006-4. RPC: Send Direct Message
-- ===========================================
CREATE OR REPLACE FUNCTION send_dm(
  p_receiver_id uuid,
  p_content text,
  p_image_url text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

GRANT EXECUTE ON FUNCTION send_dm(uuid, text, text) TO authenticated;

-- ===========================================
-- 006-5. RPC: Mark DMs as read
-- ===========================================
CREATE OR REPLACE FUNCTION mark_dms_read(p_sender_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

GRANT EXECUTE ON FUNCTION mark_dms_read(uuid) TO authenticated;

-- ===========================================
-- 006-6. ADD DAILY CALORIE GOAL TO PROFILES
-- ===========================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_calorie_goal int default 2800;


-- **********************************************************
-- 007_meal_sharing_and_storage.sql
-- **********************************************************

-- ===========================================
-- 007-1. UPDATE MESSAGE TYPE CHECK CONSTRAINT
-- ===========================================
ALTER TABLE public.community_messages DROP CONSTRAINT IF EXISTS community_messages_message_type_check;
ALTER TABLE public.community_messages ADD CONSTRAINT community_messages_message_type_check
  CHECK (message_type IN ('text', 'workout', 'achievement', 'milestone', 'image', 'meal'));

-- ===========================================
-- 007-2. ADD IMAGE_URL TO COMMUNITY_MESSAGES (already handled by 006, safe to repeat)
-- ===========================================
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS image_url text;

-- ===========================================
-- 007-3. CREATE STORAGE BUCKET FOR POST IMAGES
-- ===========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-images bucket
DROP POLICY IF EXISTS "Anyone can view post images" ON storage.objects;
CREATE POLICY "Anyone can view post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Users can delete own post images" ON storage.objects;
CREATE POLICY "Users can delete own post images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
