-- ─── 0012: add source_id column to advisories ────────────────────────────────
--
-- Structural fix for the NWS blind-insert problem (hotfix 8f65cdd).
--
-- Problem: the advisories table had no column for upstream-supplied alert IDs.
-- All three ingest paths (NWS, CSO, JRA) used heuristic or composite-source
-- dedup that could fail on real "alert updated" events.
--
-- This migration:
--   1. Adds source_id text NULL — upstream-supplied natural key per source system.
--   2. Creates a partial UNIQUE index on (source, source_id) WHERE source_id IS
--      NOT NULL — enforces dedup for new rows without breaking legacy rows.
--   3. One-time cleanup: removes duplicate rows created by the NWS blind-insert
--      pattern, keeping the oldest row for each (source, kind, headline,
--      effective_from) group.
--
-- After this migration the three ingest paths upsert on (source, source_id):
--   NWS: source_id = alert.properties.id  (NWS-supplied URN)
--   CSO: source_id = hashToHex16(headline + effectiveFrom)
--   JRA: source  = 'jra_water_quality', source_id = 'J23:2026-05-22'

ALTER TABLE advisories ADD COLUMN source_id text NULL;

-- Partial unique index: only rows with source_id are deduplicated by it.
-- Legacy rows (source_id IS NULL) are excluded from the unique constraint and
-- will continue to coexist until they expire naturally.
CREATE UNIQUE INDEX advisories_source_source_id_uniq
  ON advisories (source, source_id)
  WHERE source_id IS NOT NULL;

-- One-time dedup: delete the newer duplicate for each heuristic-key group.
-- The oldest row (smallest created_at) is kept; newer duplicates are removed.
-- This must run before the UNIQUE index is populated with new rows so the
-- constraint does not immediately conflict with existing data.
DELETE FROM advisories a
USING advisories b
WHERE a.created_at > b.created_at
  AND a.source         = b.source
  AND a.kind           = b.kind
  AND a.headline       = b.headline
  AND a.effective_from IS NOT DISTINCT FROM b.effective_from;
