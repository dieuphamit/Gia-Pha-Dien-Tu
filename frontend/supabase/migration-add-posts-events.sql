-- ============================================================
-- Migration: Tạo bảng posts, post_comments, events, event_rsvps
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Sửa ràng buộc role của profiles để cho phép 'member' ─
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'member', 'viewer'));

-- Cập nhật user hiện có có role 'viewer' thành 'member' (nếu muốn)
-- UPDATE profiles SET role = 'member' WHERE role = 'viewer';


-- ── 2. Bảng posts (Bảng tin) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type        TEXT DEFAULT 'general',
    title       TEXT,
    body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
    is_pinned   BOOLEAN DEFAULT false,
    status      TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft', 'hidden')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_status  ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned  ON posts(is_pinned DESC);

CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS cho posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được bài đã publish
CREATE POLICY "anyone can read posts" ON posts
    FOR SELECT USING (status = 'published');

-- Chỉ admin mới được tạo bài
CREATE POLICY "admin can insert posts" ON posts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Chỉ admin mới được cập nhật (ghim/bỏ ghim)
CREATE POLICY "admin can update posts" ON posts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin hoặc chủ bài được xóa
CREATE POLICY "admin or owner can delete posts" ON posts
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- ── 3. Bảng post_comments (bình luận bài tin) ─────────────────

CREATE TABLE IF NOT EXISTS post_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

-- RLS cho post_comments
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được
CREATE POLICY "anyone can read post_comments" ON post_comments
    FOR SELECT USING (true);

-- Thành viên đã đăng nhập có thể bình luận
CREATE POLICY "authenticated can insert post_comments" ON post_comments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        auth.uid() = author_id
    );

-- Chủ comment hoặc admin được xóa
CREATE POLICY "owner or admin can delete post_comments" ON post_comments
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- ── 4. Bảng events (Sự kiện) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    description  TEXT,
    start_at     TIMESTAMPTZ NOT NULL,
    end_at       TIMESTAMPTZ,
    location     TEXT,
    type         TEXT DEFAULT 'OTHER' CHECK (type IN ('MEMORIAL', 'MEETING', 'FESTIVAL', 'OTHER')),
    is_recurring BOOLEAN DEFAULT false,
    creator_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at DESC);

-- RLS cho events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được
CREATE POLICY "anyone can read events" ON events
    FOR SELECT USING (true);

-- Chỉ admin mới được tạo sự kiện
CREATE POLICY "admin can insert events" ON events
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin hoặc người tạo được cập nhật
CREATE POLICY "admin or creator can update events" ON events
    FOR UPDATE USING (
        creator_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin hoặc người tạo được xóa
CREATE POLICY "admin or creator can delete events" ON events
    FOR DELETE USING (
        creator_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- ── 5. Bảng event_rsvps (đăng ký tham dự) ────────────────────

CREATE TABLE IF NOT EXISTS event_rsvps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status     TEXT DEFAULT 'GOING' CHECK (status IN ('GOING', 'MAYBE', 'NOT_GOING')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);

-- RLS cho event_rsvps
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được
CREATE POLICY "anyone can read event_rsvps" ON event_rsvps
    FOR SELECT USING (true);

-- Thành viên đã đăng nhập đăng ký tham dự của chính mình
CREATE POLICY "user can insert own rsvp" ON event_rsvps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Thành viên cập nhật RSVP của chính mình
CREATE POLICY "user can update own rsvp" ON event_rsvps
    FOR UPDATE USING (auth.uid() = user_id);


-- ── Verify ────────────────────────────────────────────────────
SELECT '✅ Migration posts/events complete!' AS status;
