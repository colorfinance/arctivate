-- Migration 023: Training notes (one free-text note per day per user)
-- Date: 2026-07-21

CREATE TABLE IF NOT EXISTS public.training_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default CURRENT_DATE,
  body text,
  updated_at timestamptz default now(),
  unique (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_training_notes_user_date ON public.training_notes(user_id, date DESC);

ALTER TABLE public.training_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own training notes" ON public.training_notes;
CREATE POLICY "Users manage own training notes"
  ON public.training_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
