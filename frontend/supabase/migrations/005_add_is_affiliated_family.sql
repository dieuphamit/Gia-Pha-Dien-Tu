-- ============================================================
-- Migration 005: Thêm cột is_affiliated_family vào people
-- ============================================================
-- Mục đích: Đánh dấu thành viên có nguồn gốc gần với họ Phạm
--   dù không mang huyết thống (isPatrilineal=false).
--   Ví dụ: vợ/chồng của con cháu họ Phạm, con cái mang họ khác
--   nhưng vẫn là cháu trực tiếp của tổ tiên Phạm.
-- Flag này được admin set thủ công khi edit member.
-- ============================================================

ALTER TABLE people
    ADD COLUMN IF NOT EXISTS is_affiliated_family BOOLEAN DEFAULT false;

-- ── Kiểm tra sau khi chạy ────────────────────────────────────
SELECT handle, display_name, is_patrilineal, is_affiliated_family
FROM people
ORDER BY generation, handle
LIMIT 10;
