-- Arctivate Phase 1 Schema (PostgreSQL/Supabase)

-- 1. USERS & PROFILE
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  bio text,
  total_points bigint default 0,
  current_streak int default 0,
  avatar_url text,
  partner_id uuid, -- B2B partner link (FK added after partners table)
  challenge_start_date timestamptz default now(),
  challenge_days_goal int default 75,
  created_at timestamptz default now()
);

-- 2. HABITS (The definitions)
create table public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  title text not null, -- e.g. "No Sugar"
  description text,
  points_reward int default 10,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. HABIT LOGS (Daily execution)
create table public.habit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  habit_id uuid references public.habits(id),
  completed_at timestamptz default now(),
  date date default CURRENT_DATE
);

-- 4. EXERCISES & PBs
create table public.exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  name text not null, -- "Bench Press", "5km Run"
  metric_type text check (metric_type in ('weight', 'time', 'reps', 'distance')),
  muscle_group text,
  is_benchmark boolean default false -- If true, highlights in Trophy Room
);

create table public.personal_bests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  exercise_id uuid references public.exercises(id),
  value numeric not null, -- The weight/time/rep count
  achieved_at timestamptz default now()
);

-- 5. WORKOUT LOGS
create table public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  exercise_id uuid references public.exercises(id),
  value numeric not null,
  sets int,
  reps int,
  rpe int,
  notes text,
  is_new_pb boolean default false,
  points_awarded int default 0,
  created_at timestamptz default now()
);

-- 6. PARTNER CHECK-INS (Geo/QR)
create table public.partners (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- "Record Recovery"
  location_lat float,
  location_long float,
  qr_uuid uuid unique default gen_random_uuid()
);

create table public.check_ins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  partner_id uuid references public.partners(id),
  awarded_points int default 150,
  checked_in_at timestamptz default now()
);

-- 7. NUTRITION
create table public.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  item_name text,
  calories int,
  macros jsonb, -- { "protein": 20, "carbs": 50, "fat": 10 }
  barcode text,
  eaten_at timestamptz default now()
);

-- 8. PUBLIC FEED (Social Sharing)
create table public.public_feed (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_data jsonb not null,
  -- { "exercise_name": "...", "value": 100, "metric_type": "weight", "is_new_pb": true, "points_earned": 150, "date": "..." }
  created_at timestamptz default now() not null,
  likes_count int default 0 not null
);

-- 9. HIGH FIVES (Likes for Public Feed)
create table public.high_fives (
  id uuid default gen_random_uuid() primary key,
  feed_id uuid references public.public_feed(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(feed_id, user_id)
);

-- 10. REWARDS LEDGER (QR Code Redemption)
create table public.rewards_ledger (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  code_type text not null check (code_type in ('points', 'partner')),
  points_value int default 0,
  partner_id uuid references public.partners(id),
  is_used boolean default false,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  description text,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);
