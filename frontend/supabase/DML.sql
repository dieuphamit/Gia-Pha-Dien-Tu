-- ============================================================
-- 🌳 Gia Phả Điện Tử — DML (Data Manipulation Language)
-- ============================================================
-- Dữ liệu khởi tạo và dữ liệu mẫu demo
-- Chạy file này SAU DDL.sql
--
-- Sections:
--   1. clans          — 3 dòng họ (pham, huynh, dinh)
--   2. people         — 67 thành viên demo (5 thế hệ, nhánh Phạm + nhánh Ô Nhiên)
--   3. families       — 18 gia đình (F001-F002, F005-F018)
--   4. updates        — clan data, F001 children, birth_date/death_date
--   5. family_questions — 5 câu hỏi xác minh
--   6. app_settings   — giá trị mặc định tính năng
--   7. storage        — tạo bucket 'media' trên Supabase Storage
--
-- ⚠️  Xóa sections 2-4 nếu dùng dữ liệu thật (giữ lại 1, 5, 6, 7)
-- ============================================================
--
-- Cấu trúc cây demo:
--   Đời 1 : Phạm Hướng (F001)
--   Đời 2 : Phạm Quang Viên + Đinh Thị Khai (F002) | Ô Nhiên + Dượng Yên (F010)
--   Đời 3 : 8 con của F002 + vợ/chồng              | 8 con của F010 + vợ/chồng
--   Đời 4 : con các nhánh Đời 3                    | con các nhánh F011-F018
--   Đời 5 : con F008 (Dũng + Trâm) | con F018 (Nhật + Thu)
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. CLANS (dòng họ — giữ lại cho prod)                 ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO clans (handle, display_name, description, surname_patterns) VALUES
    ('pham',  'Họ Phạm',  'Gia phả dòng họ Phạm',  ARRAY['Phạm', 'Pham']),
    ('huynh', 'Họ Huỳnh', 'Gia phả dòng họ Huỳnh', ARRAY['Huỳnh', 'Huynh']),
    ('dinh',  'Họ Đinh',  'Gia phả dòng họ Đinh',  ARRAY['Đinh', 'Dinh'])
ON CONFLICT (handle) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. PEOPLE (dữ liệu mẫu — xóa nếu dùng dữ liệu thật)  ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO people (
    handle, display_name, gender, generation,
    birth_year, death_year, is_living, is_patrilineal,
    families, parent_families, current_address, occupation
) VALUES

-- ── Đời 1 ──────────────────────────────────────────────────
('P001', 'Phạm Hướng',              1, 1,  1920, 1995, false, true,  '{"F001"}', '{}',       NULL,       NULL),

-- ── Đời 2 ──────────────────────────────────────────────────
('P002', 'Phạm Quang Viên',         1, 2,  1945, NULL, true,  true,  '{"F002"}', '{"F001"}', NULL,       NULL),
('P014', 'Đinh Thị Khai',           2, 2,  1925, 2000, false, false, '{"F002"}', '{}',       NULL,       NULL),

-- ── Đời 3: con chính tộc của F002 ──────────────────────────
('P005', 'Phạm Quang Vũ',           1, 3,  1970, NULL, true,  true,  '{"F005"}', '{"F002"}', NULL,       NULL),
('P006', 'Phạm Thị Hoài Nga',       2, 3,  1974, NULL, true,  true,  '{"F007"}', '{"F002"}', 'Đồng Nai', 'Công nhân'),
('P028', 'Phạm Đăng Phương',        1, 3,  NULL, NULL, true,  true,  '{}',       '{"F002"}', NULL,       NULL),
('P029', 'Phạm Phương Anh',         2, 3,  NULL, NULL, true,  true,  '{}',       '{"F002"}', NULL,       NULL),
('P009', 'Phạm Vũ Tường Vi',        1, 3,  1980, NULL, true,  true,  '{}',       '{"F002"}', NULL,       NULL),
('P010', 'Phạm Thị Minh Nguyệt',    2, 3,  1980, NULL, true,  true,  '{}',       '{"F002"}', NULL,       NULL),
('P011', 'Phạm Quang Diệu',         1, 3,  1989, NULL, true,  true,  '{"F006"}', '{"F002"}', 'Japan',    'Kỹ Sư'),
('P030', 'Phạm Đăng Hiền',          1, 3,  NULL, NULL, true,  true,  '{}',       '{"F002"}', NULL,       NULL),

-- ── Đời 3: vợ/chồng ngoại tộc ──────────────────────────────
('P015', 'Nguyễn Thị Hoài Thương',  2, 3,  NULL, NULL, true,  false, '{"F005"}', '{}',       NULL,       NULL),
('P016', 'Ngô Huỳnh Yến Tiên',      2, 3,  1991, NULL, true,  false, '{"F006"}', '{}',       'Japan',    'Nội Trợ'),
('P018', 'Nguyễn Phước Hải',        1, 3,  1970, NULL, true,  false, '{"F007"}', '{}',       'Đồng Nai', 'Bảo Vệ'),

-- ── Đời 4: con F005 (Phạm Quang Vũ + Nguyễn Thị Hoài Thương)
('P013', 'Phạm Trọng Nhân',         1, 4,  1995, NULL, true,  true,  '{}',       '{"F005"}', NULL,       NULL),

-- ── Đời 4: con F006 (Phạm Quang Diệu + Ngô Huỳnh Yến Tiên) ─
('P017', 'Phạm Tiên Đan',           2, 4,  2024, NULL, true,  true,  '{}',       '{"F006"}', 'Japan',    'Em bé'),

-- ── Đời 4: 5 con F007 (Nguyễn Phước Hải + Phạm Thị Hoài Nga), lớn→nhỏ
('P019', 'Nguyễn Nữ Thuỳ Trang',    2, 4,  1996, NULL, true,  false, '{}',       '{"F007"}', 'Đồng Nai', 'Kế Toán'),
('P020', 'Nguyễn Thị Thuỳ Tiên',    2, 4,  1998, NULL, true,  false, '{"F009"}', '{"F007"}', 'Đắk Mil',  'NV Bưu Điện'),
('P021', 'Nguyễn Nữ Hoài Trâm',     2, 4,  2001, NULL, true,  false, '{"F008"}', '{"F007"}', 'TP HCM',   'NV Văn Phòng'),
('P024', 'Nguyễn Đức Triều',        1, 4,  2003, NULL, true,  false, '{}',       '{"F007"}', 'TP HCM',   'tự do'),
('P027', 'Nguyễn Phạm Đăng Doanh',  1, 4,  2009, NULL, true,  false, '{}',       '{"F007"}', 'Đồng Nai', 'Học sinh'),

-- ── Đời 4: vợ/chồng ngoại tộc ──────────────────────────────
('P026', 'Nguyễn Ngọc Dũng',        1, 4,  1997, NULL, true,  false, '{"F008"}', '{}',       'Đắk Mil',  'tự do'),
('P025', 'Nguyễn Tạo',              1, 4,  1998, NULL, true,  false, '{"F009"}', '{}',       'Đắk Mil',  'tự do'),

-- ── Đời 5: 2 con F008 (Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm)
('P022', 'Nguyễn Ngọc Châu Anh',    2, 5,  2017, NULL, true,  false, '{}',       '{"F008"}', 'TP HCM',   'Học sinh'),
('P023', 'Nguyễn Ngọc Linh Đan',    2, 5,  2021, NULL, true,  false, '{}',       '{"F008"}', 'Đồng Nai', 'Học sinh')

ON CONFLICT (handle) DO NOTHING;

-- ── Nhánh Ô Nhiên (P031–P067) ────────────────────────────────

INSERT INTO people (
    handle, display_name, gender, generation,
    birth_year, death_year, is_living, is_patrilineal,
    families, parent_families, current_address, occupation
) VALUES

-- ── Đời 2: Ô Nhiên + Dượng Yên ─────────────────────────────
('P031', 'Ô Nhiên',               2, 2, NULL, NULL, true,  true,  '{"F010"}', '{"F001"}', NULL, NULL),
('P032', 'Dượng Yên',             1, 2, NULL, NULL, true,  false, '{"F010"}', '{}',       NULL, NULL),

-- ── Đời 3: 8 con của F010 (Dượng Yên + Ô Nhiên) ────────────
('P033', 'Phan Thị Lan',          2, 3, NULL, NULL, true,  false, '{"F011"}', '{"F010"}', NULL, NULL),
('P034', 'Phan Thị Lành',         2, 3, NULL, NULL, true,  false, '{"F012"}', '{"F010"}', NULL, NULL),
('P035', 'Phan Thị Hồng Luân',    2, 3, NULL, NULL, true,  false, '{"F013"}', '{"F010"}', NULL, NULL),
('P036', 'Phan Quang Linh',       1, 3, NULL, NULL, true,  false, '{"F014"}', '{"F010"}', NULL, NULL),
('P037', 'Phan Quang Ninh',       1, 3, NULL, NULL, true,  false, '{"F015"}', '{"F010"}', NULL, NULL),
('P038', 'Phan Thu Tình',         2, 3, NULL, NULL, true,  false, '{"F016"}', '{"F010"}', NULL, NULL),
('P039', 'Phan Thanh Thúy',       2, 3, NULL, NULL, true,  false, '{"F017"}', '{"F010"}', NULL, NULL),
('P040', 'Phan Quang Long',       1, 3, NULL, 2020, false, false, '{}',       '{"F010"}', NULL, NULL),

-- ── Đời 3: vợ/chồng ngoại tộc ──────────────────────────────
('P041', 'Phan Văn Hoàn',         1, 3, NULL, NULL, true,  false, '{"F011"}', '{}',       NULL, NULL),
('P042', 'Phan Văn Hoạt',         1, 3, NULL, NULL, true,  false, '{"F012"}', '{}',       NULL, NULL),
('P043', 'Nguyễn Văn Phước',      1, 3, NULL, NULL, true,  false, '{"F013"}', '{}',       NULL, NULL),
('P044', 'Phan Thị Huế',          2, 3, NULL, NULL, true,  false, '{"F014"}', '{}',       NULL, NULL),
('P045', 'Phan Thị Thơ',          2, 3, NULL, NULL, true,  false, '{"F015"}', '{}',       NULL, NULL),
('P046', 'Leonel',                1, 3, NULL, NULL, true,  false, '{"F016"}', '{}',       NULL, NULL),
('P047', 'Nguyễn Hoàng Tân',      1, 3, NULL, NULL, true,  false, '{"F017"}', '{}',       NULL, NULL),

-- ── Đời 4: con F011 (Phan Văn Hoàn + Phan Thị Lan) ─────────
('P048', 'Phan Đức Anh',          1, 4, NULL, NULL, true,  false, '{}',       '{"F011"}', NULL, NULL),
('P049', 'Phan Thị Hoài Thanh',   2, 4, NULL, NULL, true,  false, '{}',       '{"F011"}', NULL, NULL),
('P050', 'Phan Anh Tuấn',         1, 4, NULL, NULL, true,  false, '{}',       '{"F011"}', NULL, NULL),

-- ── Đời 4: con F012 (Phan Văn Hoạt + Phan Thị Lành) ────────
('P051', 'Phan Thị Minh Thu',     2, 4, NULL, NULL, true,  false, '{"F018"}', '{"F012"}', NULL, NULL),
('P052', 'Phan Quang Thìn',       1, 4, NULL, NULL, true,  false, '{}',       '{"F012"}', NULL, NULL),
('P053', 'Phan Quang Dũng',       1, 4, NULL, NULL, true,  false, '{}',       '{"F012"}', NULL, NULL),
('P054', 'Phan Quang Huy',        1, 4, NULL, NULL, true,  false, '{}',       '{"F012"}', NULL, NULL),

-- ── Đời 4: con F013 (Nguyễn Văn Phước + Phan Thị Hồng Luân)
('P055', 'Nguyễn Thị Yến Nhi',    2, 4, NULL, NULL, true,  false, '{}',       '{"F013"}', NULL, NULL),
('P056', 'Nguyễn Thúy Vy',        2, 4, NULL, NULL, true,  false, '{}',       '{"F013"}', NULL, NULL),

-- ── Đời 4: con F014 (Phan Quang Linh + Phan Thị Huế) ───────
('P057', 'Phan Thị Ngọc Ngà',     2, 4, NULL, NULL, true,  false, '{}',       '{"F014"}', NULL, NULL),
('P058', 'Phan Trung Nguyên',      1, 4, NULL, NULL, true,  false, '{}',       '{"F014"}', NULL, NULL),

-- ── Đời 4: con F015 (Phan Quang Ninh + Phan Thị Thơ) ───────
('P059', 'Phan Thị Thảo My',      2, 4, NULL, NULL, true,  false, '{}',       '{"F015"}', NULL, NULL),
('P060', 'Phan Thị Ngọc Ánh',     2, 4, NULL, NULL, true,  false, '{}',       '{"F015"}', NULL, NULL),
('P061', 'Phan Sao Mai',           2, 4, NULL, NULL, true,  false, '{}',       '{"F015"}', NULL, NULL),
('P062', 'Phan Quang Vinh',        1, 4, NULL, NULL, true,  false, '{}',       '{"F015"}', NULL, NULL),

-- ── Đời 4: con F016 (Leonel + Phan Thu Tình) ────────────────
('P063', 'Phan Khánh Linh',        2, 4, NULL, NULL, true,  false, '{}',       '{"F016"}', NULL, NULL),

-- ── Đời 4: con F017 (Nguyễn Hoàng Tân + Phan Thanh Thúy) ───
('P064', 'Nguyễn Duy Ân',          1, 4, NULL, NULL, true,  false, '{}',       '{"F017"}', NULL, NULL),
('P065', 'Nguyễn Thúy An',         2, 4, NULL, NULL, true,  false, '{}',       '{"F017"}', NULL, NULL),

-- ── Đời 4: vợ ngoại tộc ─────────────────────────────────────
('P066', 'Nguyễn Bá Nhật',         1, 4, NULL, NULL, true,  false, '{"F018"}', '{}',       NULL, NULL),

-- ── Đời 5: con F018 (Nguyễn Bá Nhật + Phan Thị Minh Thu) ───
('P067', 'Nguyễn Bảo Long',        1, 5, NULL, NULL, true,  false, '{}',       '{"F018"}', NULL, NULL)

ON CONFLICT (handle) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. FAMILIES (dữ liệu mẫu — xóa nếu dùng dữ liệu thật) ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO families (handle, father_handle, mother_handle, children) VALUES
-- F001: Phạm Hướng → con duy nhất P002 (P031 thêm bên dưới)
('F001', 'P001', NULL,   '{"P002"}'),
-- F002: Phạm Quang Viên + Đinh Thị Khai → 8 con (thứ tự khai sinh)
('F002', 'P002', 'P014', '{"P005","P006","P028","P029","P009","P010","P011","P030"}'),
-- F005: Phạm Quang Vũ + Nguyễn Thị Hoài Thương → Phạm Trọng Nhân
('F005', 'P005', 'P015', '{"P013"}'),
-- F006: Phạm Quang Diệu + Ngô Huỳnh Yến Tiên → Phạm Tiên Đan
('F006', 'P011', 'P016', '{"P017"}'),
-- F007: Nguyễn Phước Hải + Phạm Thị Hoài Nga → 5 con (lớn → nhỏ theo năm sinh)
('F007', 'P018', 'P006', '{"P019","P020","P021","P024","P027"}'),
-- F008: Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm → 2 con Đời 5
('F008', 'P026', 'P021', '{"P022","P023"}'),
-- F009: Nguyễn Tạo + Nguyễn Thị Thuỳ Tiên → chưa có con
('F009', 'P025', 'P020', '{}')

ON CONFLICT (handle) DO NOTHING;

-- ── Nhánh Ô Nhiên (F010–F018) ────────────────────────────────

INSERT INTO families (handle, father_handle, mother_handle, children) VALUES

-- F010: Dượng Yên + Ô Nhiên → 8 con
('F010', 'P032', 'P031', '{"P033","P034","P035","P036","P037","P038","P039","P040"}'),
-- F011: Phan Văn Hoàn + Phan Thị Lan → 3 con
('F011', 'P041', 'P033', '{"P048","P049","P050"}'),
-- F012: Phan Văn Hoạt + Phan Thị Lành → 4 con
('F012', 'P042', 'P034', '{"P051","P052","P053","P054"}'),
-- F013: Nguyễn Văn Phước + Phan Thị Hồng Luân → 2 con
('F013', 'P043', 'P035', '{"P055","P056"}'),
-- F014: Phan Quang Linh + Phan Thị Huế → 2 con
('F014', 'P036', 'P044', '{"P057","P058"}'),
-- F015: Phan Quang Ninh + Phan Thị Thơ → 4 con
('F015', 'P037', 'P045', '{"P059","P060","P061","P062"}'),
-- F016: Leonel + Phan Thu Tình → 1 con
('F016', 'P046', 'P038', '{"P063"}'),
-- F017: Nguyễn Hoàng Tân + Phan Thanh Thúy → 2 con
('F017', 'P047', 'P039', '{"P064","P065"}'),
-- F018: Nguyễn Bá Nhật + Phan Thị Minh Thu → 1 con (đời 5)
('F018', 'P066', 'P051', '{"P067"}')

ON CONFLICT (handle) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. DATA UPDATES                                        ║
-- ╚══════════════════════════════════════════════════════════╝

-- Thêm Ô Nhiên (P031) vào danh sách con của Phạm Hướng (F001)
UPDATE families
SET children = array_append(children, 'P031')
WHERE handle = 'F001'
  AND NOT ('P031' = ANY(children));

-- Điền birth_date từ birth_year (mặc định 01/01) cho người chưa có ngày cụ thể
UPDATE people
SET birth_date = make_date(birth_year, 1, 1)
WHERE birth_year IS NOT NULL
  AND birth_date IS NULL;

-- Điền death_date từ death_year (mặc định 01/01) cho người chưa có ngày cụ thể
UPDATE people
SET death_date = make_date(death_year, 1, 1)
WHERE death_year IS NOT NULL
  AND death_date IS NULL;

-- Gán clan 'pham' cho tất cả people và families trong dữ liệu demo
-- (toc_type sẽ được trigger compute_toc_type() tự tính lại)
UPDATE people
SET clan_handle = 'pham',
    clan_handles = ARRAY['pham']
WHERE clan_handles = '{}';

UPDATE families
SET clan_handle = 'pham'
WHERE clan_handle IS NULL;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. FAMILY_QUESTIONS (xóa / thay thế bằng câu thật)    ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO family_questions (question, correct_answer, hint, is_active) VALUES
('Tên của ông tổ (thế hệ 1) trong dòng họ là gì?', 'Phạm Hướng', 'Ông sinh năm 1920',     true),
('Ông Phạm Quang Viên là con của ai?',              'Phạm Hướng', 'Ông tổ đời 1',           true),
('Họ của dòng họ chúng ta là gì?',                  'Phạm',       'Họ phổ biến ở Việt Nam', true),
('Ông Phạm Quang Viên sinh năm bao nhiêu?',         '1945',       'Năm sau Thế chiến 2',    true),
('Ông Phạm Quang Diệu đang sống ở nước nào?',       'Japan',      'Nước Nhật Bản',          true)

ON CONFLICT DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. APP_SETTINGS (giá trị mặc định — giữ lại cho prod)  ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO app_settings (key, value, description) VALUES
('feature_directory_enabled',  'true', 'Bật/tắt chức năng Danh bạ liên lạc'),
('feature_media_enabled',      'true', 'Bật/tắt chức năng Thư viện hình ảnh & tài liệu'),
('media_upload_limit',         '5',    'Số lượng file tối đa mỗi thành viên được tải lên (admin & editor không bị giới hạn)'),
('media_max_image_size_mb',    '5',    'Kích thước tối đa mỗi ảnh tải lên (đơn vị MB). Áp dụng cho tất cả người dùng.')
ON CONFLICT (key) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  7. STORAGE (tạo bucket media — giữ lại cho prod)       ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800,   -- 50 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
SELECT '✅ DML data loaded! Dữ liệu đã được nạp.' AS status;
-- ============================================================
