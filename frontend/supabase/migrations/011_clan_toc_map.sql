-- Migration 011: Add clan_toc_map JSONB column to people table
-- Stores per-clan toc_type overrides, e.g. {"pham": "chinh", "ngo": "ngoai"}
-- Replaces single global toc_type for manual override UI

ALTER TABLE people ADD COLUMN IF NOT EXISTS clan_toc_map JSONB DEFAULT '{}';

COMMENT ON COLUMN people.clan_toc_map IS
    'Per-clan toc_type manual override map. Keys = clan handles, values = chinh|than|ngoai. '
    'Empty map means use auto-computed toc_type. toc_override=true is set when any entry exists.';
