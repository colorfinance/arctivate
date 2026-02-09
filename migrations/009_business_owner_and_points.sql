-- Migration 009: Business owner tracking and add_points RPC
-- Allows any user to list their business and tracks ownership

-- 1. Add owner_id column to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- 2. Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_partners_owner_id ON public.partners(owner_id);

-- 3. Allow authenticated users to insert into partners (list their business)
DROP POLICY IF EXISTS "Authenticated users can create partners" ON public.partners;
CREATE POLICY "Authenticated users can create partners"
  ON public.partners FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Allow users to delete their own businesses
DROP POLICY IF EXISTS "Users can delete own partners" ON public.partners;
CREATE POLICY "Users can delete own partners"
  ON public.partners FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 5. Allow everyone to read partners (business directory)
DROP POLICY IF EXISTS "Anyone can view partners" ON public.partners;
CREATE POLICY "Anyone can view partners"
  ON public.partners FOR SELECT
  USING (true);

-- 6. Create add_points RPC function
CREATE OR REPLACE FUNCTION public.add_points(p_user_id uuid, p_points int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET total_points = COALESCE(total_points, 0) + p_points
  WHERE id = p_user_id;
END;
$$;
