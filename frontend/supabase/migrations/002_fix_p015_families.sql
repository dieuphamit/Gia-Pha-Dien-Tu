-- ============================================================
-- Migration 002: Fix P015 (Nguyễn Thị Hoài Thương) thiếu families
-- ============================================================
-- Bug: P015 có families = '{}' thay vì '{"F005"}'
-- Hậu quả: filterDescendants('P015') trả về chỉ P015 đứng trơ vơ,
--           không có chồng P005 và con P013.
-- ============================================================
-- Chạy trong Supabase SQL Editor

UPDATE people
SET families = '{"F005"}'
WHERE handle = 'P015'
  AND families = '{}';

-- Verify
SELECT handle, display_name, families
FROM people
WHERE handle = 'P015';
