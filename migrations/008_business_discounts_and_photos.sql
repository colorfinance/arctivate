-- Migration: Business Discounts & Progress Photos
-- Adds discount support for partner businesses and progress photo storage

-- ===========================================
-- 1. ADD DISCOUNT AND POINTS COLUMNS TO PARTNERS
-- ===========================================
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS discount_text text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS points_value int default 150;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS description text;

-- ===========================================
-- 2. CREATE STORAGE BUCKET FOR PROGRESS PHOTOS
-- ===========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for progress-photos bucket
DROP POLICY IF EXISTS "Anyone can view progress photos" ON storage.objects;
CREATE POLICY "Anyone can view progress photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "Users can upload own progress photos" ON storage.objects;
CREATE POLICY "Users can upload own progress photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own progress photos" ON storage.objects;
CREATE POLICY "Users can delete own progress photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
