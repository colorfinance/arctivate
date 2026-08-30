-- Nothing was ever on the line.
--
-- A challenge here has been an agreement to both tick a checklist, and the
-- only thing at stake is a number in a standings table. That is fine for
-- someone already motivated, which is not the person this feature has to
-- reach: 49 members, and one of them had ever joined a challenge.
--
-- A wager is the oldest fix for that. This is deliberately NOT money and NOT
-- a betting mechanism -- it is a line of text the two of you agree on and
-- settle between yourselves, the way people already do at a gym. "Loser buys
-- coffee". The app records it, shows it on the challenge and in the invite so
-- nobody can pretend they didn't agree, and names the winner at the end. It
-- moves nothing and holds nothing.
--
-- Deliberately not points, either: points are still asserted by the client
-- (increment_points takes the amount as an argument), so a points wager would
-- be trivially cheatable and would put a real prize behind a broken lock.

ALTER TABLE public.group_challenges
  ADD COLUMN IF NOT EXISTS wager text;

-- Long enough for "loser buys the coffees for a month", short enough that it
-- stays one readable line on a card.
ALTER TABLE public.group_challenges
  DROP CONSTRAINT IF EXISTS group_challenges_wager_len;
ALTER TABLE public.group_challenges
  ADD CONSTRAINT group_challenges_wager_len
  CHECK (wager IS NULL OR char_length(wager) <= 80);
