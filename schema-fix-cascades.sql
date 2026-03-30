-- Run this in Supabase SQL Editor to fix foreign key cascades.
-- This allows users to be deleted without foreign key errors.

-- First, delete ALL existing user data that might block the migration
-- (Skip this section if you want to keep existing data)

-- Fix habits table
ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_user_id_fkey;
ALTER TABLE public.habits ADD CONSTRAINT habits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix habit_logs table
ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_user_id_fkey;
ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_habit_id_fkey;
ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_habit_id_fkey
  FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;

-- Fix exercises table
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_user_id_fkey;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix personal_bests table
ALTER TABLE public.personal_bests DROP CONSTRAINT IF EXISTS personal_bests_user_id_fkey;
ALTER TABLE public.personal_bests ADD CONSTRAINT personal_bests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.personal_bests DROP CONSTRAINT IF EXISTS personal_bests_exercise_id_fkey;
ALTER TABLE public.personal_bests ADD CONSTRAINT personal_bests_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

-- Fix workout_logs table
ALTER TABLE public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey;
ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_exercise_id_fkey;
ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

-- Fix check_ins table
ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS check_ins_user_id_fkey;
ALTER TABLE public.check_ins ADD CONSTRAINT check_ins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix food_logs table
ALTER TABLE public.food_logs DROP CONSTRAINT IF EXISTS food_logs_user_id_fkey;
ALTER TABLE public.food_logs ADD CONSTRAINT food_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix rewards_ledger table
ALTER TABLE public.rewards_ledger DROP CONSTRAINT IF EXISTS rewards_ledger_used_by_fkey;
ALTER TABLE public.rewards_ledger ADD CONSTRAINT rewards_ledger_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix profiles table (cascade from auth.users)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
