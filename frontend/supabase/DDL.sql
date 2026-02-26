-- ============================================================
-- 🌳 Gia Phả Điện Tử — DDL (Data Definition Language)
-- ============================================================
-- Tạo toàn bộ cấu trúc database từ đầu:
--   tables, indexes, functions, triggers, views, RLS
-- Chạy file này TRƯỚC DML.sql
-- Tổng hợp từ: database-setup.sql + tất cả migration files
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. CORE TABLES: people + families                      ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS people (
    handle               TEXT PRIMARY KEY,
    gramps_id            TEXT,
    gender               INT          NOT NULL DEFAULT 1,    -- 1=Nam, 2=Nữ
    display_name         TEXT         NOT NULL,
    surname              TEXT,
    first_name           TEXT,
    generation           INT          DEFAULT 1,
    chi                  INT,
    birth_year           INT,
    birth_date           TEXT,
    birth_place          TEXT,
    death_year           INT,
    death_date           TEXT,
    death_place          TEXT,
    is_living            BOOLEAN      DEFAULT true,
    is_privacy_filtered  BOOLEAN      DEFAULT false,
    is_patrilineal       BOOLEAN      DEFAULT true,          -- true=chính tộc, false=ngoại tộc
    families             TEXT[]       DEFAULT '{}',          -- family handles mà người này là cha/mẹ
    parent_families      TEXT[]       DEFAULT '{}',          -- family handles mà người này là con
    phone                TEXT,
    email                TEXT,
    zalo                 TEXT,
    facebook             TEXT,
    current_address      TEXT,
    hometown             TEXT,
    occupation           TEXT,
    company              TEXT,
    education            TEXT,
    nick_name            TEXT,
    biography            TEXT,
    notes                TEXT,
    created_at           TIMESTAMPTZ  DEFAULT now(),
    updated_at           TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    handle         TEXT PRIMARY KEY,
    father_handle  TEXT,
    mother_handle  TEXT,
    children       TEXT[]      DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_generation ON people (generation);
CREATE INDEX IF NOT EXISTS idx_people_surname    ON people (surname);
CREATE INDEX IF NOT EXISTS idx_families_father   ON families (father_handle);
CREATE INDEX IF NOT EXISTS idx_families_mother   ON families (mother_handle);

-- Trigger function: tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER families_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. AUTH: profiles + trigger tạo profile tự động       ║
-- ╚══════════════════════════════════════════════════════════╝

-- Roles: admin > editor > member
-- Status: pending (chờ duyệt) → active | rejected | suspended
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT        UNIQUE NOT NULL,
    display_name TEXT,
    role         TEXT        NOT NULL DEFAULT 'member'
                             CHECK (role IN ('admin', 'editor', 'member')),
    status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    person_handle TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Tự động tạo profile khi user đăng ký
-- Fault-tolerant: lỗi trigger không block quá trình đăng ký,
-- profile sẽ được tạo lại qua API route nếu trigger fail.
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
            -- Bỏ qua lỗi, profile sẽ được tạo qua API route
            NULL;
        END;
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
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    person_handle TEXT,
    person_name  TEXT,
    field_name   TEXT        NOT NULL,
    field_label  TEXT,
    old_value    TEXT,
    new_value    TEXT        NOT NULL,
    note         TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note   TEXT,
    reviewed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    applied_at   TIMESTAMPTZ,                                    -- null = chưa apply vào DB
    created_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT contributions_value_length CHECK (char_length(new_value) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_contributions_status  ON contributions (status);
CREATE INDEX IF NOT EXISTS idx_contributions_person  ON contributions (person_handle);
CREATE INDEX IF NOT EXISTS idx_contributions_applied ON contributions (applied_at) WHERE applied_at IS NULL;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. COMMENTS (bình luận hồ sơ thành viên)              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS comments (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email  TEXT,
    author_name   TEXT,
    person_handle TEXT        NOT NULL,
    content       TEXT        NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_comments_person ON comments (person_handle);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. NOTIFICATIONS (thông báo)                           ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL DEFAULT 'SYSTEM',
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    link_url   TEXT,
    is_read    BOOLEAN     DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. POSTS & POST_COMMENTS (bảng tin)                   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS posts (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    type       TEXT        DEFAULT 'general',
    title      TEXT,
    body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
    is_pinned  BOOLEAN     DEFAULT false,
    status     TEXT        DEFAULT 'published'
                           CHECK (status IN ('published', 'draft', 'hidden')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_status  ON posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned  ON posts (is_pinned DESC);

CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS post_comments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  7. EVENTS & EVENT_RSVPS (sự kiện gia đình)            ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    description  TEXT,
    start_at     TIMESTAMPTZ NOT NULL,
    end_at       TIMESTAMPTZ,
    location     TEXT,
    type         TEXT        DEFAULT 'OTHER'
                             CHECK (type IN ('MEMORIAL', 'MEETING', 'FESTIVAL', 'OTHER')),
    is_recurring BOOLEAN     DEFAULT false,
    creator_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_at DESC);

CREATE TABLE IF NOT EXISTS event_rsvps (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status     TEXT        DEFAULT 'GOING'
                           CHECK (status IN ('GOING', 'MAYBE', 'NOT_GOING')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps (event_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  8. FAMILY_QUESTIONS (câu hỏi xác minh gia đình)       ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS family_questions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    question       TEXT        NOT NULL,
    correct_answer TEXT        NOT NULL,
    hint           TEXT,
    is_active      BOOLEAN     DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- View public: ẩn correct_answer, dùng cho frontend quiz
CREATE OR REPLACE VIEW family_questions_public
WITH (security_barrier = true) AS
    SELECT id, question, hint
    FROM family_questions
    WHERE is_active = true;

GRANT SELECT ON family_questions_public TO anon, authenticated;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  9. INVITE_LINKS (mã mời thành viên)                   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS invite_links (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT        UNIQUE NOT NULL,
    role       TEXT        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('member', 'editor')),
    max_uses   INT         NOT NULL DEFAULT 1,
    used_count INT         NOT NULL DEFAULT 0,
    created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links (code);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  10. ROW LEVEL SECURITY (RLS)                           ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── people ───────────────────────────────────────────────────
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read people"            ON people FOR SELECT USING (true);
CREATE POLICY "authenticated can insert people"   ON people FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated can update people"   ON people FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin can delete people" ON people FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── families ─────────────────────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read families"            ON families FOR SELECT USING (true);
CREATE POLICY "authenticated can insert families"   ON families FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated can update families"   ON families FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin can delete families" ON families FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read profiles"         ON profiles FOR SELECT USING (true);
CREATE POLICY "users can insert own profile"     ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users or admin can update profile" ON profiles FOR UPDATE USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── contributions ────────────────────────────────────────────
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read contributions"            ON contributions FOR SELECT USING (true);
CREATE POLICY "users can insert contributions"           ON contributions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "admin or editor can update contributions" ON contributions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- ── comments ─────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read comments"          ON comments FOR SELECT USING (true);
CREATE POLICY "users can insert comments"         ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "owner or admin can delete comments" ON comments FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── notifications ────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"          ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications"        ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "authenticated can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── posts ────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read posts"                  ON posts FOR SELECT USING (status = 'published');
CREATE POLICY "admin or editor can insert posts"       ON posts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "admin or editor can update posts"       ON posts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "admin or author can delete posts" ON posts FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── post_comments ────────────────────────────────────────────
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read post_comments"            ON post_comments FOR SELECT USING (true);
CREATE POLICY "authenticated can insert post_comments"   ON post_comments FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid() = author_id
);
CREATE POLICY "owner or admin can delete post_comments" ON post_comments FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── events ───────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read events"                       ON events FOR SELECT USING (true);
CREATE POLICY "admin or editor can insert events"            ON events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "admin or editor or creator can update events" ON events FOR UPDATE USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "admin or creator can delete events" ON events FOR DELETE USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── event_rsvps ──────────────────────────────────────────────
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read event_rsvps"  ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "user can insert own rsvp"     ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can update own rsvp"     ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);

-- ── family_questions ─────────────────────────────────────────
ALTER TABLE family_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access on family_questions" ON family_questions
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── invite_links ─────────────────────────────────────────────
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can manage invite_links"       ON invite_links
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "authenticated can read invite_links" ON invite_links
    FOR SELECT USING (auth.role() = 'authenticated');


-- ╔══════════════════════════════════════════════════════════╗
-- ║  11. AUDIT_LOGS (lịch sử hành động editor/admin)        ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action       TEXT        NOT NULL
                             CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
    entity_type  TEXT        NOT NULL,  -- 'people' | 'families' | 'contribution' | 'profile' | ...
    entity_id    TEXT,                  -- handle hoặc UUID của đối tượng
    entity_name  TEXT,                  -- tên hiển thị (display_name, email, ...)
    metadata     JSONB,                 -- chi tiết thay đổi (fields, old/new values, ...)
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs (entity_type, entity_id);

-- ── audit_logs RLS ───────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Chỉ admin được đọc log
CREATE POLICY "admin can read audit_logs"
    ON audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Editor/admin được ghi log
CREATE POLICY "editor or admin can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

-- Service role (API routes) cũng được ghi log
CREATE POLICY "service role can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.role() = 'service_role');


-- ============================================================
SELECT '✅ DDL setup complete! Chạy DML.sql để nạp dữ liệu mẫu.' AS status;
-- ============================================================
