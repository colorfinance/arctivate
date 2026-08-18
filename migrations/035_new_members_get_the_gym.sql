-- New signups were created with no gym. The default challenge visibility is
-- 'gym', and that rule treats a NULL gym as "visible to everyone" — so the
-- first new member to create a challenge would broadcast it while the UI
-- told them only their gym could see it.
--
-- There is one gym today, so a new member belongs to it until choosing a gym
-- becomes part of onboarding.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, gym_id)
  VALUES (new.id, (SELECT id FROM public.gyms WHERE slug = 'arctivate'));
  RETURN new;
END;
$$;

-- Anyone who slipped through since launch.
UPDATE public.profiles
SET gym_id = (SELECT id FROM public.gyms WHERE slug = 'arctivate')
WHERE gym_id IS NULL;
