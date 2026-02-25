-- ============================================================
-- Migration: Restructure family tree to match correct data
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add missing columns/tables
ALTER TABLE people ADD COLUMN IF NOT EXISTS biography TEXT;

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

-- 2. Delete families that no longer exist
DELETE FROM families WHERE handle IN ('F003', 'F004', 'F006');

-- 3. Delete people that no longer exist
DELETE FROM people WHERE handle IN ('P003', 'P004', 'P007', 'P008', 'P012');

-- 4. Fix F001: Phạm Hướng + Đinh Thị Khai → only child P002
UPDATE families
SET father_handle = 'P001',
    mother_handle = 'P014',
    children = '{"P002"}'
WHERE handle = 'F001';

-- 5. Fix F002: Phạm Quang Viên → 5 children (Đời 3)
UPDATE families
SET father_handle = 'P002',
    mother_handle = NULL,
    children = '{"P005","P006","P009","P010","P011"}'
WHERE handle = 'F002';

-- 6. Fix F005: Phạm Quang Vũ + Nguyễn Thị Hoài Thương → 1 child (Đời 4)
UPDATE families
SET father_handle = 'P005',
    mother_handle = 'P015',
    children = '{"P013"}'
WHERE handle = 'F005';

-- 7. Fix P009: Đời 3, child of F002
UPDATE people
SET generation = 3,
    parent_families = '{"F002"}',
    families = '{}'
WHERE handle = 'P009';

-- 8. Fix P010: Đời 3, child of F002 (nữ)
UPDATE people
SET generation = 3,
    gender = 2,
    parent_families = '{"F002"}',
    families = '{}'
WHERE handle = 'P010';

-- 9. Fix P006: gender = nữ
UPDATE people SET gender = 2 WHERE handle = 'P006';

-- 10. Fix P011: Đời 3, child of F002 (anh em với Phạm Quang Vũ)
UPDATE people
SET generation = 3,
    parent_families = '{"F002"}',
    families = '{}'
WHERE handle = 'P011';

-- 11. Fix P013: Đời 4, child of F005
UPDATE people
SET generation = 4,
    parent_families = '{"F005"}',
    families = '{}'
WHERE handle = 'P013';

-- 12. Ensure P001, P002, P005 have correct families
UPDATE people SET families = '{"F001"}', parent_families = '{}' WHERE handle = 'P001';
UPDATE people SET families = '{"F002"}', parent_families = '{"F001"}' WHERE handle = 'P002';
UPDATE people SET families = '{"F005"}', parent_families = '{"F002"}' WHERE handle = 'P005';

-- 13. Fix P015: rename to Nguyễn Thị Hoài Thương
UPDATE people
SET display_name = 'Nguyễn Thị Hoài Thương',
    birth_year = NULL
WHERE handle = 'P015';

-- Verify
SELECT handle, display_name, gender, generation, families, parent_families
FROM people ORDER BY generation, handle;

SELECT handle, father_handle, mother_handle, children
FROM families ORDER BY handle;

SELECT '✅ Migration complete!' AS status;
