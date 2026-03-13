-- Migration 013: Rename clan 'ngo' (Họ Ngô) → 'huynh' (Họ Huỳnh)
-- Thứ tự: INSERT mới → UPDATE tất cả FK/array → DELETE cũ

-- ══════════════════════════════════════════════════════════════
-- 1. Thêm clan mới 'huynh'
-- ══════════════════════════════════════════════════════════════

INSERT INTO clans (handle, display_name, description, surname_patterns)
VALUES ('huynh', 'Họ Huỳnh', 'Gia phả dòng họ Huỳnh', ARRAY['Huỳnh', 'Huynh'])
ON CONFLICT (handle) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. Cập nhật clan_handle (singular FK) trên people + families
-- ══════════════════════════════════════════════════════════════

UPDATE people  SET clan_handle = 'huynh' WHERE clan_handle = 'ngo';
UPDATE families SET clan_handle = 'huynh' WHERE clan_handle = 'ngo';

-- ══════════════════════════════════════════════════════════════
-- 3. Cập nhật clan_handles (array) trên tất cả bảng
-- ══════════════════════════════════════════════════════════════

UPDATE people
SET clan_handles = array_replace(clan_handles, 'ngo', 'huynh')
WHERE 'ngo' = ANY(clan_handles);

UPDATE posts
SET clan_handles = array_replace(clan_handles, 'ngo', 'huynh')
WHERE 'ngo' = ANY(clan_handles);

UPDATE events
SET clan_handles = array_replace(clan_handles, 'ngo', 'huynh')
WHERE 'ngo' = ANY(clan_handles);

UPDATE media
SET clan_handles = array_replace(clan_handles, 'ngo', 'huynh')
WHERE 'ngo' = ANY(clan_handles);

-- ══════════════════════════════════════════════════════════════
-- 4. Cập nhật profiles.clan_access
-- ══════════════════════════════════════════════════════════════

UPDATE profiles
SET clan_access = array_replace(clan_access, 'ngo', 'huynh')
WHERE 'ngo' = ANY(clan_access);

-- ══════════════════════════════════════════════════════════════
-- 5. Cập nhật clan_toc_map JSONB trên people (đổi key 'ngo' → 'huynh')
-- ══════════════════════════════════════════════════════════════

UPDATE people
SET clan_toc_map = (clan_toc_map - 'ngo') || jsonb_build_object('huynh', clan_toc_map -> 'ngo')
WHERE clan_toc_map ? 'ngo';

-- ══════════════════════════════════════════════════════════════
-- 6. Xóa clan cũ 'ngo'
-- ══════════════════════════════════════════════════════════════

DELETE FROM clans WHERE handle = 'ngo';

-- ══════════════════════════════════════════════════════════════
-- 7. Verify
-- ══════════════════════════════════════════════════════════════

SELECT handle, display_name, surname_patterns FROM clans ORDER BY handle;
