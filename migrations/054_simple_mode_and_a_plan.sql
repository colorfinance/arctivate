-- Simple mode, and a plan of your own.
--
-- Simple mode: one switch that hides everything that is not the day's
-- list, the workout and the challenge. Stored on the profile so it follows
-- the member between devices.
--
-- Plan: members in a gym are covered by the gym. A member with no gym can
-- pay for themselves. The plan lives on the profile; Stripe writes it
-- through the webhook and nothing on the client can set it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS simple_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'premium', 'past_due')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_key
  ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- A member may flip simple mode. The plan columns are the webhook's alone:
-- the existing "update own profile" policy would let a client set
-- plan = 'premium', so a trigger pins them unless the writer is the
-- service role.
CREATE OR REPLACE FUNCTION public.protect_plan_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND auth.uid() IS NOT NULL THEN
    NEW.plan := OLD.plan;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.plan_renews_at := OLD.plan_renews_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_plan_columns ON public.profiles;
CREATE TRIGGER protect_plan_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_plan_columns();
