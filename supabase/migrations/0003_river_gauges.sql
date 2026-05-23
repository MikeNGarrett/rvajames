-- Sub-goal 23: two-gauge ingestion + metro river segment
-- Adds a `kind` column to locations so gauge rows are distinct from access points.

-- ─── New enum ─────────────────────────────────────────────────────────────────

CREATE TYPE location_kind AS ENUM ('gauge', 'access_point');

-- ─── Extend locations ─────────────────────────────────────────────────────────

ALTER TABLE public.locations
  ADD COLUMN kind location_kind NOT NULL DEFAULT 'access_point';

-- Existing 9 rows are already 'access_point' by default — nothing to backfill.

-- ─── Insert the two USGS gauge stations ───────────────────────────────────────
-- 02037500: James River at Westham, VA  (upriver reference gauge)
-- 02037705: James River at Richmond, VA (downriver / fall-line gauge)

INSERT INTO public.locations (slug, name, lat, lng, usgs_station_id, kind, tags)
VALUES
  ('usgs-02037500',
   'USGS Gage 02037500 — Westham (upriver)',
   37.562900, -77.541200,
   '02037500',
   'gauge',
   ARRAY['gauge']),

  ('usgs-02037705',
   'USGS Gage 02037705 — Richmond Locks (downriver)',
   37.526500, -77.440500,
   '02037705',
   'gauge',
   ARRAY['gauge']);

-- ─── RLS: keep existing anon_read policy covering new rows ────────────────────
-- The 0002_rls.sql policy "FOR SELECT TO anon USING (true)" already covers
-- all rows in public.locations including these new ones. No additional policy needed.
