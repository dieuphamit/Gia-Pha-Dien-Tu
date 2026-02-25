-- ============================================================
-- Migration: Add Editor Role + Invite Links
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Cập nhật constraint role để cho phép 'editor' ────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'editor', 'member', 'viewer'));

-- Cập nhật trigger tạo user mới: default 'member' thay vì 'viewer'
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
            CASE WHEN user_email = 'pqdieu.it@gmail.com' THEN 'admin' ELSE 'member' END
        )
        ON CONFLICT (email) DO UPDATE SET id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thêm cột status vào profiles nếu chưa có
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended'));

-- ── 2. Tạo bảng invite_links ─────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_links (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT    UNIQUE NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'member'
                       CHECK (role IN ('member', 'editor', 'archivist')),
    max_uses   INT     NOT NULL DEFAULT 1,
    used_count INT     NOT NULL DEFAULT 0,
    created_by UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);

-- ── 3. RLS cho invite_links ───────────────────────────────────
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Admin được đọc, tạo, xóa
CREATE POLICY "admin can manage invite_links" ON invite_links
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Bất kỳ ai logged in đều đọc được (để validate code khi dùng)
CREATE POLICY "authenticated can read invite_links" ON invite_links
    FOR SELECT USING (auth.role() = 'authenticated');

-- ── 4. RLS cập nhật cho people/families: cho phép editor ──────
-- Editor có quyền tương đương authenticated (đã đúng với policy cũ)
-- Nhưng thêm policy cho phép editor xóa (không chỉ admin)
DROP POLICY IF EXISTS "admin can delete people" ON people;
CREATE POLICY "admin or editor can delete people" ON people
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

DROP POLICY IF EXISTS "admin can delete families" ON families;
CREATE POLICY "admin or editor can delete families" ON families
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

-- Contributions: editor cũng được duyệt (approve/reject)
DROP POLICY IF EXISTS "admin can update contributions" ON contributions;
CREATE POLICY "admin or editor can update contributions" ON contributions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

-- ── 5. Verify ─────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' ORDER BY ordinal_position;

SELECT '✅ Migration editor role + invite_links complete!' AS status;
