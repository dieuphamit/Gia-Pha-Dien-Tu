-- ============================================================
-- Migration: Cải tổ hệ thống phân quyền
-- Roles mới: admin | editor | member  (bỏ viewer, archivist)
-- Chạy trong Supabase Dashboard → SQL Editor
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. profiles — cập nhật role constraint + migrate data  ║
-- ╚══════════════════════════════════════════════════════════╝

-- Migrate viewer/archivist → member TRƯỚC khi đổi constraint
UPDATE profiles SET role = 'member' WHERE role IN ('viewer', 'archivist');

-- Đổi CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'editor', 'member'));

-- Đổi default
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'member';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. invite_links — bỏ archivist                         ║
-- ╚══════════════════════════════════════════════════════════╝

UPDATE invite_links SET role = 'member' WHERE role = 'archivist';

ALTER TABLE invite_links DROP CONSTRAINT IF EXISTS invite_links_role_check;
ALTER TABLE invite_links ADD CONSTRAINT invite_links_role_check
    CHECK (role IN ('member', 'editor'));

ALTER TABLE invite_links ALTER COLUMN role SET DEFAULT 'member';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. RLS — editor mất quyền DELETE                       ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── people ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin or editor can delete people" ON people;
CREATE POLICY "admin can delete people" ON people FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── families ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin or editor can delete families" ON families;
CREATE POLICY "admin can delete families" ON families FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── posts ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin or editor or owner can delete posts" ON posts;
CREATE POLICY "admin or author can delete posts" ON posts FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── events ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin or editor or creator can delete events" ON events;
CREATE POLICY "admin or creator can delete events" ON events FOR DELETE USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. Trigger — đổi default role thành 'member'           ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
    IF user_email != '' THEN
        BEGIN
            INSERT INTO profiles (id, email, role, status)
            VALUES (
                NEW.id,
                user_email,
                CASE WHEN user_email = 'pqdieu.it@gmail.com' THEN 'admin'  ELSE 'member' END,
                CASE WHEN user_email = 'pqdieu.it@gmail.com' THEN 'active' ELSE 'pending' END
            )
            ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
SELECT '✅ Migration roles hoàn thành! Roles mới: admin | editor | member' AS status;
-- ============================================================
