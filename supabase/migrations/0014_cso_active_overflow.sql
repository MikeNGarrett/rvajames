-- Sub-goal 93: persist EmNet's cso_active_overflow flag
-- Needed by sub-goals 94 (query split) and 95 (active-vs-residual banner)
-- to distinguish "currently discharging" from "past event under 48h advisory."

ALTER TABLE cso_outfalls
  ADD COLUMN current_overflow boolean,
  ADD COLUMN current_overflow_observed_at timestamptz;

COMMENT ON COLUMN cso_outfalls.current_overflow IS
  'EmNet cso_active_overflow flag at last ingest. NULL if not yet observed.';
COMMENT ON COLUMN cso_outfalls.current_overflow_observed_at IS
  'When current_overflow was last refreshed (== last_seen_at on most rows).';

CREATE INDEX idx_cso_outfalls_current_overflow
  ON cso_outfalls (current_overflow)
  WHERE current_overflow = true;
