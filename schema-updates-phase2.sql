-- Arctivate Phase 2 Schema Updates (PostgreSQL/Supabase)
-- Author: Sirg
-- Date: 2026-02-07

-- ========================================== --
-- TASK 1: UPDATE PROFILES TABLE FOR ONBOARDING
-- ========================================== --

-- Add onboarding columns to the profiles table
-- These columns store the biometric and goal data collected during onboarding.

DO $$
BEGIN
    -- Add 'age' column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'age') THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER;
    END IF;

    -- Add 'weight' column (kg)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'weight') THEN
        ALTER TABLE public.profiles ADD COLUMN weight DECIMAL(5,2);
    END IF;

    -- Add 'gender' column (text, e.g., 'male', 'female', 'other')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE public.profiles ADD COLUMN gender TEXT;
    END IF;

    -- Add 'goal' column (text, e.g., 'Lose Fat', 'Gain Muscle')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'goal') THEN
        ALTER TABLE public.profiles ADD COLUMN goal TEXT;
    END IF;

    -- Add 'fitness_level' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'fitness_level') THEN
        ALTER TABLE public.profiles ADD COLUMN fitness_level TEXT; -- e.g., 'Beginner', 'Intermediate', 'Advanced'
    END IF;

    -- Add 'completed_onboarding' flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'completed_onboarding') THEN
        ALTER TABLE public.profiles ADD COLUMN completed_onboarding BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ========================================== --
-- TASK 2: ENSURE ROW LEVEL SECURITY (RLS)
-- ========================================== --

-- Enable RLS on the profiles table (already created in Phase 1)
-- Note: In production, ensure RLS is enabled via Supabase Dashboard or CLI if not auto-enabled.

-- POLICY: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- POLICY: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Ensure RLS is enabled (Syntax check only, usually done in Dashboard)
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================================== --
-- TASK 3: OLD CHALLENGE COLUMNS (Cleanup)
-- ========================================== --
-- The 'habits.js' logic implies challenge fields (challenge_start_date, challenge_days_goal).
-- Let's ensure they exist officially.

DO $$
BEGIN
    -- Add 'challenge_start_date' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'challenge_start_date') THEN
        ALTER TABLE public.profiles ADD COLUMN challenge_start_date TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add 'challenge_days_goal' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'challenge_days_goal') THEN
        ALTER TABLE public.profiles ADD COLUMN challenge_days_goal INTEGER DEFAULT 75;
    END IF;
END $$;