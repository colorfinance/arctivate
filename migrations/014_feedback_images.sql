-- Migration 014: Screenshots on feedback
-- Date: 2026-06-25
--
-- Lets users attach a screenshot to their feedback so admins can see the
-- issue. Uses a public bucket (per-user folders) so admins can view any
-- submitter's screenshot; paths contain an unguessable timestamp.

-- 1. Column on feedback for the screenshot URL.
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Storage bucket for the screenshots.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload into their own folder.
DROP POLICY IF EXISTS "Users can upload feedback images" ON storage.objects;
CREATE POLICY "Users can upload feedback images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can read (bucket is public; needed so admins can view screenshots).
DROP POLICY IF EXISTS "Feedback images are publicly readable" ON storage.objects;
CREATE POLICY "Feedback images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-images');

-- Users can delete their own uploads.
DROP POLICY IF EXISTS "Users can delete own feedback images" ON storage.objects;
CREATE POLICY "Users can delete own feedback images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
