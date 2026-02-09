-- Migration: Meal Sharing & Storage Setup
-- Adds support for meal sharing to feed and image message types

-- ===========================================
-- 1. UPDATE MESSAGE TYPE CHECK CONSTRAINT
-- ===========================================
-- Allow 'image' and 'meal' message types in community_messages
alter table public.community_messages drop constraint if exists community_messages_message_type_check;
alter table public.community_messages add constraint community_messages_message_type_check
  check (message_type in ('text', 'workout', 'achievement', 'milestone', 'image', 'meal'));

-- ===========================================
-- 2. ADD IMAGE_URL TO COMMUNITY_MESSAGES (if not already added by 006)
-- ===========================================
alter table public.community_messages add column if not exists image_url text;

-- ===========================================
-- 3. CREATE STORAGE BUCKET FOR POST IMAGES
-- ===========================================
-- Run this in the Supabase Dashboard > Storage > Create bucket:
-- Name: post-images
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- If using SQL:
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies for post-images bucket
create policy "Anyone can view post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Authenticated users can upload post images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "Users can delete own post images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
