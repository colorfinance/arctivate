-- ============================================================================
-- BASELINE SCHEMA — the whole database, from nothing.
-- ============================================================================
--
-- Why this file exists: the tables this app was built on (profiles, habits,
-- workout_logs, exercises and friends) were created in the Supabase dashboard
-- and never written down. Everything in migrations/001 onwards ALTERs a schema
-- that git had no copy of, so the repo could not rebuild the database, stand up
-- a staging copy, or open a development branch. This is that missing copy.
--
-- HOW TO USE IT
--   Fresh database  : run THIS FILE ONLY. It is the complete current schema.
--   Existing database: do nothing. Production already matches it, and every
--                     statement is guarded so re-running is harmless.
--   migrations/001-036 are history. They are kept for the record and must not
--   be replayed on top of this file.
--
-- Generated from production by introspection and verified by applying it to an
-- empty database and diffing the result. Regenerate it after schema changes
-- with the same method rather than hand-editing.
--
-- Order: extensions, tables, foreign keys, indexes, functions, triggers, RLS,
-- storage, then the seed rows the app needs to work at all.
-- ============================================================================

-- --- Extensions -------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- --- Tables -----------------------------------------------------------------
-- Foreign keys are added after every table exists, so this section can be read
-- (and applied) in alphabetical order without worrying about dependencies.

CREATE TABLE IF NOT EXISTS public.badges (
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  CONSTRAINT badges_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_pkey PRIMARY KEY (id),
  CONSTRAINT blocked_users_user_id_blocked_id_key UNIQUE (user_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_invites_pkey PRIMARY KEY (id),
  CONSTRAINT challenge_invites_challenge_id_invitee_id_key UNIQUE (challenge_id, invitee_id),
  CONSTRAINT challenge_invites_not_self CHECK ((inviter_id <> invitee_id)),
  CONSTRAINT challenge_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);

CREATE TABLE IF NOT EXISTS public.challenge_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_logs_pkey PRIMARY KEY (id),
  CONSTRAINT challenge_logs_user_id_challenge_id_date_key UNIQUE (user_id, challenge_id, date)
);

CREATE TABLE IF NOT EXISTS public.challenge_task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT challenge_task_logs_pkey PRIMARY KEY (id),
  CONSTRAINT challenge_task_logs_task_id_user_id_date_key UNIQUE (task_id, user_id, date)
);

CREATE TABLE IF NOT EXISTS public.challenge_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  title text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT challenge_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  points_reward integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  partner_id uuid,
  awarded_points integer DEFAULT 150,
  checked_in_at timestamp with time zone DEFAULT now(),
  CONSTRAINT check_ins_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.coach_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coach_messages_pkey PRIMARY KEY (id),
  CONSTRAINT coach_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid,
  content text NOT NULL,
  message_type text DEFAULT 'text'::text,
  metadata jsonb,
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  hidden_at timestamp with time zone,
  CONSTRAINT community_messages_pkey PRIMARY KEY (id),
  CONSTRAINT community_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'workout'::text, 'achievement'::text, 'milestone'::text, 'image'::text, 'meal'::text])))
);

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_pkey PRIMARY KEY (id),
  CONSTRAINT content_reports_content_type_check CHECK ((content_type = ANY (ARRAY['feed'::text, 'message'::text, 'user'::text, 'dm'::text]))),
  CONSTRAINT content_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text])))
);

CREATE TABLE IF NOT EXISTS public.daily_workout_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  daily_workout_id uuid NOT NULL,
  name text NOT NULL,
  metric_type text NOT NULL DEFAULT 'weight'::text,
  target_sets integer,
  target_reps integer,
  target_value numeric,
  notes text,
  "position" integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_workout_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT daily_workout_exercises_metric_type_check CHECK ((metric_type = ANY (ARRAY['weight'::text, 'time'::text, 'reps'::text, 'distance'::text, 'distance_m'::text])))
);

CREATE TABLE IF NOT EXISTS public.daily_workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  workout_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual'::text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  owner_id uuid,
  CONSTRAINT daily_workouts_pkey PRIMARY KEY (id),
  CONSTRAINT daily_workouts_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'photo'::text])))
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric_type text,
  is_benchmark boolean DEFAULT false,
  user_id uuid,
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_metric_type_check CHECK ((metric_type = ANY (ARRAY['weight'::text, 'time'::text, 'reps'::text, 'distance'::text, 'distance_m'::text])))
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  category text NOT NULL DEFAULT 'general'::text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'::text,
  created_at timestamp with time zone DEFAULT now(),
  image_url text,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_category_check CHECK ((category = ANY (ARRAY['general'::text, 'bug'::text, 'feature'::text, 'praise'::text, 'other'::text]))),
  CONSTRAINT feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'resolved'::text])))
);

CREATE TABLE IF NOT EXISTS public.food_favourites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  macros jsonb,
  created_at timestamp with time zone DEFAULT now(),
  brand text,
  base_qty numeric NOT NULL DEFAULT 1,
  base_unit text NOT NULL DEFAULT 'serving'::text,
  CONSTRAINT food_favourites_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.food_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  item_name text,
  calories integer,
  macros jsonb,
  barcode text,
  eaten_at timestamp with time zone DEFAULT now(),
  image_url text,
  meal_type text,
  serving_size text,
  quantity numeric,
  unit text,
  favourite_id uuid,
  CONSTRAINT food_logs_pkey PRIMARY KEY (id),
  CONSTRAINT food_logs_meal_type_check CHECK ((meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text])))
);

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  requester_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_user_a_user_b_key UNIQUE (user_a, user_b),
  CONSTRAINT friendships_not_self CHECK ((user_a <> user_b)),
  CONSTRAINT friendships_order_check CHECK ((user_a < user_b)),
  CONSTRAINT friendships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);

CREATE TABLE IF NOT EXISTS public.group_challenge_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'::text,
  restarts integer NOT NULL DEFAULT 0,
  last_checked date,
  days_done integer NOT NULL DEFAULT 0,
  last_done_date date,
  progress_checked_at timestamp with time zone,
  CONSTRAINT group_challenge_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_challenge_members_challenge_id_user_id_key UNIQUE (challenge_id, user_id),
  CONSTRAINT group_challenge_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'left'::text])))
);

CREATE TABLE IF NOT EXISTS public.group_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  length_days integer NOT NULL DEFAULT 75,
  strict boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  visibility text NOT NULL DEFAULT 'gym'::text,
  is_official boolean NOT NULL DEFAULT false,
  gym_id uuid,
  gym_vs_gym boolean NOT NULL DEFAULT false,
  CONSTRAINT group_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT group_challenges_length_check CHECK (((length_days > 0) AND (length_days <= 400))),
  CONSTRAINT group_challenges_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'gym'::text, 'invite'::text])))
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id),
  CONSTRAINT group_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid,
  is_public boolean DEFAULT true,
  member_count integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.gyms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  city text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gyms_pkey PRIMARY KEY (id),
  CONSTRAINT gyms_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  habit_id uuid,
  completed_at timestamp with time zone DEFAULT now(),
  date date,
  CONSTRAINT habit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT habit_logs_unique_daily UNIQUE (user_id, habit_id, date)
);

CREATE TABLE IF NOT EXISTS public.habits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  points_reward integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  frequency text NOT NULL DEFAULT 'daily'::text,
  is_preset boolean NOT NULL DEFAULT false,
  reminder_time time without time zone,
  CONSTRAINT habits_pkey PRIMARY KEY (id),
  CONSTRAINT habits_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text])))
);

CREATE TABLE IF NOT EXISTS public.high_fives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT high_fives_pkey PRIMARY KEY (id),
  CONSTRAINT high_fives_feed_id_user_id_key UNIQUE (feed_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.message_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_likes_pkey PRIMARY KEY (id),
  CONSTRAINT message_likes_message_id_user_id_key UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.message_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_replies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_lat double precision,
  location_long double precision,
  qr_uuid uuid DEFAULT gen_random_uuid(),
  discount_text text,
  points_value integer DEFAULT 150,
  description text,
  owner_id uuid,
  CONSTRAINT partners_pkey PRIMARY KEY (id),
  CONSTRAINT partners_qr_uuid_key UNIQUE (qr_uuid)
);

CREATE TABLE IF NOT EXISTS public.personal_bests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  exercise_id uuid,
  value numeric NOT NULL,
  achieved_at timestamp with time zone DEFAULT now(),
  CONSTRAINT personal_bests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text,
  total_points bigint DEFAULT 0,
  current_streak integer DEFAULT 0,
  avatar_url text,
  challenge_days_goal integer DEFAULT 75,
  challenge_start_date timestamp with time zone DEFAULT now(),
  age integer,
  weight numeric(5,2),
  gender text,
  goal text,
  fitness_level text,
  completed_onboarding boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  daily_calorie_goal integer DEFAULT 2800,
  daily_carb_goal integer,
  daily_protein_goal integer,
  daily_fat_goal integer,
  height numeric,
  presets_seeded_for timestamp with time zone,
  strict_challenge boolean NOT NULL DEFAULT false,
  strict_last_checked date,
  strict_saves_used integer NOT NULL DEFAULT 0,
  daily_reminder_time time without time zone DEFAULT '07:00:00'::time without time zone,
  gym_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_username_key UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS public.public_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  likes_count integer NOT NULL DEFAULT 0,
  hidden_at timestamp with time zone,
  CONSTRAINT public_feed_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.rewards_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  code_type text NOT NULL,
  points_value integer DEFAULT 0,
  partner_id uuid,
  is_used boolean DEFAULT false,
  used_by uuid,
  used_at timestamp with time zone,
  description text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  name text,
  CONSTRAINT rewards_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_ledger_code_key UNIQUE (code),
  CONSTRAINT rewards_ledger_code_type_check CHECK ((code_type = ANY (ARRAY['points'::text, 'partner'::text])))
);

CREATE TABLE IF NOT EXISTS public.training_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  body text,
  updated_at timestamp with time zone DEFAULT now(),
  daily_workout_id uuid,
  CONSTRAINT training_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  challenge_id uuid,
  CONSTRAINT user_badges_pkey PRIMARY KEY (id),
  CONSTRAINT user_badges_user_id_badge_key_key UNIQUE (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id))
);

CREATE TABLE IF NOT EXISTS public.wearable_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hrv numeric,
  rhr numeric,
  sleep_hours numeric,
  sleep_quality text,
  logged_at date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wearable_logs_pkey PRIMARY KEY (id),
  CONSTRAINT wearable_logs_sleep_quality_check CHECK ((sleep_quality = ANY (ARRAY['poor'::text, 'fair'::text, 'good'::text, 'excellent'::text])))
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weight_logs_pkey PRIMARY KEY (id),
  CONSTRAINT weight_logs_user_id_date_key UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.workout_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  daily_workout_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_completions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_completions_user_id_daily_workout_id_date_key UNIQUE (user_id, daily_workout_id, date)
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  exercise_id uuid,
  value numeric NOT NULL,
  is_new_pb boolean DEFAULT false,
  points_awarded integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  sets integer,
  reps integer,
  rpe integer,
  notes text,
  voice_memo_url text,
  daily_workout_id uuid,
  daily_workout_exercise_id uuid,
  CONSTRAINT workout_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workout_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  created_at timestamp with time zone DEFAULT now(),
  daily_workout_id uuid,
  CONSTRAINT workout_photos_pkey PRIMARY KEY (id)
);

-- --- Foreign keys -----------------------------------------------------------
-- Applied through a loop so the file stays re-runnable: a key that already
-- exists is skipped rather than aborting everything after it.

DO $$
DECLARE
  stmt text;
  stmts text[] := ARRAY[
    'ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_invites ADD CONSTRAINT challenge_invites_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES group_challenges(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_invites ADD CONSTRAINT challenge_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_invites ADD CONSTRAINT challenge_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_logs ADD CONSTRAINT challenge_logs_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_logs ADD CONSTRAINT challenge_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_task_logs ADD CONSTRAINT challenge_task_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES challenge_tasks(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_task_logs ADD CONSTRAINT challenge_task_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenge_tasks ADD CONSTRAINT challenge_tasks_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES group_challenges(id) ON DELETE CASCADE',
    'ALTER TABLE public.challenges ADD CONSTRAINT challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id)',
    'ALTER TABLE public.check_ins ADD CONSTRAINT check_ins_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id)',
    'ALTER TABLE public.check_ins ADD CONSTRAINT check_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.coach_messages ADD CONSTRAINT coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.community_messages ADD CONSTRAINT community_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE',
    'ALTER TABLE public.community_messages ADD CONSTRAINT community_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL',
    'ALTER TABLE public.daily_workout_exercises ADD CONSTRAINT daily_workout_exercises_daily_workout_id_fkey FOREIGN KEY (daily_workout_id) REFERENCES daily_workouts(id) ON DELETE CASCADE',
    'ALTER TABLE public.daily_workouts ADD CONSTRAINT daily_workouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id)',
    'ALTER TABLE public.daily_workouts ADD CONSTRAINT daily_workouts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.exercises ADD CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.feedback ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL',
    'ALTER TABLE public.food_favourites ADD CONSTRAINT food_favourites_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.food_logs ADD CONSTRAINT food_logs_favourite_id_fkey FOREIGN KEY (favourite_id) REFERENCES food_favourites(id) ON DELETE SET NULL',
    'ALTER TABLE public.food_logs ADD CONSTRAINT food_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.friendships ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.friendships ADD CONSTRAINT friendships_user_a_fkey FOREIGN KEY (user_a) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.friendships ADD CONSTRAINT friendships_user_b_fkey FOREIGN KEY (user_b) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.group_challenge_members ADD CONSTRAINT group_challenge_members_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES group_challenges(id) ON DELETE CASCADE',
    'ALTER TABLE public.group_challenge_members ADD CONSTRAINT group_challenge_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.group_challenges ADD CONSTRAINT group_challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL',
    'ALTER TABLE public.group_challenges ADD CONSTRAINT group_challenges_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL',
    'ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE',
    'ALTER TABLE public.group_members ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.groups ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL',
    'ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE',
    'ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.habits ADD CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.high_fives ADD CONSTRAINT high_fives_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public_feed(id) ON DELETE CASCADE',
    'ALTER TABLE public.high_fives ADD CONSTRAINT high_fives_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.message_likes ADD CONSTRAINT message_likes_message_id_fkey FOREIGN KEY (message_id) REFERENCES community_messages(id) ON DELETE CASCADE',
    'ALTER TABLE public.message_likes ADD CONSTRAINT message_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.message_replies ADD CONSTRAINT message_replies_message_id_fkey FOREIGN KEY (message_id) REFERENCES community_messages(id) ON DELETE CASCADE',
    'ALTER TABLE public.message_replies ADD CONSTRAINT message_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.partners ADD CONSTRAINT partners_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)',
    'ALTER TABLE public.personal_bests ADD CONSTRAINT personal_bests_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE',
    'ALTER TABLE public.personal_bests ADD CONSTRAINT personal_bests_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.profiles ADD CONSTRAINT profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL',
    'ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.public_feed ADD CONSTRAINT public_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.rewards_ledger ADD CONSTRAINT rewards_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id)',
    'ALTER TABLE public.rewards_ledger ADD CONSTRAINT rewards_ledger_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id)',
    'ALTER TABLE public.rewards_ledger ADD CONSTRAINT rewards_ledger_used_by_fkey FOREIGN KEY (used_by) REFERENCES profiles(id) ON DELETE SET NULL',
    'ALTER TABLE public.training_notes ADD CONSTRAINT training_notes_daily_workout_id_fkey FOREIGN KEY (daily_workout_id) REFERENCES daily_workouts(id) ON DELETE CASCADE',
    'ALTER TABLE public.training_notes ADD CONSTRAINT training_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_badge_key_fkey FOREIGN KEY (badge_key) REFERENCES badges(key) ON DELETE CASCADE',
    'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES group_challenges(id) ON DELETE SET NULL',
    'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE',
    'ALTER TABLE public.wearable_logs ADD CONSTRAINT wearable_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.weight_logs ADD CONSTRAINT weight_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.workout_completions ADD CONSTRAINT workout_completions_daily_workout_id_fkey FOREIGN KEY (daily_workout_id) REFERENCES daily_workouts(id) ON DELETE CASCADE',
    'ALTER TABLE public.workout_completions ADD CONSTRAINT workout_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_daily_workout_exercise_id_fkey FOREIGN KEY (daily_workout_exercise_id) REFERENCES daily_workout_exercises(id) ON DELETE SET NULL',
    'ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_daily_workout_id_fkey FOREIGN KEY (daily_workout_id) REFERENCES daily_workouts(id) ON DELETE SET NULL',
    'ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE',
    'ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
    'ALTER TABLE public.workout_photos ADD CONSTRAINT workout_photos_daily_workout_id_fkey FOREIGN KEY (daily_workout_id) REFERENCES daily_workouts(id) ON DELETE SET NULL',
    'ALTER TABLE public.workout_photos ADD CONSTRAINT workout_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
  ];
BEGIN
  FOREACH stmt IN ARRAY stmts LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
    END;
  END LOOP;
END $$;

-- --- Indexes ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invites_invitee ON public.challenge_invites USING btree (invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_logs_user_date ON public.challenge_logs USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS idx_ctl_user_date ON public.challenge_task_logs USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS idx_challenge_tasks_challenge ON public.challenge_tasks USING btree (challenge_id, "position");
CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges USING btree (created_at DESC) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_coach_messages_user ON public.coach_messages USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON public.community_messages USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_group_id ON public.community_messages USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_user_id ON public.community_messages USING btree (user_id);
CREATE INDEX IF NOT EXISTS content_reports_content_idx ON public.content_reports USING btree (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_workout_exercises_workout ON public.daily_workout_exercises USING btree (daily_workout_id, "position");
CREATE INDEX IF NOT EXISTS idx_daily_workouts_date ON public.daily_workouts USING btree (workout_date DESC) WHERE (is_published = true);
CREATE INDEX IF NOT EXISTS idx_daily_workouts_owner ON public.daily_workouts USING btree (owner_id, workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON public.direct_messages USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback USING btree (status);
CREATE INDEX IF NOT EXISTS idx_food_favourites_user ON public.food_favourites USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_a ON public.friendships USING btree (user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON public.friendships USING btree (user_b);
CREATE INDEX IF NOT EXISTS idx_gcm_challenge ON public.group_challenge_members USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_gcm_user ON public.group_challenge_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_gc_active ON public.group_challenges USING btree (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON public.groups USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_message_likes_message_id ON public.message_likes USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_message_id ON public.message_replies USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_partners_owner_id ON public.partners USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_gym ON public.profiles USING btree (gym_id);
CREATE INDEX IF NOT EXISTS idx_training_notes_user_date ON public.training_notes USING btree (user_id, date DESC);
-- Partial UNIQUE indexes, not constraints: one loose note per day, and one
-- note per workout. Without these a rebuilt database silently allows
-- duplicate notes where production allows exactly one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_notes_day ON public.training_notes USING btree (user_id, date) WHERE (daily_workout_id IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_notes_workout ON public.training_notes USING btree (user_id, date, daily_workout_id) WHERE (daily_workout_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges USING btree (user_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks USING btree (blocker_id);
CREATE INDEX IF NOT EXISTS idx_wearable_logs_user_date ON public.wearable_logs USING btree (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON public.weight_logs USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_completions_user_date ON public.workout_completions USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_logs_daily_workout ON public.workout_logs USING btree (daily_workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_photos_user ON public.workout_photos USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_photos_workout ON public.workout_photos USING btree (daily_workout_id) WHERE (daily_workout_id IS NOT NULL);

-- --- Functions --------------------------------------------------------------
-- Ordered so that anything called by another is defined first.

-- Every new auth user gets a profile, and belongs to the gym from the start:
-- challenge visibility 'gym' treats a NULL gym as "everyone can see it".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, gym_id)
  VALUES (new.id, (SELECT id FROM public.gyms WHERE slug = 'arctivate'));
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_points(row_id uuid, x integer)
RETURNS void LANGUAGE plpgsql
AS $function$
begin
  update public.profiles set total_points = total_points + x where id = row_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_points(p_user_id uuid, p_points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- A signed-in caller may only top up their own total. auth.uid() is null for
  -- the service role, which is trusted server-side code.
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only change your own points';
  END IF;
  UPDATE public.profiles SET total_points = COALESCE(total_points, 0) + p_points WHERE id = p_user_id;
END;
$function$;

-- A day is complete when every daily habit that already existed on it was
-- ticked for that date.
CREATE OR REPLACE FUNCTION public.completed_days_for(uid uuid, since date)
RETURNS TABLE(day date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d::date
  FROM generate_series(since, current_date, interval '1 day') AS d
  WHERE EXISTS (
          SELECT 1 FROM habits h
          WHERE h.user_id = uid AND coalesce(h.frequency,'daily') <> 'weekly'
            AND h.created_at <= (d + interval '1 day' - interval '1 second'))
    AND NOT EXISTS (
          SELECT 1 FROM habits h
          WHERE h.user_id = uid AND coalesce(h.frequency,'daily') <> 'weekly'
            AND h.created_at <= (d + interval '1 day' - interval '1 second')
            AND NOT EXISTS (
              SELECT 1 FROM habit_logs l
              WHERE l.habit_id = h.id AND l.user_id = uid AND l.date = d::date));
$function$;

-- Scores the caller in every challenge they're in. A challenge with its own
-- task list is judged on that; otherwise it falls back to personal habits.
-- SECURITY DEFINER so it can read the caller's ticks, but scoped to auth.uid().
CREATE OR REPLACE FUNCTION public.recalc_my_challenge_progress()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  m record;
  n integer; last_day date; window_end date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  FOR m IN
    SELECT gcm.id, gcm.start_date, gcm.challenge_id, c.length_days
    FROM group_challenge_members gcm
    JOIN group_challenges c ON c.id = gcm.challenge_id
    WHERE gcm.user_id = me AND gcm.status <> 'left'
  LOOP
    window_end := LEAST(current_date, m.start_date + m.length_days - 1);

    IF EXISTS (SELECT 1 FROM challenge_tasks t WHERE t.challenge_id = m.challenge_id) THEN
      SELECT count(*), max(day) INTO n, last_day FROM (
        SELECT d::date AS day
        FROM generate_series(m.start_date, window_end, interval '1 day') AS d
        WHERE EXISTS (
                SELECT 1 FROM challenge_tasks t
                WHERE t.challenge_id = m.challenge_id
                  AND t.created_at <= (d + interval '1 day' - interval '1 second'))
          AND NOT EXISTS (
                SELECT 1 FROM challenge_tasks t
                WHERE t.challenge_id = m.challenge_id
                  AND t.created_at <= (d + interval '1 day' - interval '1 second')
                  AND NOT EXISTS (
                    SELECT 1 FROM challenge_task_logs l
                    WHERE l.task_id = t.id AND l.user_id = me AND l.date = d::date))
      ) x;
    ELSE
      SELECT count(*), max(day) INTO n, last_day
      FROM completed_days_for(me, m.start_date)
      WHERE day <= window_end;
    END IF;

    UPDATE group_challenge_members
    SET days_done = coalesce(n, 0), last_done_date = last_day, progress_checked_at = now()
    WHERE id = m.id;
  END LOOP;
END;
$function$;

-- Awards what the caller has earned, returning only the new ones so the app
-- knows what to celebrate. Badges are never taken away.
CREATE OR REPLACE FUNCTION public.award_my_badges()
RETURNS TABLE(key text, name text, description text, icon text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH earned AS (
    SELECT 'first_join'::text AS k WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND status <> 'left')
    UNION ALL SELECT 'first_day' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND days_done >= 1)
    UNION ALL SELECT 'week_one' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members WHERE user_id = me AND days_done >= 7)
    UNION ALL SELECT 'halfway' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done * 2 >= c.length_days)
    UNION ALL SELECT 'finisher' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done >= c.length_days)
    UNION ALL SELECT 'clean_run' WHERE EXISTS (
      SELECT 1 FROM group_challenge_members m JOIN group_challenges c ON c.id = m.challenge_id
      WHERE m.user_id = me AND m.days_done >= c.length_days AND coalesce(m.restarts,0) = 0)
    UNION ALL SELECT 'caller' WHERE (
      SELECT count(DISTINCT invitee_id) FROM challenge_invites WHERE inviter_id = me) >= 5
    UNION ALL SELECT 'answered' WHERE EXISTS (
      SELECT 1 FROM challenge_invites WHERE invitee_id = me AND status = 'accepted')
  ), inserted AS (
    INSERT INTO user_badges (user_id, badge_key)
    SELECT me, k FROM earned
    ON CONFLICT (user_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  SELECT b.key, b.name, b.description, b.icon
  FROM inserted i JOIN badges b ON b.key = i.badge_key
  ORDER BY b.sort_order;
END;
$function$;

-- You can't accept your own friend request.
CREATE OR REPLACE FUNCTION public.friendship_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND auth.uid() = OLD.requester_id THEN
    RAISE EXCEPTION 'The other person has to accept a friend request';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- Nobody can join a challenge dated before it began, or bank days in advance.
CREATE OR REPLACE FUNCTION public.gcm_validate_start_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  challenge_start date;
BEGIN
  IF exists(select 1 from public.profiles where id = auth.uid() and is_admin = true) THEN
    RETURN NEW;
  END IF;

  SELECT start_date INTO challenge_start
  FROM public.group_challenges WHERE id = NEW.challenge_id;

  IF challenge_start IS NOT NULL AND NEW.start_date < challenge_start THEN
    NEW.start_date := challenge_start;
  END IF;

  IF NEW.start_date > CURRENT_DATE THEN
    IF challenge_start IS NULL OR NEW.start_date <> challenge_start THEN
      NEW.start_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- --- Application RPCs -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  if p_user_id is null or p_user_id = v_me then return jsonb_build_object('success', false, 'error', 'invalid_target'); end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_me, p_user_id) on conflict do nothing;
  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  delete from public.user_blocks where blocker_id = v_me and blocked_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_description text DEFAULT NULL::text, p_is_public boolean DEFAULT true)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_group_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  insert into public.groups (name, description, is_public, created_by) values (p_name, p_description, p_is_public, v_user_id) returning id into v_group_id;
  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_user_id, 'owner');
  return json_build_object('success', true, 'group_id', v_group_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.join_group(p_group_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_group record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  select * into v_group from public.groups where id = p_group_id;
  if v_group is null then return json_build_object('success', false, 'error', 'Group not found'); end if;
  if not v_group.is_public then return json_build_object('success', false, 'error', 'Group is private'); end if;
  if exists(select 1 from public.group_members where group_id = p_group_id and user_id = v_user_id) then return json_build_object('success', false, 'error', 'Already a member'); end if;
  insert into public.group_members (group_id, user_id, role) values (p_group_id, v_user_id, 'member');
  update public.groups set member_count = member_count + 1 where id = p_group_id;
  return json_build_object('success', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.leave_group(p_group_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_member record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  select * into v_member from public.group_members where group_id = p_group_id and user_id = v_user_id;
  if v_member is null then return json_build_object('success', false, 'error', 'Not a member'); end if;
  if v_member.role = 'owner' then return json_build_object('success', false, 'error', 'Owner cannot leave. Transfer ownership first.'); end if;
  delete from public.group_members where group_id = p_group_id and user_id = v_user_id;
  update public.groups set member_count = greatest(member_count - 1, 0) where id = p_group_id;
  return json_build_object('success', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.send_dm(p_receiver_id uuid, p_content text, p_image_url text DEFAULT NULL::text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_sender_id uuid; v_dm_id uuid;
begin
  v_sender_id := auth.uid();
  if v_sender_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  if v_sender_id = p_receiver_id then return json_build_object('success', false, 'error', 'Cannot message yourself'); end if;
  insert into public.direct_messages (sender_id, receiver_id, content, image_url) values (v_sender_id, p_receiver_id, p_content, p_image_url) returning id into v_dm_id;
  return json_build_object('success', true, 'dm_id', v_dm_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.mark_dms_read(p_sender_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  update public.direct_messages set is_read = true where sender_id = p_sender_id and receiver_id = v_user_id and is_read = false;
  return json_build_object('success', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.toggle_message_like(p_message_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_existing uuid; v_new_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  select id into v_existing from public.message_likes where message_id = p_message_id and user_id = v_user_id;
  if v_existing is not null then
    delete from public.message_likes where id = v_existing;
    update public.community_messages set likes_count = greatest(likes_count - 1, 0) where id = p_message_id returning likes_count into v_new_count;
    return json_build_object('success', true, 'action', 'unliked', 'likes_count', v_new_count);
  else
    insert into public.message_likes (message_id, user_id) values (p_message_id, v_user_id);
    update public.community_messages set likes_count = likes_count + 1 where id = p_message_id returning likes_count into v_new_count;
    return json_build_object('success', true, 'action', 'liked', 'likes_count', v_new_count);
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.delete_own_feed_post(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me uuid := auth.uid(); v_deleted int;
begin
  if v_me is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'public_feed') then
    return jsonb_build_object('success', false, 'error', 'table_missing');
  end if;
  execute 'delete from public.public_feed where id = $1 and user_id = $2' using p_post_id, v_me;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then return jsonb_build_object('success', false, 'error', 'not_found_or_not_owner'); end if;
  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_own_message(p_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me uuid := auth.uid(); v_deleted int;
begin
  if v_me is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'community_messages') then
    return jsonb_build_object('success', false, 'error', 'table_missing');
  end if;
  execute 'delete from public.community_messages where id = $1 and user_id = $2' using p_message_id, v_me;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then return jsonb_build_object('success', false, 'error', 'not_found_or_not_owner'); end if;
  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.report_content(p_content_type text, p_content_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  if p_content_type not in ('feed', 'message', 'user', 'dm') then
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  insert into public.content_reports (reporter_id, content_type, content_id, reason)
    values (v_me, p_content_type, p_content_id, left(coalesce(p_reason, ''), 500));

  if p_content_type = 'feed'
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'public_feed' and column_name = 'hidden_at') then
    execute 'update public.public_feed set hidden_at = now() where id = $1 and hidden_at is null' using p_content_id;
  elsif p_content_type = 'message'
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'community_messages' and column_name = 'hidden_at') then
    execute 'update public.community_messages set hidden_at = now() where id = $1 and hidden_at is null' using p_content_id;
  end if;

  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_food(p_item_name text, p_calories integer, p_protein integer DEFAULT 0, p_carbs integer DEFAULT 0, p_fat integer DEFAULT 0, p_meal_type text DEFAULT NULL::text, p_serving_size text DEFAULT NULL::text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_log_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  insert into public.food_logs (user_id, item_name, calories, macros, meal_type, serving_size)
  values (v_user_id, p_item_name, p_calories, json_build_object('p', p_protein, 'c', p_carbs, 'f', p_fat), p_meal_type, p_serving_size)
  returning id into v_log_id;
  return json_build_object('success', true, 'log_id', v_log_id, 'calories', p_calories);
end; $function$;

CREATE OR REPLACE FUNCTION public.create_reward_code(p_code text, p_code_type text, p_points_value integer DEFAULT 0, p_description text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_user_id uuid; v_is_admin boolean; v_reward_id uuid;
begin
  v_user_id := auth.uid();
  select is_admin into v_is_admin from public.profiles where id = v_user_id;
  if not coalesce(v_is_admin, false) then return json_build_object('success', false, 'error', 'Admin access required'); end if;
  if exists(select 1 from public.rewards_ledger where code = p_code) then return json_build_object('success', false, 'error', 'Code already exists'); end if;
  insert into public.rewards_ledger (code, code_type, points_value, description, name, expires_at, created_by) values (p_code, p_code_type, p_points_value, p_description, p_name, p_expires_at, v_user_id) returning id into v_reward_id;
  return json_build_object('success', true, 'reward_id', v_reward_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.redeem_code(p_code text, p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_reward record; v_partner record; v_points int;
begin
  if p_code is null or p_user_id is null then return json_build_object('success', false, 'error', 'Invalid parameters'); end if;
  -- Redeem for yourself, or be the server.
  if auth.uid() is not null and p_user_id <> auth.uid() then
    return json_build_object('success', false, 'error', 'You can only redeem for yourself');
  end if;
  select * into v_reward from public.rewards_ledger where code = p_code;
  if v_reward is null then
    select * into v_partner from public.partners where qr_uuid::text = p_code;
    if v_partner is not null then
      if exists(select 1 from public.check_ins where user_id = p_user_id and partner_id = v_partner.id and date(checked_in_at) = current_date) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;
      v_points := 150;
      insert into public.check_ins (user_id, partner_id, awarded_points) values (p_user_id, v_partner.id, v_points);
      update public.profiles set total_points = total_points + v_points where id = p_user_id;
      return json_build_object('success', true, 'type', 'partner', 'points_awarded', v_points, 'partner_name', v_partner.name, 'description', 'Checked in at ' || v_partner.name);
    end if;
    return json_build_object('success', false, 'error', 'Invalid code');
  end if;
  if v_reward.is_used then return json_build_object('success', false, 'error', 'Code already redeemed'); end if;
  if v_reward.expires_at is not null and v_reward.expires_at < now() then return json_build_object('success', false, 'error', 'Code has expired'); end if;
  update public.rewards_ledger set is_used = true, used_by = p_user_id, used_at = now() where id = v_reward.id;
  if v_reward.code_type = 'points' then
    update public.profiles set total_points = total_points + v_reward.points_value where id = p_user_id;
    return json_build_object('success', true, 'type', 'points', 'points_awarded', v_reward.points_value, 'description', coalesce(v_reward.description, 'Points reward redeemed!'));
  end if;
  if v_reward.code_type = 'partner' then
    return json_build_object('success', true, 'type', 'partner_access', 'partner_id', v_reward.partner_id, 'description', coalesce(v_reward.description, 'Partner access granted!'));
  end if;
  return json_build_object('success', true, 'type', v_reward.code_type);
end; $function$;

CREATE OR REPLACE FUNCTION public.reset_all_challenges()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE affected integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can reset challenges';
  END IF;
  UPDATE public.profiles SET challenge_start_date = now(), challenge_days_goal = 30;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END; $function$;

-- --- Triggers ---------------------------------------------------------------

DROP TRIGGER IF EXISTS friendship_guard_trg ON public.friendships;
CREATE TRIGGER friendship_guard_trg BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendship_guard();

DROP TRIGGER IF EXISTS gcm_validate_start_date_trg ON public.group_challenge_members;
CREATE TRIGGER gcm_validate_start_date_trg BEFORE INSERT OR UPDATE ON public.group_challenge_members
  FOR EACH ROW EXECUTE FUNCTION public.gcm_validate_start_date();

-- The one trigger outside `public`: without it a signup creates no profile and
-- nothing in the app works.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --- Row level security -----------------------------------------------------

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_challenge_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_fives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_photos ENABLE ROW LEVEL SECURITY;

-- --- Policies ---------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read the badge list" ON public.badges;
CREATE POLICY "Anyone can read the badge list" ON public.badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocked_users;
CREATE POLICY "Users can view own blocks" ON public.blocked_users FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can unblock" ON public.blocked_users;
CREATE POLICY "Users can unblock" ON public.blocked_users FOR DELETE TO public USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "See own invites" ON public.challenge_invites;
CREATE POLICY "See own invites" ON public.challenge_invites FOR SELECT TO authenticated
  USING (((auth.uid() = invitee_id) OR (auth.uid() = inviter_id)));
DROP POLICY IF EXISTS "Invite to a challenge you are in" ON public.challenge_invites;
CREATE POLICY "Invite to a challenge you are in" ON public.challenge_invites FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = inviter_id) AND ((EXISTS ( SELECT 1 FROM group_challenges c
    WHERE ((c.id = challenge_invites.challenge_id) AND (c.created_by = auth.uid())))) OR (EXISTS ( SELECT 1 FROM group_challenge_members m
    WHERE ((m.challenge_id = challenge_invites.challenge_id) AND (m.user_id = auth.uid()) AND (m.status <> 'left'::text)))))));
DROP POLICY IF EXISTS "Respond to invites" ON public.challenge_invites;
CREATE POLICY "Respond to invites" ON public.challenge_invites FOR UPDATE TO authenticated
  USING ((auth.uid() = invitee_id)) WITH CHECK ((auth.uid() = invitee_id));
DROP POLICY IF EXISTS "Withdraw invites" ON public.challenge_invites;
CREATE POLICY "Withdraw invites" ON public.challenge_invites FOR DELETE TO authenticated
  USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));

DROP POLICY IF EXISTS "Users manage own challenge logs" ON public.challenge_logs;
CREATE POLICY "Users manage own challenge logs" ON public.challenge_logs FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "See own task ticks" ON public.challenge_task_logs;
CREATE POLICY "See own task ticks" ON public.challenge_task_logs FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
-- The catch-up window is enforced here, not just in the UI: a tick may only
-- land on today or yesterday, and only from a member of that challenge.
DROP POLICY IF EXISTS "Tick within the window" ON public.challenge_task_logs;
CREATE POLICY "Tick within the window" ON public.challenge_task_logs FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (date <= CURRENT_DATE) AND (date >= (CURRENT_DATE - 1)) AND (EXISTS ( SELECT 1
    FROM (challenge_tasks t JOIN group_challenge_members m ON (((m.challenge_id = t.challenge_id) AND (m.user_id = auth.uid()) AND (m.status <> 'left'::text))))
    WHERE (t.id = challenge_task_logs.task_id)))));
DROP POLICY IF EXISTS "Untick own" ON public.challenge_task_logs;
CREATE POLICY "Untick own" ON public.challenge_task_logs FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Tasks visible with their challenge" ON public.challenge_tasks;
CREATE POLICY "Tasks visible with their challenge" ON public.challenge_tasks FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM group_challenges c WHERE (c.id = challenge_tasks.challenge_id))));
DROP POLICY IF EXISTS "Owner writes the task list" ON public.challenge_tasks;
CREATE POLICY "Owner writes the task list" ON public.challenge_tasks FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM group_challenges c
    WHERE ((c.id = challenge_tasks.challenge_id) AND ((c.created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND p.is_admin))))))));
DROP POLICY IF EXISTS "Owner edits the task list" ON public.challenge_tasks;
CREATE POLICY "Owner edits the task list" ON public.challenge_tasks FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM group_challenges c
    WHERE ((c.id = challenge_tasks.challenge_id) AND ((c.created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND p.is_admin))))))));
DROP POLICY IF EXISTS "Owner prunes the task list" ON public.challenge_tasks;
CREATE POLICY "Owner prunes the task list" ON public.challenge_tasks FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM group_challenges c
    WHERE ((c.id = challenge_tasks.challenge_id) AND ((c.created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND p.is_admin))))))));

DROP POLICY IF EXISTS "Read active challenges" ON public.challenges;
CREATE POLICY "Read active challenges" ON public.challenges FOR SELECT TO authenticated
  USING (((is_active = true) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));
DROP POLICY IF EXISTS "Admins manage challenges" ON public.challenges;
CREATE POLICY "Admins manage challenges" ON public.challenges FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.check_ins;
CREATE POLICY "Enable read access for authenticated users" ON public.check_ins FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Users can view own check_ins" ON public.check_ins;
CREATE POLICY "Users can view own check_ins" ON public.check_ins FOR SELECT TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.check_ins;
CREATE POLICY "Enable insert for authenticated users" ON public.check_ins FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Users can create check_ins" ON public.check_ins;
CREATE POLICY "Users can create check_ins" ON public.check_ins FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.check_ins;
CREATE POLICY "Enable update for authenticated users" ON public.check_ins FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.check_ins;
CREATE POLICY "Enable delete for authenticated users" ON public.check_ins FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Users can view own coach messages" ON public.coach_messages;
CREATE POLICY "Users can view own coach messages" ON public.coach_messages FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own coach messages" ON public.coach_messages;
CREATE POLICY "Users can insert own coach messages" ON public.coach_messages FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view messages" ON public.community_messages;
CREATE POLICY "Users can view messages" ON public.community_messages FOR SELECT TO authenticated
  USING (((group_id IS NULL) OR (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = community_messages.group_id) AND (group_members.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Users can create messages" ON public.community_messages;
CREATE POLICY "Users can create messages" ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((group_id IS NULL) OR (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = community_messages.group_id) AND (group_members.user_id = auth.uid())))))));
DROP POLICY IF EXISTS "Users can delete own community messages" ON public.community_messages;
CREATE POLICY "Users can delete own community messages" ON public.community_messages FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;
CREATE POLICY "Users can delete own messages" ON public.community_messages FOR DELETE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own reports" ON public.content_reports;
CREATE POLICY "Users can view own reports" ON public.content_reports FOR SELECT TO public USING ((auth.uid() = reporter_id));
DROP POLICY IF EXISTS content_reports_select_own ON public.content_reports;
CREATE POLICY content_reports_select_own ON public.content_reports FOR SELECT TO public USING ((auth.uid() = reporter_id));
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
CREATE POLICY "Users can create reports" ON public.content_reports FOR INSERT TO public WITH CHECK ((auth.uid() = reporter_id));
DROP POLICY IF EXISTS content_reports_insert_auth ON public.content_reports;
CREATE POLICY content_reports_insert_auth ON public.content_reports FOR INSERT TO public WITH CHECK ((auth.uid() = reporter_id));

DROP POLICY IF EXISTS "Read daily workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Read daily workout exercises" ON public.daily_workout_exercises FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM daily_workouts w
    WHERE ((w.id = daily_workout_exercises.daily_workout_id) AND (((w.is_published = true) AND (w.owner_id IS NULL)) OR (w.owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))))));
DROP POLICY IF EXISTS "Admins manage daily workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Admins manage daily workout exercises" ON public.daily_workout_exercises FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Users manage own personal workout exercises" ON public.daily_workout_exercises;
CREATE POLICY "Users manage own personal workout exercises" ON public.daily_workout_exercises FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM daily_workouts w WHERE ((w.id = daily_workout_exercises.daily_workout_id) AND (w.owner_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM daily_workouts w WHERE ((w.id = daily_workout_exercises.daily_workout_id) AND (w.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "Read published daily workouts" ON public.daily_workouts;
CREATE POLICY "Read published daily workouts" ON public.daily_workouts FOR SELECT TO authenticated
  USING ((((is_published = true) AND (owner_id IS NULL)) OR (owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));
DROP POLICY IF EXISTS "Admins manage daily workouts" ON public.daily_workouts;
CREATE POLICY "Admins manage daily workouts" ON public.daily_workouts FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Users manage own personal workouts" ON public.daily_workouts;
CREATE POLICY "Users manage own personal workouts" ON public.daily_workouts FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own DMs" ON public.direct_messages;
CREATE POLICY "Users can view own DMs" ON public.direct_messages FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (receiver_id = auth.uid())));
DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
CREATE POLICY "Users can send DMs" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()));
DROP POLICY IF EXISTS "Receivers can update DMs read status" ON public.direct_messages;
CREATE POLICY "Receivers can update DMs read status" ON public.direct_messages FOR UPDATE TO authenticated USING ((receiver_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own sent DMs" ON public.direct_messages;
CREATE POLICY "Users can delete own sent DMs" ON public.direct_messages FOR DELETE TO authenticated USING ((sender_id = auth.uid()));

DROP POLICY IF EXISTS "Read Global and Own Exercises" ON public.exercises;
CREATE POLICY "Read Global and Own Exercises" ON public.exercises FOR SELECT TO public USING (((user_id IS NULL) OR (auth.uid() = user_id)));
DROP POLICY IF EXISTS "Create Own Exercises" ON public.exercises;
CREATE POLICY "Create Own Exercises" ON public.exercises FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Read own or all feedback" ON public.feedback;
CREATE POLICY "Read own or all feedback" ON public.feedback FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));
DROP POLICY IF EXISTS "Users can submit feedback" ON public.feedback;
CREATE POLICY "Users can submit feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users manage own food favourites" ON public.food_favourites;
CREATE POLICY "Users manage own food favourites" ON public.food_favourites FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.food_logs;
CREATE POLICY "Enable read access for authenticated users" ON public.food_logs FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.food_logs;
CREATE POLICY "Enable insert for authenticated users" ON public.food_logs FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.food_logs;
CREATE POLICY "Enable update for authenticated users" ON public.food_logs FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.food_logs;
CREATE POLICY "Enable delete for authenticated users" ON public.food_logs FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "See own friendships" ON public.friendships;
CREATE POLICY "See own friendships" ON public.friendships FOR SELECT TO authenticated USING (((auth.uid() = user_a) OR (auth.uid() = user_b)));
DROP POLICY IF EXISTS "Send friend requests" ON public.friendships;
CREATE POLICY "Send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = requester_id) AND ((auth.uid() = user_a) OR (auth.uid() = user_b)) AND (status = 'pending'::text)));
DROP POLICY IF EXISTS "Respond to friend requests" ON public.friendships;
CREATE POLICY "Respond to friend requests" ON public.friendships FOR UPDATE TO authenticated
  USING (((auth.uid() = user_a) OR (auth.uid() = user_b))) WITH CHECK (((auth.uid() = user_a) OR (auth.uid() = user_b)));
DROP POLICY IF EXISTS "Remove friendships" ON public.friendships;
CREATE POLICY "Remove friendships" ON public.friendships FOR DELETE TO authenticated USING (((auth.uid() = user_a) OR (auth.uid() = user_b)));

DROP POLICY IF EXISTS "Members can view challenge membership" ON public.group_challenge_members;
CREATE POLICY "Members can view challenge membership" ON public.group_challenge_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members can join challenges" ON public.group_challenge_members;
CREATE POLICY "Members can join challenges" ON public.group_challenge_members FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Members can update own membership" ON public.group_challenge_members;
CREATE POLICY "Members can update own membership" ON public.group_challenge_members FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Members can leave challenges" ON public.group_challenge_members;
CREATE POLICY "Members can leave challenges" ON public.group_challenge_members FOR DELETE TO authenticated
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));

DROP POLICY IF EXISTS "Members can view group challenges" ON public.group_challenges;
CREATE POLICY "Members can view group challenges" ON public.group_challenges FOR SELECT TO authenticated
  USING (((visibility = 'public'::text) OR (created_by = auth.uid()) OR ((visibility = 'gym'::text) AND ((gym_id IS NULL) OR (gym_id = ( SELECT profiles.gym_id FROM profiles WHERE (profiles.id = auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM challenge_invites i WHERE ((i.challenge_id = group_challenges.id) AND (i.invitee_id = auth.uid()))))
    OR (EXISTS ( SELECT 1 FROM group_challenge_members m WHERE ((m.challenge_id = group_challenges.id) AND (m.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Members can create group challenges" ON public.group_challenges;
CREATE POLICY "Members can create group challenges" ON public.group_challenges FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = created_by) AND ((is_official = false) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))));
DROP POLICY IF EXISTS "Owner or admin can update group challenges" ON public.group_challenges;
CREATE POLICY "Owner or admin can update group challenges" ON public.group_challenges FOR UPDATE TO authenticated
  USING (((auth.uid() = created_by) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));
DROP POLICY IF EXISTS "Owner or admin can delete group challenges" ON public.group_challenges;
CREATE POLICY "Owner or admin can delete group challenges" ON public.group_challenges FOR DELETE TO authenticated
  USING (((auth.uid() = created_by) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members" ON public.group_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can join public groups" ON public.group_members;
CREATE POLICY "Users can join public groups" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM groups WHERE ((groups.id = group_members.group_id) AND (groups.is_public = true))))));
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE TO authenticated
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM group_members gm WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;
CREATE POLICY "Anyone can view public groups" ON public.groups FOR SELECT TO authenticated
  USING (((is_public = true) OR (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
DROP POLICY IF EXISTS "Group owners can update their groups" ON public.groups;
CREATE POLICY "Group owners can update their groups" ON public.groups FOR UPDATE TO authenticated
  USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
DROP POLICY IF EXISTS "Group owners can delete their groups" ON public.groups;
CREATE POLICY "Group owners can delete their groups" ON public.groups FOR DELETE TO authenticated USING ((created_by = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view gyms" ON public.gyms;
CREATE POLICY "Anyone can view gyms" ON public.gyms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage gyms" ON public.gyms;
CREATE POLICY "Admins manage gyms" ON public.gyms FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users manage own habit logs" ON public.habit_logs;
CREATE POLICY "Users manage own habit logs" ON public.habit_logs FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own habit logs" ON public.habit_logs;
CREATE POLICY "Users can update own habit logs" ON public.habit_logs FOR UPDATE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users see own habits." ON public.habits;
CREATE POLICY "Users see own habits." ON public.habits FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users create own habits." ON public.habits;
CREATE POLICY "Users create own habits." ON public.habits FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users update own habits" ON public.habits;
CREATE POLICY "Users update own habits" ON public.habits FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users delete own habits" ON public.habits;
CREATE POLICY "Users delete own habits" ON public.habits FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.high_fives;
CREATE POLICY "Enable read access for authenticated users" ON public.high_fives FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.high_fives;
CREATE POLICY "Enable insert for authenticated users" ON public.high_fives FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.high_fives;
CREATE POLICY "Enable update for authenticated users" ON public.high_fives FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.high_fives;
CREATE POLICY "Enable delete for authenticated users" ON public.high_fives FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Users can view likes" ON public.message_likes;
CREATE POLICY "Users can view likes" ON public.message_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can like messages" ON public.message_likes;
CREATE POLICY "Users can like messages" ON public.message_likes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can unlike messages" ON public.message_likes;
CREATE POLICY "Users can unlike messages" ON public.message_likes FOR DELETE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view replies" ON public.message_replies;
CREATE POLICY "Users can view replies" ON public.message_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can create replies" ON public.message_replies;
CREATE POLICY "Users can create replies" ON public.message_replies FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own replies" ON public.message_replies;
CREATE POLICY "Users can delete own replies" ON public.message_replies FOR DELETE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view partners" ON public.partners;
CREATE POLICY "Anyone can view partners" ON public.partners FOR SELECT TO public USING (true);
-- Creating a venue mints a 150-point check-in code, so it is an admin action.
DROP POLICY IF EXISTS "Admins create partners" ON public.partners;
CREATE POLICY "Admins create partners" ON public.partners FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.is_admin = true))));
DROP POLICY IF EXISTS "Admins update partners" ON public.partners;
CREATE POLICY "Admins update partners" ON public.partners FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.is_admin = true))));
DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
CREATE POLICY "Admins can manage partners" ON public.partners FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Users can delete own partners" ON public.partners;
CREATE POLICY "Users can delete own partners" ON public.partners FOR DELETE TO authenticated
  USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.public_feed;
CREATE POLICY "Enable read access for authenticated users" ON public.public_feed FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.public_feed;
CREATE POLICY "Enable insert for authenticated users" ON public.public_feed FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.public_feed;
CREATE POLICY "Enable update for authenticated users" ON public.public_feed FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.public_feed;
CREATE POLICY "Enable delete for authenticated users" ON public.public_feed FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Users can delete own feed posts" ON public.public_feed;
CREATE POLICY "Users can delete own feed posts" ON public.public_feed FOR DELETE TO public USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Anyone can view reward codes" ON public.rewards_ledger;
-- An unredeemed code is a bearer token: whoever can read it can spend it.
DROP POLICY IF EXISTS "See own redemptions or all as admin" ON public.rewards_ledger;
CREATE POLICY "See own redemptions or all as admin" ON public.rewards_ledger FOR SELECT TO authenticated
  USING ((used_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));
DROP POLICY IF EXISTS "Admins can create reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can create reward codes" ON public.rewards_ledger FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Admins can update reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can update reward codes" ON public.rewards_ledger FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Admins can delete reward codes" ON public.rewards_ledger;
CREATE POLICY "Admins can delete reward codes" ON public.rewards_ledger FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users manage own training notes" ON public.training_notes;
CREATE POLICY "Users manage own training notes" ON public.training_notes FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- Badges are a boast, so everyone can see everyone's. Only award_my_badges()
-- writes them: there is deliberately no client INSERT or UPDATE policy.
DROP POLICY IF EXISTS "Anyone can see earned badges" ON public.user_badges;
CREATE POLICY "Anyone can see earned badges" ON public.user_badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks FOR SELECT TO public USING ((auth.uid() = blocker_id));
DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own ON public.user_blocks FOR INSERT TO public WITH CHECK ((auth.uid() = blocker_id));
DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own ON public.user_blocks FOR DELETE TO public USING ((auth.uid() = blocker_id));

DROP POLICY IF EXISTS "Users can view own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can view own wearable logs" ON public.wearable_logs FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can insert own wearable logs" ON public.wearable_logs FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can update own wearable logs" ON public.wearable_logs FOR UPDATE TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own wearable logs" ON public.wearable_logs;
CREATE POLICY "Users can delete own wearable logs" ON public.wearable_logs FOR DELETE TO public USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users manage own weight logs" ON public.weight_logs;
CREATE POLICY "Users manage own weight logs" ON public.weight_logs FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own workout completions" ON public.workout_completions;
CREATE POLICY "Users manage own workout completions" ON public.workout_completions FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users see own logs." ON public.workout_logs;
CREATE POLICY "Users see own logs." ON public.workout_logs FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users create own logs." ON public.workout_logs;
CREATE POLICY "Users create own logs." ON public.workout_logs FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users update own logs" ON public.workout_logs;
CREATE POLICY "Users update own logs" ON public.workout_logs FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users delete own logs" ON public.workout_logs;
CREATE POLICY "Users delete own logs" ON public.workout_logs FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users manage own workout photos" ON public.workout_photos;
CREATE POLICY "Users manage own workout photos" ON public.workout_photos FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- --- Column-level grants ----------------------------------------------------
-- A member may leave or restart a challenge, but must not write their own
-- score: days_done is set only by recalc_my_challenge_progress().

REVOKE UPDATE ON public.group_challenge_members FROM authenticated;
GRANT UPDATE (status, start_date, last_checked, restarts) ON public.group_challenge_members TO authenticated;

-- Postgres grants EXECUTE on new functions to PUBLIC, and `anon` inherits it.
-- Left alone, every SECURITY DEFINER function here would be callable by anyone
-- holding the publishable key — which ships in the JavaScript bundle. Take it
-- off PUBLIC and hand it back only to the roles that should have it.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

-- Internal to recalc_my_challenge_progress; nobody else should call it.
REVOKE EXECUTE ON FUNCTION public.completed_days_for(uuid, date) FROM PUBLIC, anon, authenticated;

-- Trigger functions are not RPCs and should not be in the exposed API surface.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.friendship_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gcm_validate_start_date() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_points(uuid, integer) TO authenticated, service_role;

-- --- Storage ----------------------------------------------------------------
-- Buckets and their policies. workout-photos is private ("only you will see
-- it"); the rest are public reads with owner-scoped writes. The first path
-- segment of every object is the owner's user id, which is what the policies
-- check.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('feedback-images', 'feedback-images', true),
  ('post-images', 'post-images', true),
  ('progress-photos', 'progress-photos', true),
  ('workout-photos', 'workout-photos', false)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  stmt text;
  stmts text[] := ARRAY[
    'CREATE POLICY "Anyone can view post images" ON storage.objects FOR SELECT TO public USING ((bucket_id = ''post-images''::text))',
    'CREATE POLICY "Authenticated users can upload post images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''post-images''::text))',
    'CREATE POLICY "Users can delete own post images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = ''post-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))',
    'CREATE POLICY "Anyone can view progress photos" ON storage.objects FOR SELECT TO public USING ((bucket_id = ''progress-photos''::text))',
    'CREATE POLICY "Users can upload own progress photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''progress-photos''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))',
    'CREATE POLICY "Users can delete own progress photos" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = ''progress-photos''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))',
    'CREATE POLICY "Users can read own workout photos" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = ''workout-photos''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))',
    'CREATE POLICY "Users can upload own workout photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''workout-photos''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))',
    'CREATE POLICY "Users can delete own workout photos" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = ''workout-photos''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))',
    'CREATE POLICY "Feedback images are publicly readable" ON storage.objects FOR SELECT TO public USING ((bucket_id = ''feedback-images''::text))',
    'CREATE POLICY "Users can upload feedback images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''feedback-images''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))',
    'CREATE POLICY "Users can delete own feedback images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = ''feedback-images''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))'
  ];
BEGIN
  FOREACH stmt IN ARRAY stmts LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- --- Seed data --------------------------------------------------------------
-- The rows the app needs to work at all, as opposed to member data.

-- handle_new_user() looks this gym up by slug on every signup. Without it,
-- new members get no gym and 'gym'-visibility challenges leak to everyone.
INSERT INTO public.gyms (name, slug, city) VALUES ('Arctivate', 'arctivate', NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.badges (key, name, description, icon, sort_order) VALUES
  ('first_join', 'In The Arena', 'Joined your first challenge', '🎟️', 10),
  ('first_day', 'Day One', 'Completed your first full day', '✅', 20),
  ('week_one', 'Seven Straight', 'Completed 7 days in one challenge', '🔥', 30),
  ('halfway', 'Halfway', 'Reached the halfway point of a challenge', '🌗', 40),
  ('finisher', 'Finisher', 'Completed every day of a challenge', '🏆', 50),
  ('clean_run', 'Spotless', 'Finished a challenge without a single restart', '💎', 60),
  ('caller', 'Instigator', 'Challenged five different people', '📣', 70),
  ('answered', 'Never Backs Down', 'Accepted a challenge someone sent you', '🤝', 80)
ON CONFLICT (key) DO UPDATE
  SET name = excluded.name, description = excluded.description,
      icon = excluded.icon, sort_order = excluded.sort_order;

-- ============================================================================
-- End of baseline.
-- ============================================================================

-- ===========================================================================
-- Sessions (migration 041). Kept as one block rather than folded into the
-- sections above so it stays readable against the migration it came from.
-- The history backfill in 041 is deliberately NOT repeated here: a fresh
-- database has no logs to convert.
-- ===========================================================================

-- Sessions as the thing people see.
--
-- 741 exercise logs across 178 gym sessions, and six of them ever became
-- visible to another member. Sharing was an opt-in toggle on a single exercise
-- inside a success modal, so the unit was wrong (one lift, not a session) and
-- the default was wrong (silence). 425 of those logs were personal bests that
-- nobody else saw.
--
-- A session is now a real row with its own visibility, logs hang off it, and
-- finishing one puts it in front of the gym unless the member says otherwise.

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  notes text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  -- 'gym' is visible to other members of the same gym; 'private' is yours only.
  visibility text NOT NULL DEFAULT 'gym',
  gym_id uuid,
  daily_workout_id uuid,
  kudos_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_visibility_check CHECK ((visibility = ANY (ARRAY['gym'::text, 'private'::text])))
);

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE TABLE IF NOT EXISTS public.session_kudos (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_kudos_pkey PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.session_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_comments_pkey PRIMARY KEY (id),
  CONSTRAINT session_comments_body_check CHECK ((length(btrim(body)) > 0 AND length(body) <= 500))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_user_id_fkey') THEN
    -- profiles, not auth.users: PostgREST resolves `profiles:user_id (...)`
    -- from the foreign key, and an embed it cannot resolve fails the whole
    -- query. profiles.id is itself FK'd to auth.users ON DELETE CASCADE.
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_gym_id_fkey') THEN
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_gym_id_fkey
      FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_logs_session_id_fkey') THEN
    ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_kudos_session_id_fkey') THEN
    ALTER TABLE public.session_kudos ADD CONSTRAINT session_kudos_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_kudos_user_id_fkey') THEN
    ALTER TABLE public.session_kudos ADD CONSTRAINT session_kudos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_comments_session_id_fkey') THEN
    ALTER TABLE public.session_comments ADD CONSTRAINT session_comments_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_comments_user_id_fkey') THEN
    ALTER TABLE public.session_comments ADD CONSTRAINT session_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_feed ON public.workout_sessions USING btree (gym_id, started_at DESC) WHERE (visibility = 'gym');
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON public.workout_sessions USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_session ON public.workout_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_comments_session ON public.session_comments USING btree (session_id, created_at);

-- Can the caller see this session? Used by the log/kudos/comment policies so
-- the visibility rule lives in exactly one place.
CREATE OR REPLACE FUNCTION public.can_see_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.workout_sessions s
    WHERE s.id = p_session_id
      AND (
        s.user_id = auth.uid()
        OR (
          s.visibility = 'gym'
          AND s.gym_id IS NOT NULL
          AND s.gym_id = (SELECT p.gym_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.can_see_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_session(uuid) TO authenticated, service_role;

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_kudos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own or gym-visible sessions" ON public.workout_sessions;
CREATE POLICY "Members see own or gym-visible sessions" ON public.workout_sessions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (visibility = 'gym' AND gym_id IS NOT NULL
        AND gym_id = (SELECT p.gym_id FROM public.profiles p WHERE p.id = auth.uid()))
  );

DROP POLICY IF EXISTS "Members create own sessions" ON public.workout_sessions;
CREATE POLICY "Members create own sessions" ON public.workout_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members update own sessions" ON public.workout_sessions;
CREATE POLICY "Members update own sessions" ON public.workout_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own sessions" ON public.workout_sessions;
CREATE POLICY "Members delete own sessions" ON public.workout_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- kudos_count / comments_count are maintained by triggers, so a member must not
-- be able to hand themselves a hundred high fives by writing the column.
REVOKE UPDATE ON public.workout_sessions FROM authenticated;
GRANT UPDATE (title, notes, visibility, ended_at, daily_workout_id) ON public.workout_sessions TO authenticated;

DROP POLICY IF EXISTS "See kudos on sessions you can see" ON public.session_kudos;
CREATE POLICY "See kudos on sessions you can see" ON public.session_kudos FOR SELECT TO authenticated
  USING (public.can_see_session(session_id));

DROP POLICY IF EXISTS "Give kudos as yourself" ON public.session_kudos;
CREATE POLICY "Give kudos as yourself" ON public.session_kudos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_session(session_id));

DROP POLICY IF EXISTS "Take back your own kudos" ON public.session_kudos;
CREATE POLICY "Take back your own kudos" ON public.session_kudos FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "See comments on sessions you can see" ON public.session_comments;
CREATE POLICY "See comments on sessions you can see" ON public.session_comments FOR SELECT TO authenticated
  USING (public.can_see_session(session_id));

DROP POLICY IF EXISTS "Comment as yourself" ON public.session_comments;
CREATE POLICY "Comment as yourself" ON public.session_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_session(session_id));

-- Your own comment, or anything on your own session.
DROP POLICY IF EXISTS "Delete your comment or one on your session" ON public.session_comments;
CREATE POLICY "Delete your comment or one on your session" ON public.session_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- The feed has to show the lifts, so other members need to read the logs that
-- belong to a session they can see -- and nothing else. workout_logs keeps its
-- existing owner-only policy; this one only ever widens to rows whose session
-- is already visible, so a log with no session stays private as before.
DROP POLICY IF EXISTS "Read logs inside a visible session" ON public.workout_logs;
CREATE POLICY "Read logs inside a visible session" ON public.workout_logs FOR SELECT TO authenticated
  USING (session_id IS NOT NULL AND public.can_see_session(session_id));

CREATE OR REPLACE FUNCTION public.bump_session_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session uuid := COALESCE(NEW.session_id, OLD.session_id);
  v_delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
BEGIN
  IF TG_TABLE_NAME = 'session_kudos' THEN
    UPDATE public.workout_sessions
       SET kudos_count = GREATEST(0, kudos_count + v_delta)
     WHERE id = v_session;
  ELSE
    UPDATE public.workout_sessions
       SET comments_count = GREATEST(0, comments_count + v_delta)
     WHERE id = v_session;
  END IF;
  RETURN NULL;
END;
$function$;

-- A trigger function has no business being an RPC, and Postgres grants EXECUTE
-- on a new function to PUBLIC -- which put this on the REST API callable by
-- anon. Calling it outside a trigger errors on the missing NEW/OLD/TG_OP, so
-- nothing was exploitable, but this is the same mistake migration 037 cleaned up.
REVOKE EXECUTE ON FUNCTION public.bump_session_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_session_counts() TO service_role;

DROP TRIGGER IF EXISTS trg_session_kudos_count ON public.session_kudos;
CREATE TRIGGER trg_session_kudos_count
  AFTER INSERT OR DELETE ON public.session_kudos
  FOR EACH ROW EXECUTE FUNCTION public.bump_session_counts();

DROP TRIGGER IF EXISTS trg_session_comments_count ON public.session_comments;
CREATE TRIGGER trg_session_comments_count
  AFTER INSERT OR DELETE ON public.session_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_session_counts();

-- ===========================================================================
-- Per-lift leaderboards (migration 042). Functions, grants and indexes only.
-- ===========================================================================

-- Leaderboards per lift. Strava segments, for a gym.
--
-- Two things about the data shaped this.
--
-- First, exercises are not shared. Only three rows are gym-wide benchmarks
-- (5k Run, Bench Press, Deadlift); everything else is created per member, so
-- "Ski Erg" exists three times and "Lap" three times, one row each. Ranking by
-- exercise_id would produce a pile of one-person boards. Boards are keyed on
-- the trimmed, lowercased name plus metric type instead, so people doing the
-- same movement land on the same board whoever created their row.
--
-- Second, visibility. A board only ever counts lifts from sessions the member
-- chose to share with their gym, exactly like a Strava segment ignores private
-- activities. Every session in the database today is private (migration 041
-- backfilled history that way on purpose), so these boards start empty and fill
-- as people share. That is the honest behaviour: publishing someone's numbers
-- because they once logged them privately is not a leaderboard, it is a leak.
--
-- The functions are SECURITY DEFINER because they have to read across members,
-- and each one is pinned to the caller's own gym and to gym-visible sessions.

-- One row per lift with a board in the caller's gym.
CREATE OR REPLACE FUNCTION public.gym_lift_boards()
RETURNS TABLE (
  lift text,
  display_name text,
  metric_type text,
  entrants integer,
  leader_name text,
  leader_avatar text,
  leader_value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT gym_id FROM public.profiles WHERE id = auth.uid()
  ),
  shared AS (
    SELECT
      lower(btrim(e.name)) AS lift,
      btrim(e.name)        AS display_name,
      COALESCE(e.metric_type, 'weight') AS metric_type,
      l.user_id,
      l.value
    FROM public.workout_logs l
    JOIN public.workout_sessions s ON s.id = l.session_id
    JOIN public.exercises e        ON e.id = l.exercise_id
    CROSS JOIN me
    WHERE s.visibility = 'gym'
      AND s.ended_at IS NOT NULL
      AND s.gym_id IS NOT NULL
      AND me.gym_id IS NOT NULL
      AND s.gym_id = me.gym_id
  ),
  -- The spelling most people used, rather than whichever happens to sort
  -- first: min() picked "bench press zz" over "Bench Press ZZ".
  names AS (
    SELECT lift, metric_type, mode() WITHIN GROUP (ORDER BY display_name) AS display_name
    FROM shared GROUP BY lift, metric_type
  ),
  -- One entry per member per lift: their best, direction depending on metric.
  bests AS (
    SELECT lift, metric_type, user_id,
           CASE WHEN metric_type = 'time' THEN min(value) ELSE max(value) END AS best
    FROM shared
    GROUP BY lift, metric_type, user_id
  ),
  ranked AS (
    SELECT b.*,
           row_number() OVER (
             PARTITION BY b.lift, b.metric_type
             ORDER BY CASE WHEN b.metric_type = 'time' THEN b.best END ASC NULLS LAST,
                      CASE WHEN b.metric_type <> 'time' THEN b.best END DESC NULLS LAST
           ) AS pos,
           -- Counted here rather than in the outer SELECT. WHERE runs before
           -- window functions, so counting out there only ever saw the single
           -- row that survived `pos = 1`, and every board claimed one entrant.
           count(*) OVER (PARTITION BY b.lift, b.metric_type)::int AS entrants
    FROM bests b
  )
  SELECT r.lift, n.display_name, r.metric_type, r.entrants, p.username, p.avatar_url, r.best
  FROM ranked r
  JOIN public.profiles p ON p.id = r.user_id
  JOIN names n ON n.lift = r.lift AND n.metric_type = r.metric_type
  WHERE r.pos = 1
  ORDER BY r.entrants DESC, n.display_name;
$function$;

-- The board itself, for one lift.
CREATE OR REPLACE FUNCTION public.gym_lift_board(p_lift text, p_metric text, p_limit integer DEFAULT 20)
RETURNS TABLE (
  board_position integer,
  user_id uuid,
  username text,
  avatar_url text,
  best numeric,
  achieved_at timestamp with time zone,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT gym_id FROM public.profiles WHERE id = auth.uid()
  ),
  shared AS (
    SELECT l.user_id, l.value, l.created_at
    FROM public.workout_logs l
    JOIN public.workout_sessions s ON s.id = l.session_id
    JOIN public.exercises e        ON e.id = l.exercise_id
    CROSS JOIN me
    WHERE s.visibility = 'gym'
      AND s.ended_at IS NOT NULL
      AND s.gym_id IS NOT NULL
      AND me.gym_id IS NOT NULL
      AND s.gym_id = me.gym_id
      AND lower(btrim(e.name)) = lower(btrim(p_lift))
      AND COALESCE(e.metric_type, 'weight') = COALESCE(p_metric, 'weight')
  ),
  bests AS (
    SELECT DISTINCT ON (user_id)
           user_id, value AS best, created_at
    FROM shared
    ORDER BY user_id,
             CASE WHEN COALESCE(p_metric,'weight') = 'time' THEN value END ASC NULLS LAST,
             CASE WHEN COALESCE(p_metric,'weight') <> 'time' THEN value END DESC NULLS LAST,
             created_at ASC
  )
  SELECT
    row_number() OVER (
      ORDER BY CASE WHEN COALESCE(p_metric,'weight') = 'time' THEN b.best END ASC NULLS LAST,
               CASE WHEN COALESCE(p_metric,'weight') <> 'time' THEN b.best END DESC NULLS LAST,
               b.created_at ASC
    )::int,
    b.user_id,
    p.username,
    p.avatar_url,
    b.best,
    b.created_at,
    (b.user_id = auth.uid())
  FROM bests b
  JOIN public.profiles p ON p.id = b.user_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$function$;

-- The caller's own best per lift, across ALL their sessions including private
-- ones -- it is their data. `on_board` says whether that best is one the gym
-- can see, which is what makes "share a session to get on the board" honest
-- rather than a nag.
CREATE OR REPLACE FUNCTION public.my_lift_bests()
RETURNS TABLE (
  lift text,
  display_name text,
  metric_type text,
  best numeric,
  achieved_at timestamp with time zone,
  on_board boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mine AS (
    SELECT
      lower(btrim(e.name)) AS lift,
      btrim(e.name)        AS display_name,
      COALESCE(e.metric_type, 'weight') AS metric_type,
      l.value,
      l.created_at,
      (s.id IS NOT NULL AND s.visibility = 'gym' AND s.ended_at IS NOT NULL) AS shared
    FROM public.workout_logs l
    JOIN public.exercises e ON e.id = l.exercise_id
    LEFT JOIN public.workout_sessions s ON s.id = l.session_id
    WHERE l.user_id = auth.uid()
  ),
  names AS (
    SELECT lift, metric_type, mode() WITHIN GROUP (ORDER BY display_name) AS display_name
    FROM mine GROUP BY lift, metric_type
  ),
  best AS (
    SELECT DISTINCT ON (lift, metric_type) lift, metric_type, value, created_at, shared
    FROM mine
    ORDER BY lift, metric_type,
             CASE WHEN metric_type = 'time' THEN value END ASC NULLS LAST,
             CASE WHEN metric_type <> 'time' THEN value END DESC NULLS LAST,
             created_at ASC
  )
  SELECT b.lift, n.display_name, b.metric_type, b.value, b.created_at, b.shared
  FROM best b JOIN names n ON n.lift = b.lift AND n.metric_type = b.metric_type
  ORDER BY n.display_name;
$function$;

REVOKE EXECUTE ON FUNCTION public.gym_lift_boards() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gym_lift_board(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_lift_bests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gym_lift_boards() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gym_lift_board(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_lift_bests() TO authenticated, service_role;

-- The board joins logs to sessions to exercises for every member of a gym, so
-- it wants an index that starts from the shared sessions rather than the member.
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_session
  ON public.workout_logs USING btree (exercise_id, session_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name_lower
  ON public.exercises USING btree (lower(btrim(name)));

-- ===========================================================================
-- Following (migration 043).
-- ===========================================================================

-- Following, instead of asking permission to be friends.
--
-- friendships is a mutual model: one side requests, the other accepts, and the
-- row carries a status. After a year in production it holds zero rows. Nobody
-- ever completed the handshake -- the same lesson as sharing being opt-in.
--
-- Following is one-sided and needs no approval, which is how Strava works and
-- why its graph fills. You follow someone; they do not have to agree.
--
-- Nothing here widens what anyone can see. Session visibility is still 'gym' or
-- 'private' and is still enforced by can_see_session(); following only changes
-- whose sessions the feed puts in front of you. Following someone at another
-- gym therefore shows you nothing of theirs, which is the correct and boring
-- consequence of not weakening the visibility rule to add a feature.
--
-- friendships is left in place and untouched. It has no rows, so nothing is
-- lost, and dropping a table is a decision to make on its own.

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_not_self CHECK ((follower_id <> following_id))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_follower_id_fkey') THEN
    ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_fkey
      FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_following_id_fkey') THEN
    ALTER TABLE public.follows ADD CONSTRAINT follows_following_id_fkey
      FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Reading the other direction ("who follows me") needs its own index; the
-- primary key only helps going outward.
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows USING btree (following_id, created_at DESC);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Who follows whom is public to signed-in members, the same as it is on Strava:
-- follower counts are visible, and you can see who someone follows. It exposes
-- no training data on its own.
DROP POLICY IF EXISTS "Signed-in members can see follows" ON public.follows;
CREATE POLICY "Signed-in members can see follows" ON public.follows FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Follow as yourself" ON public.follows;
CREATE POLICY "Follow as yourself" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- You can stop following someone, and you can remove a follower.
DROP POLICY IF EXISTS "Unfollow, or remove a follower" ON public.follows;
CREATE POLICY "Unfollow, or remove a follower" ON public.follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Follower and following counts for one member, in one round trip.
CREATE OR REPLACE FUNCTION public.follow_counts(p_user_id uuid)
RETURNS TABLE (followers integer, following integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*) FROM public.follows WHERE following_id = p_user_id)::int,
    (SELECT count(*) FROM public.follows WHERE follower_id  = p_user_id)::int;
$function$;

REVOKE EXECUTE ON FUNCTION public.follow_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_counts(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Partner QR codes are not public (migration 044).
--
-- A partner's qr_uuid is worth a check-in to whoever holds it, so it is not
-- part of the table read any more, and the check-in itself happens in the
-- database with the venue's own points_value.
-- ---------------------------------------------------------------------------
-- --- the check-in, server-side ----------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in_with_qr(p_qr text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_partner record;
  v_points int;
begin
  if v_user is null then
    return json_build_object('success', false, 'error', 'Please log in to check in');
  end if;
  if p_qr is null or btrim(p_qr) = '' then
    return json_build_object('success', false, 'error', 'not_a_partner');
  end if;

  -- Compared as text on purpose: a reward code is not a uuid, and casting the
  -- argument instead would throw rather than fall through to redeem_code().
  select * into v_partner from public.partners p where p.qr_uuid::text = btrim(p_qr);

  -- Not a partner QR. The caller should try this as a reward code next, so this
  -- is a sentinel rather than something to put in front of a member.
  if v_partner is null then
    return json_build_object('success', false, 'error', 'not_a_partner');
  end if;

  if exists (
    select 1 from public.check_ins c
    where c.user_id = v_user
      and c.partner_id = v_partner.id
      and date(c.checked_in_at) = current_date
  ) then
    return json_build_object('success', false, 'error', 'You already checked in here today! Come back tomorrow.');
  end if;

  -- The venue's number, not the client's.
  v_points := greatest(coalesce(v_partner.points_value, 150), 0);

  insert into public.check_ins (user_id, partner_id, awarded_points)
  values (v_user, v_partner.id, v_points);

  update public.profiles
     set total_points = coalesce(total_points, 0) + v_points
   where id = v_user;

  return json_build_object(
    'success', true,
    'type', 'checkin',
    'points_awarded', v_points,
    'partner_name', v_partner.name,
    'discount_text', v_partner.discount_text,
    'description', coalesce(v_partner.description, 'Checked in at ' || v_partner.name)
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, so revoking from
-- anon alone would leave it reachable through PUBLIC.
REVOKE EXECUTE ON FUNCTION public.check_in_with_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_with_qr(text) TO authenticated, service_role;

-- --- owners and admins still need their own codes ---------------------------

CREATE OR REPLACE FUNCTION public.my_partner_qr()
RETURNS TABLE (partner_id uuid, qr_uuid text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  select p.id, p.qr_uuid::text
  from public.partners p
  where p.owner_id = auth.uid()
     or exists (
       select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.is_admin = true
     );
$$;

REVOKE EXECUTE ON FUNCTION public.my_partner_qr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_partner_qr() TO authenticated, service_role;

-- --- take qr_uuid off the table read -----------------------------------------

-- SELECT was granted table-wide, and a column-level REVOKE cannot carve a hole
-- in a table-level grant. So the grant is replaced by an explicit column list.
REVOKE SELECT ON public.partners FROM anon, authenticated;
GRANT SELECT (id, name, location_lat, location_long, discount_text, points_value, description, owner_id)
  ON public.partners TO anon, authenticated;

-- --- while we are here: redeem_code paid a flat 150 --------------------------

-- redeem_code() also accepts a partner qr_uuid, and awarded a hardcoded 150
-- regardless of what the venue set. Same body, one number fixed.
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_reward record; v_partner record; v_points int;
begin
  if p_code is null or p_user_id is null then return json_build_object('success', false, 'error', 'Invalid parameters'); end if;
  if auth.uid() is not null and p_user_id <> auth.uid() then
    return json_build_object('success', false, 'error', 'You can only redeem for yourself');
  end if;

  select * into v_reward from public.rewards_ledger where code = p_code;
  if v_reward is null then
    select * into v_partner from public.partners where qr_uuid::text = p_code;
    if v_partner is not null then
      if exists(select 1 from public.check_ins where user_id = p_user_id and partner_id = v_partner.id and date(checked_in_at) = current_date) then
        return json_build_object('success', false, 'error', 'Already checked in today');
      end if;
      v_points := greatest(coalesce(v_partner.points_value, 150), 0);
      insert into public.check_ins (user_id, partner_id, awarded_points) values (p_user_id, v_partner.id, v_points);
      update public.profiles set total_points = coalesce(total_points, 0) + v_points where id = p_user_id;
      return json_build_object('success', true, 'type', 'partner', 'points_awarded', v_points, 'partner_name', v_partner.name, 'description', 'Checked in at ' || v_partner.name);
    end if;
    return json_build_object('success', false, 'error', 'Invalid code');
  end if;
  if v_reward.is_used then return json_build_object('success', false, 'error', 'Code already redeemed'); end if;
  if v_reward.expires_at is not null and v_reward.expires_at < now() then return json_build_object('success', false, 'error', 'Code has expired'); end if;
  update public.rewards_ledger set is_used = true, used_by = p_user_id, used_at = now() where id = v_reward.id;
  if v_reward.code_type = 'points' then
    update public.profiles set total_points = coalesce(total_points, 0) + v_reward.points_value where id = p_user_id;
    return json_build_object('success', true, 'type', 'points', 'points_awarded', v_reward.points_value, 'description', coalesce(v_reward.description, 'Points reward redeemed!'));
  end if;
  if v_reward.code_type = 'partner' then
    return json_build_object('success', true, 'type', 'partner_access', 'partner_id', v_reward.partner_id, 'description', coalesce(v_reward.description, 'Partner access granted!'));
  end if;
  return json_build_object('success', true, 'type', v_reward.code_type);
end; $$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text, uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- A challenge that is always there (migration 045).
--
-- Every gym has one challenge running permanently, created the first time a
-- member of that gym opens the page. Each member's thirty days start the day
-- they join, so there is no start line to miss.
-- ---------------------------------------------------------------------------
-- One per gym. The partial unique index is what makes ensure_gym_challenge()
-- safe when two members of the same gym open the page at the same moment --
-- one insert wins, the other reads the winner's row.
CREATE UNIQUE INDEX IF NOT EXISTS group_challenges_one_house_per_gym
  ON public.group_challenges (gym_id)
  WHERE is_official = true AND is_active = true AND gym_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_gym_challenge()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_gym  uuid;
  v_id   uuid;
begin
  if v_user is null then return null; end if;

  select gym_id into v_gym from public.profiles where id = v_user;
  -- A member with no gym has nobody to do it with; the page falls back to
  -- what it always showed.
  if v_gym is null then return null; end if;

  select id into v_id
  from public.group_challenges
  where gym_id = v_gym and is_official = true and is_active = true
  limit 1;
  if v_id is not null then return v_id; end if;

  begin
    insert into public.group_challenges (
      title, description, start_date, length_days, strict,
      visibility, gym_vs_gym, is_official, gym_id, is_active, created_by
    ) values (
      'The Daily 3',
      'Three things, every day, for thirty days. Your whole gym is in it.',
      current_date, 30, false,
      'gym', false, true, v_gym, true,
      -- Nobody owns it, so nobody can quietly rewrite everyone's checklist.
      null
    )
    returning id into v_id;

    -- Short on purpose: three things you can finish on a bad day beat ten you
    -- cannot. Same list a new member gets for their own habits.
    insert into public.challenge_tasks (challenge_id, title, position) values
      (v_id, '45 minutes of movement', 0),
      (v_id, '3 litres of water', 1),
      (v_id, '10 minutes of reading', 2);
  exception when unique_violation then
    -- Somebody else's insert won the race. Theirs is as good as ours.
    select id into v_id
    from public.group_challenges
    where gym_id = v_gym and is_official = true and is_active = true
    limit 1;
  end;

  return v_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function.
REVOKE EXECUTE ON FUNCTION public.ensure_gym_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_gym_challenge() TO authenticated, service_role;

-- How many people at your gym ticked everything off today. This is the line
-- that makes the tab worth opening tomorrow, and a browser cannot work it out
-- for itself -- it can only see its own owner's ticks.
CREATE OR REPLACE FUNCTION public.challenge_today(p_challenge_id uuid)
RETURNS TABLE (members integer, done_today integer, ticked_today integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH task_count AS (
    SELECT count(*)::int AS n FROM public.challenge_tasks t WHERE t.challenge_id = p_challenge_id
  ), per_member AS (
    SELECT m.user_id, count(l.*)::int AS ticks
    FROM public.group_challenge_members m
    LEFT JOIN public.challenge_task_logs l
      ON l.user_id = m.user_id
     AND l.date = current_date
     AND l.task_id IN (SELECT t.id FROM public.challenge_tasks t WHERE t.challenge_id = p_challenge_id)
    WHERE m.challenge_id = p_challenge_id AND m.status = 'active'
    GROUP BY m.user_id
  )
  SELECT
    (SELECT count(*)::int FROM per_member),
    -- Everything ticked. A challenge with no tasks has nothing to finish, so
    -- nobody counts as done rather than everybody.
    (SELECT count(*)::int FROM per_member p, task_count c WHERE c.n > 0 AND p.ticks >= c.n),
    (SELECT count(*)::int FROM per_member p WHERE p.ticks > 0);
$$;

REVOKE EXECUTE ON FUNCTION public.challenge_today(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_today(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- A session can carry a photo (migration 046).
--
-- A photo attached to a session is seen by whoever can see the session, so a
-- private session keeps its photo private.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workout_photos
  ADD COLUMN IF NOT EXISTS session_id uuid
  REFERENCES public.workout_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS workout_photos_session_idx
  ON public.workout_photos (session_id) WHERE session_id IS NOT NULL;

-- --- the row -----------------------------------------------------------------

-- RLS is permissive, so this only ever widens what can be read: the existing
-- own-photos policy still covers everything that is not on a session.
DROP POLICY IF EXISTS "See photos on a session you can see" ON public.workout_photos;
CREATE POLICY "See photos on a session you can see"
  ON public.workout_photos FOR SELECT TO authenticated
  USING (session_id IS NOT NULL AND public.can_see_session(session_id));

-- --- the file ----------------------------------------------------------------

-- The bucket is private and the app reads through signed URLs, which storage
-- will only mint for an object the caller may select. Without this the row
-- would be readable and the picture would not.
DROP POLICY IF EXISTS "Read a photo on a session you can see" ON storage.objects;
CREATE POLICY "Read a photo on a session you can see"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'workout-photos'
    AND EXISTS (
      SELECT 1 FROM public.workout_photos wp
      WHERE wp.storage_path = storage.objects.name
        AND wp.session_id IS NOT NULL
        AND public.can_see_session(wp.session_id)
    )
  );


-- ---------------------------------------------------------------------------
-- A challenge can have something on it (migration 047).
--
-- A stated stake, agreed between the people in it and settled between them.
-- Not money, and nothing the app holds or moves.
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_challenges
  ADD COLUMN IF NOT EXISTS wager text;

-- Long enough for "loser buys the coffees for a month", short enough that it
-- stays one readable line on a card.
ALTER TABLE public.group_challenges
  DROP CONSTRAINT IF EXISTS group_challenges_wager_len;
ALTER TABLE public.group_challenges
  ADD CONSTRAINT group_challenges_wager_len
  CHECK (wager IS NULL OR char_length(wager) <= 80);


-- ---------------------------------------------------------------------------
-- A streak that is real (migration 048).
--
-- profiles.current_streak was read in four places and written in none, so all
-- 49 members read as zero. Worked out at read time instead, from every kind of
-- showing up, in the viewer's own day frame.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_streaks(p_tz text DEFAULT 'UTC')
RETURNS TABLE (
  user_id uuid,
  current_streak integer,
  longest_streak integer,
  active_today boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH tz AS (
    -- An unknown timezone name would abort the whole query, and a wrong
    -- streak is better than a blank page.
    SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names n WHERE n.name = p_tz)
                THEN p_tz ELSE 'UTC' END AS name
  ), today AS (
    SELECT ((now() AT TIME ZONE (SELECT name FROM tz))::date) AS d
  ), days AS (
    -- Everything that counts as showing up, in the viewer's own day frame.
    -- The three tick tables already store a local date; only workout_logs
    -- carries a timestamp, so only it needs converting.
    SELECT l.user_id, ((l.created_at AT TIME ZONE (SELECT name FROM tz))::date) AS d
    FROM public.workout_logs l
    UNION
    SELECT c.user_id, c.date FROM public.workout_completions c WHERE c.date IS NOT NULL
    UNION
    SELECT h.user_id, h.date FROM public.habit_logs h WHERE h.date IS NOT NULL
    UNION
    SELECT t.user_id, t.date FROM public.challenge_task_logs t WHERE t.date IS NOT NULL
  ), numbered AS (
    -- Consecutive dates share (date - row_number), which is the cheapest way
    -- to find runs of days without a recursive walk.
    SELECT d2.user_id, d2.d,
           d2.d - (row_number() OVER (PARTITION BY d2.user_id ORDER BY d2.d))::int AS grp
    FROM (SELECT DISTINCT user_id, d FROM days) d2
  ), runs AS (
    SELECT n.user_id, count(*)::int AS len, max(n.d) AS last_day
    FROM numbered n GROUP BY n.user_id, n.grp
  )
  SELECT
    r.user_id,
    -- A run only counts as current if it reaches today or yesterday. Today
    -- not being done yet must not read as a broken streak -- the day isn't
    -- over.
    coalesce(max(r.len) FILTER (WHERE r.last_day >= (SELECT d FROM today) - 1), 0)::int,
    max(r.len)::int,
    bool_or(r.last_day = (SELECT d FROM today))
  FROM runs r
  GROUP BY r.user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.member_streaks(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_streaks(text) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- One daily list (migration 049).
--
-- The gym challenge carries no checklist of its own, so it is scored on each
-- member's personal daily habits -- one list, one set of records, two places
-- you can tick it from.
-- ---------------------------------------------------------------------------
DELETE FROM public.challenge_tasks t
USING public.group_challenges c
WHERE t.challenge_id = c.id
  AND c.is_official = true
  AND c.title = 'The Daily 3';

-- And stop making them for gyms that get one from here on.
CREATE OR REPLACE FUNCTION public.ensure_gym_challenge()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_gym  uuid;
  v_id   uuid;
begin
  if v_user is null then return null; end if;

  select gym_id into v_gym from public.profiles where id = v_user;
  if v_gym is null then return null; end if;

  select id into v_id
  from public.group_challenges
  where gym_id = v_gym and is_official = true and is_active = true
  limit 1;
  if v_id is not null then return v_id; end if;

  begin
    insert into public.group_challenges (
      title, description, start_date, length_days, strict,
      visibility, gym_vs_gym, is_official, gym_id, is_active, created_by
    ) values (
      'The Daily 3',
      'Your daily habits, every day, for thirty days. Your whole gym is in it.',
      current_date, 30, false,
      'gym', false, true, v_gym, true,
      null
    )
    returning id into v_id;
    -- No task list on purpose. With none of its own it is scored on each
    -- member's daily habits, so there is one place to tick and one set of
    -- records behind it.
  exception when unique_violation then
    select id into v_id
    from public.group_challenges
    where gym_id = v_gym and is_official = true and is_active = true
    limit 1;
  end;

  return v_id;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_gym_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_gym_challenge() TO authenticated, service_role;

-- The description on the gym challenges that already exist should match.
UPDATE public.group_challenges
SET description = 'Your daily habits, every day, for thirty days. Your whole gym is in it.'
WHERE is_official = true AND title = 'The Daily 3';
