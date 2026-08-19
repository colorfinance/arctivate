-- Any signed-in member could mint themselves reward codes.
--
-- rewards_ledger and partners both carried blanket "Enable <action> for
-- authenticated users" policies from early in the project, checking only
-- auth.role() = 'authenticated'. The admin-only policies that were added later
-- sit alongside them, and RLS is permissive: passing ANY policy is enough. So
-- the strict ones never actually restricted anything.
--
-- Verified against production: an ordinary member inserted a reward code worth
-- 100,000 points (removed immediately). They could then redeem it. The same
-- shape let a member create partner venues, each good for a 150-point check-in.
--
-- The app already treats both as admin-only in the UI — the reward list and the
-- partner form are behind `isAdmin` — so this brings the database in line with
-- what the interface already assumes.
--
-- Redemption is unaffected: redeem_code() is SECURITY DEFINER and bypasses RLS.

-- --- rewards_ledger ---------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.rewards_ledger;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.rewards_ledger;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.rewards_ledger;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.rewards_ledger;

-- An unredeemed code is a bearer token: whoever reads it can spend it. Members
-- see only what they have already redeemed; admins see the lot.
DROP POLICY IF EXISTS "Anyone can view reward codes" ON public.rewards_ledger;
DROP POLICY IF EXISTS "See own redemptions or all as admin" ON public.rewards_ledger;
CREATE POLICY "See own redemptions or all as admin"
  ON public.rewards_ledger FOR SELECT TO authenticated
  USING (
    used_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- --- partners ---------------------------------------------------------------

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.partners;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.partners;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can create partners" ON public.partners;

DROP POLICY IF EXISTS "Admins create partners" ON public.partners;
CREATE POLICY "Admins create partners"
  ON public.partners FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins update partners" ON public.partners;
CREATE POLICY "Admins update partners"
  ON public.partners FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Redundant duplicate: "Anyone can view partners" already permits every read,
-- so this second permissive SELECT policy only added planner overhead.
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.partners;

-- "Anyone can view partners" and "Users can delete own partners" stay: members
-- need to see participating venues, and the owner/admin delete rule is already
-- scoped.
