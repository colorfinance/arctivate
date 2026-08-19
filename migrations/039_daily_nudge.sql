-- One daily nudge, and reminders that can actually reach someone.
--
-- Context: 422 habits existed in this database and not one had a reminder set.
-- The reason was mechanical -- daily habits had no reminder control in the UI
-- at all -- but the fix is not to give all five preset habits their own alarm.
-- Five notifications a day is how you get a member to switch notifications off
-- for good. So: one nudge per day, at a time the member controls.
--
-- Nothing here can send anything on its own. The alarm is scheduled on-device
-- by the Capacitor shell and only fires once the member grants notification
-- permission, so backfilling a default time is inert until they opt in.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_reminder_time time;

-- Give everyone a sensible default rather than leaving it null, so the nudge is
-- on by default for anyone who allows notifications. Null means "off", which is
-- what turning it off writes.
UPDATE public.profiles
   SET daily_reminder_time = '07:00'::time
 WHERE daily_reminder_time IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN daily_reminder_time SET DEFAULT '07:00'::time;

-- profiles carries a table-level UPDATE grant for `authenticated` (RLS is what
-- keeps a member to their own row), so the new column needs no extra grant.
