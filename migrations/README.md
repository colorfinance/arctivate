# Migrations

## Rebuilding the database from nothing

Run **`000_baseline_schema.sql`** and nothing else. It is the complete current
schema: tables, keys, indexes, functions, triggers, RLS policies, storage
buckets and the seed rows the app needs to work (the Arctivate gym that
`handle_new_user` looks up, and the badge catalogue).

It is idempotent — running it against a database that already matches changes
nothing — so it is also safe to apply to production as a no-op.

Supabase provides the `auth` and `storage` schemas, the `anon` /
`authenticated` / `service_role` roles and `auth.uid()`. On a brand-new
Supabase project those already exist. On plain Postgres you have to stand them
in yourself.

## The numbered migrations

`001`–`036` are **history**. They record how the schema got here and are kept
for the record. Do not replay them on top of the baseline.

`037` onwards are applied on top of the baseline, and their objects are also
folded into `000` so a fresh rebuild still matches production. `041` is the
exception worth knowing about: the baseline carries its tables and policies but
deliberately not its history backfill, because a new database has no logs to
convert.

## After changing the schema

Regenerate the baseline by introspecting production rather than hand-editing
it, then prove it: apply it to an empty database and compare column, policy
and constraint fingerprints against production. They should be identical.

Two things are easy to miss when regenerating, because they are neither plain
indexes nor table constraints:

- partial UNIQUE indexes (`idx_training_notes_day`, `idx_training_notes_workout`)
- the `on_auth_user_created` trigger on `auth.users`, which lives outside `public`
- the member-facing foreign keys point at `public.profiles`, not `auth.users`.
  PostgREST resolves embeds like `profiles:user_id (...)` from the foreign key,
  so one pointing at `auth.users` silently fails the whole query.
