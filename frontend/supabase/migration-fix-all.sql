-- ============================================================
-- Migration: Fix all missing tables, columns, and demo data
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add missing biography column
ALTER TABLE people ADD COLUMN IF NOT EXISTS biography TEXT;

-- 2. Add missing notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'SYSTEM',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "authenticated can insert notifications" ON notifications
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Fix F001: Phạm Hướng (P001) is father, remove wrong mother
UPDATE families
SET father_handle = 'P001',
    mother_handle = NULL,
    children = '{"P002","P003"}'
WHERE handle = 'F001';

-- 4. Fix Phạm Trọng Nhân (P013): should be child of F005, not mother of F001
UPDATE people
SET families = '{}',
    parent_families = '{"F005"}',
    generation = 4
WHERE handle = 'P013';

-- 5. Fix Phạm Hướng (P001): should be father in F001
UPDATE people
SET families = '{"F001"}',
    parent_families = '{}'
WHERE handle = 'P001';

-- 6. Ensure Phạm Quang Viên (P002) has correct parent
UPDATE people
SET parent_families = '{"F001"}'
WHERE handle = 'P002'
  AND NOT (parent_families @> '{"F001"}');

-- 7. Ensure Phạm Nhiên (P003) has correct parent
UPDATE people
SET parent_families = '{"F001"}'
WHERE handle = 'P003'
  AND NOT (parent_families @> '{"F001"}');

-- 8. Verify results
SELECT handle, display_name, generation, families, parent_families
FROM people
ORDER BY generation, handle;

SELECT handle, father_handle, mother_handle, children
FROM families
ORDER BY handle;

SELECT '✅ Migration complete!' AS status;
