-- Migration: Add biography column to people table
-- Run this in: Supabase Dashboard → SQL Editor
-- After running, uncomment the biography line in src/lib/supabase-data.ts

ALTER TABLE people
    ADD COLUMN IF NOT EXISTS biography TEXT;
