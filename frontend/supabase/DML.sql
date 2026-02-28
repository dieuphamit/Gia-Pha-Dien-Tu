-- ============================================================
-- 🌳 Gia Phả Điện Tử — DML (Data Manipulation Language)
-- ============================================================
-- Dữ liệu khởi tạo và dữ liệu mẫu demo
-- Chạy file này SAU DDL.sql
--
-- Sections:
--   1. people       — 25 thành viên demo (5 thế hệ, dòng họ Phạm)
--   2. families     — 7 gia đình (quan hệ cha/mẹ/con)
--   3. family_questions — 5 câu hỏi xác minh
--   4. app_settings — giá trị mặc định tính năng
--   5. storage      — tạo bucket 'media' trên Supabase Storage
--
-- ⚠️  Xóa sections 1-3 nếu dùng dữ liệu thật
-- ============================================================
--
-- Cấu trúc cây demo:
--   Đời 1 : Phạm Hướng (F001)
--   Đời 2 : Phạm Quang Viên + Đinh Thị Khai (F002)
--   Đời 3 : 8 con của F002 + vợ/chồng ngoại tộc
--   Đời 4 : con của từng nhánh Đời 3
--   Đời 5 : con của F008 (Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm)
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. PEOPLE (dữ liệu mẫu — xóa nếu dùng dữ liệu thật)  ║
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
('P015', 'Nguyễn Thị Hoài Thương',  2, 3,  NULL, NULL, true,  false, '{}',       '{}',       NULL,       NULL),
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


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. FAMILIES (dữ liệu mẫu — xóa nếu dùng dữ liệu thật) ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO families (handle, father_handle, mother_handle, children) VALUES
-- F001: Phạm Hướng → con duy nhất P002
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


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. FAMILY_QUESTIONS (xóa / thay thế bằng câu thật)    ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO family_questions (question, correct_answer, hint, is_active) VALUES
('Tên của ông tổ (thế hệ 1) trong dòng họ là gì?', 'Phạm Hướng', 'Ông sinh năm 1920',     true),
('Ông Phạm Quang Viên là con của ai?',              'Phạm Hướng', 'Ông tổ đời 1',           true),
('Họ của dòng họ chúng ta là gì?',                  'Phạm',       'Họ phổ biến ở Việt Nam', true),
('Ông Phạm Quang Viên sinh năm bao nhiêu?',         '1945',       'Năm sau Thế chiến 2',    true),
('Ông Phạm Quang Diệu đang sống ở nước nào?',       'Japan',      'Nước Nhật Bản',          true)

ON CONFLICT DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. APP_SETTINGS (giá trị mặc định — giữ lại cho prod)  ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO app_settings (key, value, description) VALUES
('feature_media_enabled',      'true', 'Bật/tắt chức năng Thư viện hình ảnh & tài liệu'),
('media_upload_limit',         '5',    'Số lượng file tối đa mỗi thành viên được tải lên (admin & editor không bị giới hạn)'),
('media_max_image_size_mb',    '5',    'Kích thước tối đa mỗi ảnh tải lên (đơn vị MB). Áp dụng cho tất cả người dùng.')
ON CONFLICT (key) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. STORAGE (tạo bucket media — giữ lại cho prod)       ║
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
