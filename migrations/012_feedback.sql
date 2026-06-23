-- Migration 012: In-app user feedback
-- Date: 2026-06-23
--
-- Users submit feedback from inside the app; admins review all of it to
-- improve the product. RLS: a user sees only their own submissions, admins
-- see everything and can update the status.

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  category text not null default 'general'
    check (category in ('general', 'bug', 'feature', 'praise', 'other')),
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can submit their own feedback.
DROP POLICY IF EXISTS "Users can submit feedback" ON public.feedback;
CREATE POLICY "Users can submit feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can read their own feedback; admins can read all.
DROP POLICY IF EXISTS "Read own or all feedback" ON public.feedback;
CREATE POLICY "Read own or all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update feedback (e.g. mark reviewed / resolved).
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
