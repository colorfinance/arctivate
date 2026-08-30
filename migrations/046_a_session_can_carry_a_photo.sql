-- A workout you can see but not picture.
--
-- Sessions reached the feed in 041 with their lifts, their PBs and their
-- numbers -- and nothing to look at. The one thing people already do on every
-- other fitness app is post the photo, and 20 workout photos had been uploaded
-- here already. They just had nowhere to go: workout_photos hangs off
-- daily_workout_id and its only policy is "auth.uid() = user_id", so every one
-- of those photos was visible to exactly one person.
--
-- So a photo can now belong to a session, and a photo on a session is seen by
-- whoever can see the session. can_see_session() already holds that rule --
-- owner always, gym only when the session is shared -- so a photo on a private
-- session stays private, and making a session private later takes its photo
-- back out of the feed with it. There is no second copy of the rule to drift.

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
