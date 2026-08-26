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
