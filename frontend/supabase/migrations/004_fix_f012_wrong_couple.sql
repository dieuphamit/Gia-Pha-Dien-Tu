-- ============================================================
-- Migration 004: Fix F012 (Cố Đông + Hoài Thương sai)
-- ============================================================
-- Root cause: F012 có father_handle=P035 (Cố Đông) và
--             mother_handle=P015 (Hoài Thương) → tạo dashed ❤ sai
-- ============================================================

-- ── 1. Xóa F012 (family sai: Cố Đông + Hoài Thương không có thật) ──
DELETE FROM families
WHERE handle = 'F012'
  AND father_handle = 'P035'
  AND mother_handle = 'P015';

-- ── 2. Xóa F011 (family rác: chỉ có P015 làm mẹ, không cha, không con) ──
DELETE FROM families
WHERE handle = 'F011'
  AND father_handle IS NULL
  AND mother_handle = 'P015'
  AND children = '{}';

-- ── 3. Sửa people.families của P035 (Cố Đông) ──────────────
-- Hiện tại: ["F001"]
-- Đúng: ["F001","F013"] vì F013 có P035 là mother_handle và có con P056
UPDATE people
SET families = '{"F001","F013"}'
WHERE handle = 'P035'
  AND families = '{"F001"}';

-- ── Kiểm tra sau khi chạy ────────────────────────────────────
SELECT f.handle, f.father_handle, pf.display_name AS father_name,
       f.mother_handle, pm.display_name AS mother_name, f.children
FROM families f
LEFT JOIN people pf ON pf.handle = f.father_handle
LEFT JOIN people pm ON pm.handle = f.mother_handle
WHERE f.handle IN ('F001','F005','F011','F012','F013')
ORDER BY f.handle;

SELECT handle, display_name, families, parent_families
FROM people
WHERE handle IN ('P015','P035');
