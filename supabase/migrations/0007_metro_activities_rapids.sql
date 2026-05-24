-- Sub-goal 29: add structured activity grid + rapids class columns to metro_summaries.
-- These columns are NULL for all pre-b2 rows; the app handles NULL gracefully (no grid rendered).

alter table public.metro_summaries
  add column if not exists activities   jsonb null,
  add column if not exists rapids_class text  null,
  add column if not exists rapids_note  text  null;

-- Optional: remove pre-b2 rows so they don't occupy storage.
-- They are already orphaned by the prompt_version bump in sub-goal 31 and will never
-- be served from cache. Un-comment if you want to purge them immediately.
-- delete from public.metro_summaries where created_at < now();
