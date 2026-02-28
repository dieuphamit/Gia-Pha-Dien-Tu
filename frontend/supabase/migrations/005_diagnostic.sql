-- ============================================================
-- Migration 005: Diagnostic — Kiểm tra xung đột handle
-- ============================================================
-- Chạy file này TRƯỚC khi fix để biết chính xác DB đang chứa gì
-- ============================================================

-- 1. Toàn bộ người từ P031 trở lên (để thấy pre-existing vs. mới)
SELECT
    handle,
    display_name,
    gender,
    generation,
    birth_year,
    is_patrilineal,
    families,
    parent_families
FROM people
WHERE handle >= 'P031'
ORDER BY handle;

-- 2. Toàn bộ gia đình từ F010 trở lên
SELECT
    f.handle,
    f.father_handle,
    pf.display_name AS father_name,
    f.mother_handle,
    pm.display_name AS mother_name,
    f.children
FROM families f
LEFT JOIN people pf ON pf.handle = f.father_handle
LEFT JOIN people pm ON pm.handle = f.mother_handle
WHERE f.handle >= 'F010'
ORDER BY f.handle;

-- 3. F001 (con của Phạm Hướng — đã thêm Ô Nhiên chưa?)
SELECT handle, father_handle, mother_handle, children
FROM families
WHERE handle = 'F001';

-- 4. Các gia đình F011-F014 có đúng không?
SELECT
    f.handle,
    f.father_handle, pf.display_name AS father_name,
    f.mother_handle, pm.display_name AS mother_name,
    f.children
FROM families f
LEFT JOIN people pf ON pf.handle = f.father_handle
LEFT JOIN people pm ON pm.handle = f.mother_handle
WHERE f.handle IN ('F011','F012','F013','F014')
ORDER BY f.handle;
