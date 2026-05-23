-- Sub-goal 25: extend age_bucket enum with 'none' for general-audience interpretation.
-- 'none' means "no youngest child / show general audience conditions".
-- Lazy AI generation treats it as a 6th bucket: same dedup pattern, different system-prompt framing.

-- Postgres requires a transaction to add an enum value
ALTER TYPE age_bucket ADD VALUE IF NOT EXISTS 'none';
