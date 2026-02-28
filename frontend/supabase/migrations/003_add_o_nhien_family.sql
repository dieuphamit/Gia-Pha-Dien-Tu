-- ============================================================
-- Migration 003: Thêm gia đình Ô Nhiên
-- ============================================================
-- Ô Nhiên = con gái của P001 (Phạm Hướng), đời 2
-- Chồng: Dượng Yên (họ Phan), đời 2
-- 8 con đời 3, các cháu đời 4, chắt đời 5
--
-- Tổng: 37 người (P031-P067), 9 gia đình (F010-F018)
--
-- Quy tắc is_patrilineal:
--   Ô Nhiên (con gái Phạm Hướng) → true
--   Dượng Yên + tất cả con cháu    → false (họ Phan, không phải họ Phạm)
--
-- Cấu trúc gia đình:
--   F010: Dượng Yên + Ô Nhiên   → 8 con (P033-P040)
--   F011: Phan Văn Hoàn + Phan Thị Lan           → P048,P049,P050
--   F012: Phan Văn Hoạt + Phan Thị Lành          → P051,P052,P053,P054
--   F013: Nguyễn Văn Phước + Phan Thị Hồng Luân  → P055,P056
--   F014: Phan Quang Linh + Phan Thị Huế         → P057,P058
--   F015: Phan Quang Ninh + Phan Thị Thơ         → P059,P060,P061,P062
--   F016: Leonel + Phan Thu Tình                 → P063
--   F017: Nguyễn Hoàng Tân + Phan Thanh Thúy    → P064,P065
--   F018: Nguyễn Bá Nhật + Phan Thị Minh Thu    → P067
--
-- Chạy trong Supabase SQL Editor
-- ============================================================

BEGIN;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. PEOPLE                                              ║
-- ╚══════════════════════════════════════════════════════════╝

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

-- ── Đời 4: vợ/chồng ngoại tộc ──────────────────────────────
('P066', 'Nguyễn Bá Nhật',         1, 4, NULL, NULL, true,  false, '{"F018"}', '{}',       NULL, NULL),

-- ── Đời 5: con F018 (Nguyễn Bá Nhật + Phan Thị Minh Thu) ───
('P067', 'Nguyễn Bảo Long',        1, 5, NULL, NULL, true,  false, '{}',       '{"F018"}', NULL, NULL)

ON CONFLICT (handle) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. FAMILIES                                            ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO families (handle, father_handle, mother_handle, children) VALUES

-- F010: Dượng Yên + Ô Nhiên → 8 con (thứ tự xuất hiện trong tài liệu)
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

-- F016: Leonel + Phan Thu Tình → 1 con (Phan Khánh Linh - con cả)
('F016', 'P046', 'P038', '{"P063"}'),

-- F017: Nguyễn Hoàng Tân + Phan Thanh Thúy → 2 con
('F017', 'P047', 'P039', '{"P064","P065"}'),

-- F018: Nguyễn Bá Nhật + Phan Thị Minh Thu → 1 con (đời 5)
('F018', 'P066', 'P051', '{"P067"}')

ON CONFLICT (handle) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. UPDATE: Thêm Ô Nhiên vào F001 (con của Phạm Hướng) ║
-- ╚══════════════════════════════════════════════════════════╝

UPDATE families
SET children = array_append(children, 'P031')
WHERE handle = 'F001'
  AND NOT ('P031' = ANY(children));


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. VERIFY                                              ║
-- ╚══════════════════════════════════════════════════════════╝

-- Kiểm tra 37 người mới
SELECT handle, display_name, gender, generation, is_patrilineal, is_living,
       families, parent_families
FROM people
WHERE handle BETWEEN 'P031' AND 'P067'
ORDER BY handle;

-- Kiểm tra 9 gia đình mới
SELECT handle, father_handle, mother_handle,
       array_length(children, 1) AS so_con, children
FROM families
WHERE handle BETWEEN 'F010' AND 'F018'
ORDER BY handle;

-- Kiểm tra F001 đã có Ô Nhiên (P031) chưa
SELECT handle, children AS tat_ca_con_cua_pham_huong
FROM families
WHERE handle = 'F001';

-- Kiểm tra orphan: người có parent_families nhưng không tìm được gia đình đó
SELECT p.handle, p.display_name, unnest(p.parent_families) AS missing_family
FROM people p
WHERE p.handle BETWEEN 'P031' AND 'P067'
  AND NOT EXISTS (
    SELECT 1 FROM families f
    WHERE f.handle = ANY(p.parent_families)
  )
  AND array_length(p.parent_families, 1) > 0;

COMMIT;
