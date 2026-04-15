-- Migration 008: voice memos on workout logs + avatars storage bucket
--
-- Apply in Supabase SQL Editor. Idempotent.

-- 1. Add voice_memo_url column to workout_logs (used by train.js handleVoiceMemoSaved)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_logs'
      and column_name = 'voice_memo_url'
  ) then
    alter table public.workout_logs add column voice_memo_url text;
  end if;
end $$;

-- 2. Create the voice-memos storage bucket for audio uploads (used by
-- components/train/VoiceMemo.js). Safe to re-run.
insert into storage.buckets (id, name, public)
values ('voice-memos', 'voice-memos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder under voice-memos.
drop policy if exists "Users can upload voice memos" on storage.objects;
create policy "Users can upload voice memos"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-memos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Voice memos are publicly readable" on storage.objects;
create policy "Voice memos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'voice-memos');

-- 3. Create the avatars bucket used by the profile photo picker
-- (pages/profile.js handleAvatarPick).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
