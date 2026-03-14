-- Migration 015: Add marriage_order to families table
-- Supports polygamy: 1 person can be father/mother in multiple families
-- marriage_order = 1 (first/main spouse), 2 (second), etc.

ALTER TABLE families ADD COLUMN IF NOT EXISTS marriage_order INT NOT NULL DEFAULT 1;

-- Index for fast sort when fetching families by father or mother
CREATE INDEX IF NOT EXISTS idx_families_marriage_order_f ON families (father_handle, marriage_order);
CREATE INDEX IF NOT EXISTS idx_families_marriage_order_m ON families (mother_handle, marriage_order);
