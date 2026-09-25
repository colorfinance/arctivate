-- The gym pays.
--
-- 052 gave a gym a plan (pilot, paid, lapsed) and a 30-day pilot, but no way
-- to get from pilot to paid. This adds the billing side: two tiers, a place
-- for Stripe's ids that members cannot read, and a lock so the plan is set
-- by the webhook (or an admin comping a gym), never by the owner's client.
--
-- Tiers: 'gym' is $149 a month for up to 200 members, 'gym_large' is $299
-- for up to 500. A gym whose card fails is 'past_due' and keeps everything
-- while the owner fixes it; a cancelled gym is 'lapsed'.

ALTER TABLE public.gyms DROP CONSTRAINT IF EXISTS gyms_plan_check;
ALTER TABLE public.gyms
  ADD CONSTRAINT gyms_plan_check CHECK (plan IN ('pilot', 'paid', 'past_due', 'lapsed')),
  ADD COLUMN IF NOT EXISTS plan_tier text CHECK (plan_tier IN ('gym', 'gym_large'));

-- Gyms are readable by everyone (the leaderboard needs the name), so the
-- Stripe ids live in their own table that only the gym's staff can read and
-- only the service role can write.
CREATE TABLE IF NOT EXISTS public.gym_billing (
  gym_id uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  renews_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff see their gym's billing" ON public.gym_billing;
CREATE POLICY "Staff see their gym's billing"
  ON public.gym_billing FOR SELECT TO authenticated
  USING (public.is_gym_staff(gym_id));

REVOKE INSERT, UPDATE, DELETE ON public.gym_billing FROM anon, authenticated;

-- "Staff update their gym" lets an owner rename the gym, and without this it
-- would also let them write plan = 'paid'. The billing columns keep their old
-- values unless the writer is the service role or an admin.
CREATE OR REPLACE FUNCTION public.protect_gym_plan()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
    NEW.plan := OLD.plan;
    NEW.plan_tier := OLD.plan_tier;
    NEW.pilot_ends_at := OLD.pilot_ends_at;
    NEW.join_code := OLD.join_code;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_gym_plan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_gym_plan ON public.gyms;
CREATE TRIGGER protect_gym_plan
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.protect_gym_plan();
