-- ============================================================
-- 🌳 Gia Phả Điện Tử — Database Setup
-- ============================================================
-- Chạy file này trong: Supabase Dashboard → SQL Editor
-- File này tạo toàn bộ cấu trúc database + dữ liệu mẫu demo
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. CORE TABLES: people + families                      ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS people (
    handle TEXT PRIMARY KEY,
    gramps_id TEXT,
    gender INT NOT NULL DEFAULT 1,           -- 1=Nam, 2=Nữ
    display_name TEXT NOT NULL,
    surname TEXT,
    first_name TEXT,
    generation INT DEFAULT 1,
    chi INT,
    birth_year INT,
    birth_date TEXT,
    birth_place TEXT,
    death_year INT,
    death_date TEXT,
    death_place TEXT,
    is_living BOOLEAN DEFAULT true,
    is_privacy_filtered BOOLEAN DEFAULT false,
    is_patrilineal BOOLEAN DEFAULT true,     -- true=chính tộc, false=ngoại tộc
    families TEXT[] DEFAULT '{}',            -- family handles where this person is parent
    parent_families TEXT[] DEFAULT '{}',     -- family handles where this person is child
    phone TEXT,
    email TEXT,
    zalo TEXT,
    facebook TEXT,
    current_address TEXT,
    hometown TEXT,
    occupation TEXT,
    company TEXT,
    education TEXT,
    nick_name TEXT,
    biography TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    handle TEXT PRIMARY KEY,
    father_handle TEXT,
    mother_handle TEXT,
    children TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_generation ON people (generation);
CREATE INDEX IF NOT EXISTS idx_people_surname ON people (surname);
CREATE INDEX IF NOT EXISTS idx_families_father ON families (father_handle);
CREATE INDEX IF NOT EXISTS idx_families_mother ON families (mother_handle);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. AUTH: profiles + auto-create trigger                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    person_handle TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
    IF user_email != '' THEN
        INSERT INTO profiles (id, email, role)
        VALUES (
            NEW.id,
            user_email,
            CASE WHEN user_email = 'pqdieu.it@gmail.com' THEN 'admin' ELSE 'viewer' END
        )
        ON CONFLICT (email) DO UPDATE SET id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. CONTRIBUTIONS (đề xuất chỉnh sửa)                  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    person_handle TEXT NOT NULL,
    person_name TEXT,
    field_name TEXT NOT NULL,
    field_label TEXT,
    old_value TEXT,
    new_value TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_person ON contributions(person_handle);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. COMMENTS (bình luận)                                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    author_name TEXT,
    person_handle TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_person ON comments(person_handle);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4b. NOTIFICATIONS (thông báo)                           ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'SYSTEM',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. ROW LEVEL SECURITY (RLS)                            ║
-- ╚══════════════════════════════════════════════════════════╝

-- People & Families: public read, authenticated write, admin delete
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read people" ON people FOR SELECT USING (true);
CREATE POLICY "anyone can read families" ON families FOR SELECT USING (true);
CREATE POLICY "authenticated can update people" ON people
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated can insert people" ON people
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin can delete people" ON people
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "authenticated can update families" ON families
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated can insert families" ON families
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin can delete families" ON families
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Profiles: public read, update own or admin
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users or admin can update profile" ON profiles
    FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Contributions: public read, user insert own, admin update
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read contributions" ON contributions FOR SELECT USING (true);
CREATE POLICY "users can insert contributions" ON contributions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "admin can update contributions" ON contributions
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Comments: public read, user insert own, owner/admin delete
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "owner or admin can delete comments" ON comments
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Notifications: user reads/updates own, admin inserts
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "authenticated can insert notifications" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Constraints
ALTER TABLE comments ADD CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 2000);
ALTER TABLE contributions ADD CONSTRAINT contributions_value_length CHECK (char_length(new_value) <= 5000);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. DỮ LIỆU MẪU DEMO (xóa phần này nếu dùng dữ liệu thật)║
-- ╚══════════════════════════════════════════════════════════╝

-- Dòng họ Phạm — 5 thế hệ, 25 thành viên
-- Cấu trúc:
--   Đời 1: Phạm Hướng (F001, không có vợ trong cây)
--   Đời 2: Phạm Quang Viên + vợ Đinh Thị Khai (F002)
--   Đời 3: 8 con F002 + vợ/chồng ngoại tộc
--   Đời 4: 5 con F007 (Nga+Hải) | 1 con F005 (Vũ) | 1 con F006 (Diệu)
--   Đời 5: 2 con F008 (Dũng+Trâm)

-- People
INSERT INTO people (handle, display_name, gender, generation, birth_year, death_year, is_living, is_patrilineal, families, parent_families, current_address, occupation) VALUES
-- ── Đời 1 ─────────────────────────────────────────────────
('P001', 'Phạm Hướng',              1, 1, 1920, 1995, false, true,  '{"F001"}', '{}',        NULL,       NULL),
-- ── Đời 2 ─────────────────────────────────────────────────
('P002', 'Phạm Quang Viên',         1, 2, 1945, NULL, true,  true,  '{"F002"}', '{"F001"}',  NULL,       NULL),
('P014', 'Đinh Thị Khai',            2, 2, 1925, 2000, false, false, '{"F002"}', '{}',        NULL,       NULL),
-- ── Đời 3 (8 con F002) ────────────────────────────────────
('P005', 'Phạm Quang Vũ',           1, 3, 1970, NULL, true,  true,  '{"F005"}', '{"F002"}',  NULL,       NULL),
('P006', 'Phạm Thị Hoài Nga',       2, 3, 1974, NULL, true,  true,  '{"F007"}', '{"F002"}',  'Đồng Nai', 'Công nhân'),
('P028', 'Phạm Đăng Phương',        1, 3, NULL, NULL, true,  true,  '{}',       '{"F002"}',  NULL,       NULL),
('P029', 'Phạm Phương Anh',         2, 3, NULL, NULL, true,  true,  '{}',       '{"F002"}',  NULL,       NULL),
('P009', 'Phạm Vũ Tường Vi',        1, 3, 1980, NULL, true,  true,  '{}',       '{"F002"}',  NULL,       NULL),
('P010', 'Phạm Thị Minh Nguyệt',    2, 3, 1980, NULL, true,  true,  '{}',       '{"F002"}',  NULL,       NULL),
('P011', 'Phạm Quang Diệu',         1, 3, 1989, NULL, true,  true,  '{"F006"}', '{"F002"}',  'Japan',    'Kỹ Sư'),
('P030', 'Phạm Đăng Hiền',          1, 3, NULL, NULL, true,  true,  '{}',       '{"F002"}',  NULL,       NULL),
-- Vợ/chồng ngoại tộc Đời 3
('P015', 'Nguyễn Thị Hoài Thương',   2, 3, NULL, NULL, true,  false, '{}',       '{}',        NULL,       NULL),
('P016', 'Ngô Huỳnh Yến Tiên',       2, 3, 1991, NULL, true,  false, '{"F006"}', '{}',        'Japan',    'Nội Trợ'),
('P018', 'Nguyễn Phước Hải',         1, 3, 1970, NULL, true,  false, '{"F007"}', '{}',        'Đồng Nai', 'Bảo Vệ'),
-- ── Đời 4 ─────────────────────────────────────────────────
-- Con F005 (Phạm Quang Vũ + Nguyễn Thị Hoài Thương)
('P013', 'Phạm Trọng Nhân',         1, 4, 1995, NULL, true,  true,  '{}',       '{"F005"}',  NULL,       NULL),
-- Con F006 (Phạm Quang Diệu + Ngô Huỳnh Yến Tiên)
('P017', 'Phạm Tiên Đan',            2, 4, 2024, NULL, true,  true,  '{}',       '{"F006"}',  'Japan',    'Em bé'),
-- 5 con F007 (thứ tự lớn → nhỏ theo năm sinh)
('P019', 'Nguyễn Nữ Thuỳ Trang',    2, 4, 1996, NULL, true,  false, '{}',       '{"F007"}',  'Đồng Nai', 'Kế Toán'),
('P020', 'Nguyễn Thị Thuỳ Tiên',    2, 4, 1998, NULL, true,  false, '{"F009"}', '{"F007"}',  'Đắk Mil',  'NV Bưu Điện'),
('P021', 'Nguyễn Nữ Hoài Trâm',     2, 4, 2001, NULL, true,  false, '{"F008"}', '{"F007"}',  'TP HCM',   'NV Văn Phòng'),
('P024', 'Nguyễn Đức Triều',         1, 4, 2003, NULL, true,  false, '{}',       '{"F007"}',  'TP HCM',   'tự do'),
('P027', 'Nguyễn Phạm Đăng Doanh',  1, 4, 2009, NULL, true,  false, '{}',       '{"F007"}',  'Đồng Nai', 'Học sinh'),
-- Chồng/vợ ngoại tộc Đời 4
('P026', 'Nguyễn Ngọc Dũng',         1, 4, 1997, NULL, true,  false, '{"F008"}', '{}',        'Đắk Mil',  'tự do'),
('P025', 'Nguyễn Tạo',               1, 4, 1998, NULL, true,  false, '{"F009"}', '{}',        'Đắk Mil',  'tự do'),
-- ── Đời 5 (con F008: Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm)
('P022', 'Nguyễn Ngọc Châu Anh',    2, 5, 2017, NULL, true,  false, '{}',       '{"F008"}',  'TP HCM',   'Học sinh'),
('P023', 'Nguyễn Ngọc Linh Đan',    2, 5, 2021, NULL, true,  false, '{}',       '{"F008"}',  'Đồng Nai', 'Học sinh')
ON CONFLICT (handle) DO NOTHING;

-- Families
INSERT INTO families (handle, father_handle, mother_handle, children) VALUES
('F001', 'P001', NULL,   '{"P002"}'),
('F002', 'P002', 'P014', '{"P005","P006","P028","P029","P009","P010","P011","P030"}'),
('F005', 'P005', 'P015', '{"P013"}'),
('F006', 'P011', 'P016', '{"P017"}'),
('F007', 'P018', 'P006', '{"P019","P020","P021","P027","P024"}'),
('F008', 'P026', 'P021', '{"P022","P023"}'),
('F009', 'P025', 'P027', '{}')
ON CONFLICT (handle) DO NOTHING;


-- ============================================================
SELECT '✅ Database setup complete! Demo data loaded.' AS status;
-- ============================================================
