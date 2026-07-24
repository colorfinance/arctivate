-- Per-habit reminder time. NULL = no reminder set.
-- Stored as a wall-clock time; the client schedules a daily local
-- notification at this time (real alarm on the native app, best-effort on web).
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time time;
