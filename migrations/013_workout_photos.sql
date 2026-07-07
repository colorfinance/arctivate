-- Migration 013: Private workout photos
-- Date: 2026-06-24
--
-- Users can snap/upload a photo of their workout in the Train section. Photos
-- are PRIVATE — stored in a non-public bucket with owner-only policies and a
-- table protected by RLS, so only the uploader can ever see them.

-- ========================================== --
-- 1. TABLE
-- ========================================== --
CREATE TABLE IF NOT EXISTS public.workout_photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  storage_path text not null,      -- object path within the workout-photos bucket
  caption text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_workout_photos_user ON public.workout_photos(user_id, created_at DESC);

ALTER TABLE public.workout_photos ENABLE ROW LEVEL SECURITY;

-- Owner-only: a user can only ever see/insert/delete their own rows.
DROP POLICY IF EXISTS "Users manage own workout photos" ON public.workout_photos;
CREATE POLICY "Users manage own workout photos"
  ON public.workout_photos FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================== --
-- 2. PRIVATE STORAGE BUCKET
-- ========================================== --
-- public = false, so images are only reachable via short-lived signed URLs
-- that the app generates for the owner.
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-photos', 'workout-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only storage policies (first path segment must be the user's id).
DROP POLICY IF EXISTS "Users can upload own workout photos" ON storage.objects;
CREATE POLICY "Users can upload own workout photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'workout-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can read own workout photos" ON storage.objects;
CREATE POLICY "Users can read own workout photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'workout-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own workout photos" ON storage.objects;
CREATE POLICY "Users can delete own workout photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'workout-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
