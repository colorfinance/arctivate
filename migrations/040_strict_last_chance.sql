-- Strict mode used to reset you to Day 1 the moment it found a settled day
-- with an unticked habit. A member on strict mode reported going back to Day 1
-- over and over, and said the honest reason was often that she had done the
-- work and forgotten to tick it -- not that she had missed the day.
--
-- The app cannot know which of those happened. It can ask. This column tracks
-- how many times a member has taken the one "last chance" they get per run, so
-- asking cannot turn strict mode into no mode. It is reset to 0 whenever the
-- challenge restarts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strict_saves_used integer NOT NULL DEFAULT 0;
