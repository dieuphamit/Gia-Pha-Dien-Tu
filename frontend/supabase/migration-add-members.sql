-- ============================================================
-- Migration: Add new family members & fix structure
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- Cấu trúc đúng:
--   Đời 1: Phạm Hướng (F001, không có vợ)
--   Đời 2: Phạm Quang Viên + Đinh Thị Khai (F002)
--   Đời 3: 8 con của F002
--   Đời 4: con của từng nhánh Đời 3
--   Đời 5: con của Nguyễn Nữ Hoài Trâm + Nguyễn Ngọc Dũng
-- ============================================================


-- ── 1. FIX: Phạm Hướng (Đời 1) không có vợ trong cây ─────
UPDATE families
SET mother_handle = NULL
WHERE handle = 'F001';

-- ── 2. FIX: Đinh Thị Khai là vợ Đời 2 (Phạm Quang Viên) ──
-- Chuyển từ Đời 1 ngoại tộc → Đời 2 vợ trong F002
UPDATE people
SET generation = 2,
    families   = '{"F002"}'
WHERE handle = 'P014';

-- ── 3. FIX: F002 có mẹ là Đinh Thị Khai + 8 người con ────
-- (P028, P029, P030 sẽ được thêm bên dưới)
UPDATE families
SET mother_handle = 'P014',
    children      = '{"P005","P006","P028","P029","P009","P010","P011","P030"}'
WHERE handle = 'F002';

-- ── 4. UPDATE existing members với info từ ảnh ────────────
UPDATE people SET
    birth_year      = 1974,
    current_address = 'Đồng Nai',
    occupation      = 'Công nhân',
    families        = '{"F007"}'
WHERE handle = 'P006';

UPDATE people SET
    birth_year      = 1989,
    current_address = 'Japan',
    occupation      = 'Kỹ Sư',
    families        = '{"F006"}'
WHERE handle = 'P011';

-- P013 không có gia đình riêng (bỏ F008 nhầm trước đó)
UPDATE people SET families = '{}' WHERE handle = 'P013';

-- P010 không có gia đình con (bỏ F010 nhầm trước đó)
UPDATE people SET families = '{}' WHERE handle = 'P010';


-- ── 5. ADD: 3 người Đời 3 mới (con của F002) ──────────────
INSERT INTO people (handle, display_name, gender, generation, is_living, is_privacy_filtered, is_patrilineal, families, parent_families) VALUES
('P028', 'Phạm Đăng Phương', 1, 3, true, false, true, '{}', '{"F002"}'),
('P029', 'Phạm Phương Anh',  2, 3, true, false, true, '{}', '{"F002"}'),
('P030', 'Phạm Đăng Hiền',   1, 3, true, false, true, '{}', '{"F002"}')
ON CONFLICT (handle) DO NOTHING;


-- ── 6. ADD: Vợ/chồng và con ngoại tộc từ ảnh ─────────────
INSERT INTO people (
    handle, display_name, gender, generation,
    birth_year, is_living, is_privacy_filtered, is_patrilineal,
    families, parent_families, current_address, occupation
) VALUES
-- Vợ P011 (Japan)
('P016', 'Ngô Huỳnh Yến Tiên',      2, 3, 1991, true, false, false,
 '{"F006"}', '{}',        'Japan',    'Nội Trợ'),
-- Con P011 (Đ4)
('P017', 'Phạm Tiên Đan',            2, 4, 2024, true, false, true,
 '{}',       '{"F006"}',  'Japan',    'Em bé'),
-- Chồng P006 (Đồng Nai)
('P018', 'Nguyễn Phước Hải',         1, 3, 1970, true, false, false,
 '{"F007"}', '{}',        'Đồng Nai', 'Bảo Vệ'),
-- 5 con của F007 (P006 + P018)
('P019', 'Nguyễn Nữ Thuỳ Trang',    2, 4, 1996, true, false, false,
 '{}',       '{"F007"}',  'Đồng Nai', 'Kế Toán'),
('P020', 'Nguyễn Phạm Đăng Doanh',  1, 4, 2009, true, false, false,
 '{}',       '{"F007"}',  'Đồng Nai', 'Học sinh'),
('P021', 'Nguyễn Nữ Hoài Trâm',     2, 4, 2001, true, false, false,
 '{"F008"}', '{"F007"}',  'TP HCM',   'NV Văn Phòng'),
('P027', 'Nguyễn Thị Thuỳ Tiên',    2, 4, 1998, true, false, false,
 '{"F009"}', '{"F007"}',  'Đắk Mil',  'NV Bưu Điện'),
('P024', 'Nguyễn Đức Triều',         1, 4, 2003, true, false, false,
 '{}',       '{"F007"}',  'TP HCM',   'tự do'),
-- Chồng của các con gái P006
('P026', 'Nguyễn Ngọc Dũng',         1, 4, 1997, true, false, false,
 '{"F008"}', '{}',        'Đắk Mil',  'tự do'),
('P025', 'Nguyễn Tạo',               1, 4, 1998, true, false, false,
 '{"F009"}', '{}',        'Đắk Mil',  'tự do'),
-- Đời 5: con của P026 + P021
('P022', 'Nguyễn Ngọc Châu Anh',    2, 5, 2017, true, false, false,
 '{}',       '{"F008"}',  'TP HCM',   'Học sinh'),
('P023', 'Nguyễn Ngọc Linh Đan',    2, 5, 2021, true, false, false,
 '{}',       '{"F008"}',  'Đồng Nai', 'Học sinh')

ON CONFLICT (handle) DO NOTHING;


-- ── 7. ADD: Gia đình mới ──────────────────────────────────
INSERT INTO families (handle, father_handle, mother_handle, children) VALUES
-- F006: Phạm Quang Diệu + Ngô Huỳnh Yến Tiên → Phạm Tiên Đan
('F006', 'P011', 'P016', '{"P017"}'),
-- F007: Nguyễn Phước Hải + Phạm Thị Hoài Nga → 5 con
('F007', 'P018', 'P006', '{"P019","P020","P021","P027","P024"}'),
-- F008: Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm → 2 con Đời 5
('F008', 'P026', 'P021', '{"P022","P023"}'),
-- F009: Nguyễn Tạo + Nguyễn Thị Thuỳ Tiên
('F009', 'P025', 'P027', '{}')

ON CONFLICT (handle) DO NOTHING;


-- ── 8. FIX families đã tồn tại sai (override ON CONFLICT) ─

-- F007: đảm bảo đủ 5 con
UPDATE families
SET father_handle = 'P018',
    mother_handle = 'P006',
    children      = '{"P019","P020","P021","P027","P024"}'
WHERE handle = 'F007';

-- F008: cha là Nguyễn Ngọc Dũng (P026), KHÔNG phải Phạm Trọng Nhân (P013)
UPDATE families
SET father_handle = 'P026',
    mother_handle = 'P021',
    children      = '{"P022","P023"}'
WHERE handle = 'F008';

-- F009: Nguyễn Tạo + Nguyễn Thị Thuỳ Tiên
UPDATE families
SET father_handle = 'P025',
    mother_handle = 'P027',
    children      = '{}'
WHERE handle = 'F009';

-- F006: Phạm Quang Diệu + Ngô Huỳnh Yến Tiên → Phạm Tiên Đan
UPDATE families
SET father_handle = 'P011',
    mother_handle = 'P016',
    children      = '{"P017"}'
WHERE handle = 'F006';

-- ── 9. FIX people đã tồn tại sai (override ON CONFLICT) ───

-- P013 Phạm Trọng Nhân: CHƯA có vợ/con
UPDATE people SET families = '{}' WHERE handle = 'P013';

-- P021 Nguyễn Nữ Hoài Trâm: con của F007, vợ trong F008
UPDATE people
SET families        = '{"F008"}',
    parent_families = '{"F007"}'
WHERE handle = 'P021';

-- P026 Nguyễn Ngọc Dũng: cha trong F008
UPDATE people SET families = '{"F008"}' WHERE handle = 'P026';

-- P025 Nguyễn Tạo: cha trong F009
UPDATE people SET families = '{"F009"}' WHERE handle = 'P025';

-- P027 Nguyễn Thị Thuỳ Tiên: con F007, mẹ trong F009
UPDATE people
SET families        = '{"F009"}',
    parent_families = '{"F007"}'
WHERE handle = 'P027';

-- P024 Nguyễn Đức Triều: con F007
UPDATE people SET parent_families = '{"F007"}' WHERE handle = 'P024';

-- P022, P023: con F008
UPDATE people SET parent_families = '{"F008"}' WHERE handle = 'P022';
UPDATE people SET parent_families = '{"F008"}' WHERE handle = 'P023';

-- ── 10. Xóa F010 nếu đã tạo nhầm ─────────────────────────
DELETE FROM families WHERE handle = 'F010';


-- ── 11. SWAP P020 ↔ P027 (sắp xếp lại con F007 theo thứ tự từ lớn đến nhỏ) ──
-- Thứ tự đúng: Thuỳ Trang (1996) > Thuỳ Tiên (1998) > Hoài Trâm (2001) > Đức Triều (2003) > Đăng Doanh (2009)

-- P020 → Nguyễn Thị Thuỳ Tiên (con thứ 2, sinh 1998, có chồng F009)
UPDATE people SET
    display_name    = 'Nguyễn Thị Thuỳ Tiên',
    gender          = 2,
    birth_year      = 1998,
    current_address = 'Đắk Mil',
    occupation      = 'NV Bưu Điện',
    families        = '{"F009"}',
    parent_families = '{"F007"}'
WHERE handle = 'P020';

-- P027 → Nguyễn Phạm Đăng Doanh (con út, sinh 2009, chưa có gia đình)
UPDATE people SET
    display_name    = 'Nguyễn Phạm Đăng Doanh',
    gender          = 1,
    birth_year      = 2009,
    current_address = 'Đồng Nai',
    occupation      = 'Học sinh',
    families        = '{}',
    parent_families = '{"F007"}'
WHERE handle = 'P027';

-- F009: mẹ là P020 (Thuỳ Tiên, handle mới) thay vì P027
UPDATE families
SET father_handle = 'P025',
    mother_handle = 'P020',
    children      = '{}'
WHERE handle = 'F009';

-- P025 (Nguyễn Tạo): families=[F009] vẫn đúng, đảm bảo parent_families trống
UPDATE people SET families = '{"F009"}', parent_families = '{}' WHERE handle = 'P025';

-- F007: children theo đúng thứ tự lớn → nhỏ
UPDATE families
SET children = '{"P019","P020","P021","P024","P027"}'
WHERE handle = 'F007';


-- ── 12. Verify ────────────────────────────────────────────
SELECT handle, display_name, gender, generation, families, parent_families
FROM people ORDER BY generation, handle;

SELECT handle, father_handle, mother_handle, children
FROM families ORDER BY handle;

SELECT '✅ Migration complete!' AS status;
