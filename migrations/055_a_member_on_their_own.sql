-- A member on their own.
--
-- Since 035 every sign-up landed in the house gym, which made the one gym
-- look like the whole world and meant nobody could ever be an individual
-- on their own plan. Now a sign-up starts with no gym. A gym's members
-- arrive by invite or by the code on the wall; everyone else is a member
-- on their own, free or on Premium.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, gym_id, username)
  VALUES (new.id, NULL, nullif(btrim(coalesce(new.raw_user_meta_data->>'username', '')), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
