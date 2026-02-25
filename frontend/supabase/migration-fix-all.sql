-- ============================================================
-- Migration: Fix ALL missing tables, columns, and demo data
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================
-- Fixes:
--   1. Add missing biography column
--   2. Add missing notifications table + RLS
--   3. Create missing P004 (Đời 2, con thứ 3 của Phạm Hướng)
--   4. Create missing F004 (gia đình P004)
--   5. Fix F001: mother should be P014 (Đinh Thị Khai), not P013
--   6. Fix F002: mother should be NULL (P014 is wife of P001, not P002)
--   7. Fix F005: children should include P013, correct list
--   8. Fix P010, P011: parent_families → F005, generation → 4
--   9. Fix P012: parent_families → F006, generation → 4
--  10. Fix P006: gender should be 2 (nữ)
--  11. Fix P013: ensure correct generation and parent_families
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

-- 3. Create missing P004 (Đời 2 member)
INSERT INTO people (handle, display_name, gender, generation, birth_year, is_living, is_patrilineal, families, parent_families)
VALUES ('P004', 'Phạm [Chưa cập nhật]', 1, 2, 1951, true, true, '{"F004"}', '{"F001"}')
ON CONFLICT (handle) DO UPDATE SET
    generation = 2,
    families = '{"F004"}',
    parent_families = '{"F001"}';

-- 4. Create missing F004 (family for P004)
INSERT INTO families (handle, father_handle, mother_handle, children)
VALUES ('F004', 'P004', NULL, '{"P009"}')
ON CONFLICT (handle) DO UPDATE SET
    father_handle = 'P004',
    children = '{"P009"}';

-- 5. Fix F001: Phạm Hướng (P001) + Đinh Thị Khai (P014), children = P002, P003, P004
UPDATE families
SET father_handle = 'P001',
    mother_handle = 'P014',
    children = '{"P002","P003","P004"}'
WHERE handle = 'F001';

-- 6. Fix F002: P002's wife is NOT P014 (P014 is P001's wife)
UPDATE families
SET mother_handle = NULL
WHERE handle = 'F002';

-- 7. Fix F005: children should be P010, P011, P013 (all Đời 4)
UPDATE families
SET children = '{"P010","P011","P013"}'
WHERE handle = 'F005';

-- 8. Fix P010: generation 4, parent_families = F005
UPDATE people
SET generation = 4,
    parent_families = '{"F005"}',
    gender = 2
WHERE handle = 'P010';

-- 9. Fix P011: generation 4, parent_families = F005
UPDATE people
SET generation = 4,
    parent_families = '{"F005"}'
WHERE handle = 'P011';

-- 10. Fix P012: generation 4, parent_families = F006
UPDATE people
SET generation = 4,
    parent_families = '{"F006"}'
WHERE handle = 'P012';

-- 11. Fix P013: ensure Đời 4, child of F005
UPDATE people
SET families = '{}',
    parent_families = '{"F005"}',
    generation = 4
WHERE handle = 'P013';

-- 12. Fix P001: ensure correct families
UPDATE people
SET families = '{"F001"}',
    parent_families = '{}'
WHERE handle = 'P001';

-- 13. Fix P014: ensure she has no families/parent_families (ngoại tộc)
-- P014 is mother of F001 but stored in families table, not in people.families
-- (people.families = family handles where person is a PARENT, tracked via families table)
UPDATE people
SET families = '{}',
    parent_families = '{}'
WHERE handle = 'P014';

-- 14. Fix P006: should be female (Phạm Thị Hoài Nga)
UPDATE people
SET gender = 2
WHERE handle = 'P006';

-- 15. Fix P009: ensure correct parent_families
UPDATE people
SET parent_families = '{"F004"}'
WHERE handle = 'P009';

-- 16. Ensure P002, P003 have correct parent_families
UPDATE people SET parent_families = '{"F001"}' WHERE handle = 'P002';
UPDATE people SET parent_families = '{"F001"}' WHERE handle = 'P003';

-- ============================================================
-- Verify results
-- ============================================================
SELECT '--- PEOPLE ---' AS section;
SELECT handle, display_name, gender, generation, families, parent_families
FROM people
ORDER BY generation, handle;

SELECT '--- FAMILIES ---' AS section;
SELECT handle, father_handle, mother_handle, children
FROM families
ORDER BY handle;

SELECT '✅ Migration complete! All data fixed.' AS status;
