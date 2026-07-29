-- Migration 028: Track preset-habit seeding on the profile
-- Date: 2026-07-28
--
-- Seeding was guarded by a localStorage flag, which is per-device. Deleting a
-- preset habit on one device and opening the app on another (or in the native
-- shell, which has its own storage) re-seeded the whole preset list — so
-- deleted habits kept coming back. Tracking it on the profile makes the guard
-- durable and shared across every device.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presets_seeded_for timestamptz;

-- Backfill everyone who has already started a challenge, so nobody gets a
-- fresh re-seed the first time they open the app after this ships.
UPDATE public.profiles
SET presets_seeded_for = challenge_start_date
WHERE challenge_start_date IS NOT NULL
  AND presets_seeded_for IS NULL;
