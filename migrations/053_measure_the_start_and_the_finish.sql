-- Measure the start and the finish.
--
-- A challenge is thirty days of showing up. What members actually want to
-- know at the end is whether it did anything, and a streak count cannot tell
-- them. A tape measure can. So a challenge can carry a set of measurements
-- at the start and another at the finish, entered by the member, seen only
-- by the member, and compared on the finished card.
--
-- Every field is optional: the person who only owns bathroom scales still
-- gets a before and after.

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.group_challenges(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'checkin' CHECK (kind IN ('start', 'finish', 'checkin')),
  taken_on date NOT NULL DEFAULT current_date,
  weight_kg numeric(5,1) CHECK (weight_kg IS NULL OR (weight_kg > 20 AND weight_kg < 400)),
  waist_cm  numeric(5,1) CHECK (waist_cm  IS NULL OR (waist_cm  > 30 AND waist_cm  < 250)),
  chest_cm  numeric(5,1) CHECK (chest_cm  IS NULL OR (chest_cm  > 30 AND chest_cm  < 250)),
  hips_cm   numeric(5,1) CHECK (hips_cm   IS NULL OR (hips_cm   > 30 AND hips_cm   < 250)),
  arm_cm    numeric(5,1) CHECK (arm_cm    IS NULL OR (arm_cm    > 10 AND arm_cm    < 100)),
  thigh_cm  numeric(5,1) CHECK (thigh_cm  IS NULL OR (thigh_cm  > 20 AND thigh_cm  < 150)),
  note text CHECK (note IS NULL OR length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One start and one finish per member per challenge.
CREATE UNIQUE INDEX IF NOT EXISTS body_measurements_one_per_kind
  ON public.body_measurements (user_id, challenge_id, kind)
  WHERE challenge_id IS NOT NULL AND kind <> 'checkin';

CREATE INDEX IF NOT EXISTS body_measurements_user_idx ON public.body_measurements (user_id, taken_on);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Yours and only yours. Not the gym's, not the challenge's, not the rival's.
DROP POLICY IF EXISTS "Own measurements" ON public.body_measurements;
CREATE POLICY "Own measurements"
  ON public.body_measurements FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
