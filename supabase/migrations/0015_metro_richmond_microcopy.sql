-- Richmond 89: extend metro_summaries with richmond_microcopy
--
-- Adds a nullable text column to hold the 1–2 sentence AI-generated
-- microcopy that accompanies the deterministic headline in the new
-- Richmond Conditions section (component built in sub-goal 88).
--
-- Why nullable
--   Pre-b3 cached rows have no richmond_microcopy. Making the column
--   NOT NULL would invalidate every legacy row. Nullable + the
--   PROMPT_VERSION='b3' hash bump in summarize-metro.ts naturally
--   orphans those rows (different hash) so they regenerate on first
--   request — the new rows include the microcopy.
--
-- Why no separate index
--   Lookups by (date, age_bucket, prompt_hash) are unchanged; the
--   existing composite index covers all read paths. richmond_microcopy
--   is read-only output, never a query predicate.
--
-- Apply with
--   pnpm exec supabase db push  (local)
--   USER applies to production via Supabase Studio — agent has
--   read-only DB access by security constraint.

ALTER TABLE metro_summaries
  ADD COLUMN IF NOT EXISTS richmond_microcopy text NULL;

COMMENT ON COLUMN metro_summaries.richmond_microcopy IS
  '1-2 sentence AI-generated microcopy for the Richmond Conditions section. '
  'Generated alongside body_md; same prompt, same cache row, single AI call.';
