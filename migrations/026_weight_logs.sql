-- Migration 026: Weight history (weekly weigh-in)
-- Date: 2026-07-27
--
-- profiles.weight is a single value that gets overwritten on every edit, so
-- there was no history and no trend. Members already tick a "Weekly weigh-in"
-- habit that recorded no number at all — ticking it now captures the figure
-- here. One row per user/day (re-weighing the same day overwrites).

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default CURRENT_DATE,
  weight numeric not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON public.weight_logs(user_id, date DESC);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own weight logs" ON public.weight_logs;
CREATE POLICY "Users manage own weight logs"
  ON public.weight_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
