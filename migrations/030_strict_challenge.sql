-- Migration 030: Strict challenge mode (75 Hard style)
-- Date: 2026-08-15
--
-- Opt-in per member: miss a day of your daily habits and the challenge
-- restarts at Day 1 automatically. Off by default, so nothing changes for
-- anyone who doesn't deliberately turn it on.
--
-- strict_last_checked stops the check re-running all day and lets it only
-- look at days it hasn't already judged.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strict_challenge boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strict_last_checked date;
