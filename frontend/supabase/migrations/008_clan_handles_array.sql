-- Migration 008: Add clan_handles TEXT[] to people
-- Allows a person to appear in multiple clan trees simultaneously.
-- clan_handle (single FK) is kept as the PRIMARY clan for backward compat.
-- clan_handles (array) is the source of truth for multi-clan filtering.

-- 1. Add clan_handles column
ALTER TABLE people
    ADD COLUMN IF NOT EXISTS clan_handles TEXT[] DEFAULT '{}';

-- 2. Populate from existing clan_handle
UPDATE people
SET clan_handles = ARRAY[clan_handle]
WHERE clan_handle IS NOT NULL
  AND (clan_handles IS NULL OR clan_handles = '{}');

-- 3. Index for fast array-contains queries
CREATE INDEX IF NOT EXISTS idx_people_clan_handles ON people USING GIN (clan_handles);
