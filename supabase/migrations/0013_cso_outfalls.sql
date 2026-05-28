-- ─── 0013: cso_outfalls catalog table + advisories.outfall_id FK ─────────────
--
-- Foundation for the EmNet CSO ingest (sub-goal 82).
--
-- cso_outfalls: static catalog of Richmond CSO monitoring + modeled sites
-- sourced from the public EmNet map (apps.emnet.net/richmond-pub-map-app).
-- The ingest upserts on emnet_id and refreshes last_seen_at on each run.
-- Rarely changes; outfall positions and names shift only when DPU adds or
-- retires a monitoring site.
--
-- advisories.outfall_id: nullable FK to cso_outfalls.id. Set on CSO advisory
-- rows (source='emnet_cso') so per-location upstream queries can join to
-- outfall lat/lng without a separate lookup. NULL on all other advisory rows.

-- ── 1. Outfall catalog ────────────────────────────────────────────────────

CREATE TABLE cso_outfalls (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  emnet_id              text         UNIQUE NOT NULL,          -- site UUID from emnet config
  name                  text         NOT NULL,                 -- display name from emnet
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  bodies                text[]       NOT NULL DEFAULT '{}',    -- affected water body names
  site_type             text         NOT NULL,                 -- 'monitored' | 'modeled'
  affects_james_mainstem boolean     NOT NULL DEFAULT false,   -- derived from bodies at ingest
  last_seen_at          timestamptz  NOT NULL DEFAULT now(),   -- updated each successful run
  created_at            timestamptz  NOT NULL DEFAULT now()
);

-- Fast lookup by emnet UUID (primary dedup key for upsert)
CREATE INDEX cso_outfalls_emnet_id_idx ON cso_outfalls (emnet_id);

-- Supports upstream-of-location queries:
-- WHERE affects_james_mainstem = true AND lng < :location_lng
CREATE INDEX cso_outfalls_lng_mainstem_idx ON cso_outfalls (lng)
  WHERE affects_james_mainstem;

-- ── 2. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE cso_outfalls ENABLE ROW LEVEL SECURITY;

-- Anon read: same pattern as locations and other public tables
CREATE POLICY "Public read access" ON cso_outfalls
  FOR SELECT TO anon
  USING (true);

-- Service role bypasses RLS — no write policy needed.

-- ── 3. agent_reader grant ─────────────────────────────────────────────────

-- The agent_reader Postgres role (SELECT-only) needs an explicit grant on
-- new tables — it does not inherit from future grants automatically.
-- Conditional: the role exists in production but not in local Supabase dev.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_reader') THEN
    GRANT SELECT ON cso_outfalls TO agent_reader;
  END IF;
END $$;

-- ── 4. advisories FK ─────────────────────────────────────────────────────

-- Nullable FK: NULL for all non-CSO advisory rows. Set for source='emnet_cso'
-- rows so upstream queries can join without a separate catalog lookup.
ALTER TABLE advisories
  ADD COLUMN outfall_id uuid REFERENCES cso_outfalls(id);

-- Partial index: only rows that have an outfall linked — typically just CSO rows
CREATE INDEX advisories_outfall_id_idx ON advisories (outfall_id)
  WHERE outfall_id IS NOT NULL;
