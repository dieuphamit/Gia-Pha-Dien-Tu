-- ============================================================
-- Migration 003: Chẩn đoán & Fix đường nối Cố Đông / Hoài Thương
-- ============================================================
-- BUG: Có đường đứt nét (❤) giữa Cố Đông và Hoài Thương (P015).
-- Nguyên nhân có thể:
--   A. Có một family trong DB có cả Cố Đông VÀ P015 là cha/mẹ (lỗi nhập liệu)
--   B. Cố Đông bị đặt sai Y-position (khác world so với P001)
--      vì `people.families` chưa trỏ đúng family handle của cô ấy
-- ============================================================
-- BƯỚC 1: CHẠY CÁC QUERY CHẨN ĐOÁN TRƯỚC

-- ── A. Xem tất cả thông tin về Cố Đông ──────────────────────
SELECT
    handle,
    display_name,
    generation,
    families,
    parent_families
FROM people
WHERE display_name ILIKE '%cố đông%'
   OR display_name ILIKE '%co dong%'
   OR display_name ILIKE '%cô đông%';

-- ── B. Xem tất cả gia đình có Cố Đông là father/mother ──────
SELECT
    f.handle         AS family_handle,
    f.father_handle,
    pf.display_name  AS father_name,
    f.mother_handle,
    pm.display_name  AS mother_name,
    f.children
FROM families f
LEFT JOIN people pf ON pf.handle = f.father_handle
LEFT JOIN people pm ON pm.handle = f.mother_handle
WHERE f.father_handle = (
        SELECT handle FROM people
        WHERE display_name ILIKE '%cố đông%'
        LIMIT 1
    )
   OR f.mother_handle = (
        SELECT handle FROM people
        WHERE display_name ILIKE '%cố đông%'
        LIMIT 1
    );

-- ── C. Xem tất cả gia đình có P015 (Hoài Thương) là father/mother ──
SELECT
    f.handle         AS family_handle,
    f.father_handle,
    pf.display_name  AS father_name,
    f.mother_handle,
    pm.display_name  AS mother_name,
    f.children
FROM families f
LEFT JOIN people pf ON pf.handle = f.father_handle
LEFT JOIN people pm ON pm.handle = f.mother_handle
WHERE f.father_handle = 'P015'
   OR f.mother_handle = 'P015';

-- ── D. Xem F001 hiện tại trong DB ────────────────────────────
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
WHERE f.handle = 'F001';

-- ============================================================
-- BƯỚC 2: SAU KHI XEM KẾT QUẢ, CHẠY FIX PHÙ HỢP
-- ============================================================

-- ── FIX A: Nếu có 1 family nhầm có cả Cố Đông VÀ P015 ───────
-- Uncomment và sửa <FAMILY_HANDLE> + <CORRECT_MOTHER_HANDLE>
-- UPDATE families
-- SET mother_handle = '<CORRECT_MOTHER_HANDLE>'   -- ví dụ: NULL hoặc handle đúng
-- WHERE handle = '<FAMILY_HANDLE>'
--   AND (
--         (father_handle = (SELECT handle FROM people WHERE display_name ILIKE '%cố đông%' LIMIT 1)
--          AND mother_handle = 'P015')
--     OR  (mother_handle = (SELECT handle FROM people WHERE display_name ILIKE '%cố đông%' LIMIT 1)
--          AND father_handle = 'P015')
--   );

-- ── FIX B: Đảm bảo Cố Đông có families trỏ đúng ─────────────
-- (chạy sau khi biết handle của Cố Đông và family handle của cô ấy)
-- UPDATE people
-- SET families = ARRAY['<FAMILY_HANDLE_WHERE_COD_IS_PARENT>']::text[]
-- WHERE handle = (SELECT handle FROM people WHERE display_name ILIKE '%cố đông%' LIMIT 1)
--   AND families = '{}';

-- ── FIX C: Đảm bảo F001 có mother_handle = Cố Đông ──────────
-- (nếu F001 đang thiếu mother_handle)
-- UPDATE families
-- SET mother_handle = (SELECT handle FROM people WHERE display_name ILIKE '%cố đông%' LIMIT 1)
-- WHERE handle = 'F001'
--   AND mother_handle IS NULL;
