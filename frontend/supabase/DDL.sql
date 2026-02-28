-- ============================================================
-- 🌳 Gia Phả Điện Tử — DDL (Data Definition Language)
-- ============================================================
-- Tạo toàn bộ cấu trúc database từ đầu:
--   tables, indexes, functions, triggers, views, RLS
-- Chạy file này TRƯỚC DML.sql
--
-- Tables (17):
--   Core     : people, families
--   Auth     : profiles, invite_links
--   Content  : contributions, comments, posts, post_comments
--   Community: events, event_rsvps, family_questions, notifications
--   Admin    : audit_logs, app_settings, bug_reports, media
--   Infra    : birthday_notifications
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  SHARED: Trigger function update_updated_at             ║
-- ╚══════════════════════════════════════════════════════════╝

-- Dùng chung cho tất cả bảng có cột updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. people + families (cốt lõi gia phả)                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS people (
    handle               TEXT         PRIMARY KEY,
    gramps_id            TEXT,
    gender               INT          NOT NULL DEFAULT 1,     -- 1=Nam, 2=Nữ
    display_name         TEXT         NOT NULL,
    surname              TEXT,
    first_name           TEXT,
    generation           INT          DEFAULT 1,
    chi                  INT,
    birth_year           INT,
    birth_date           DATE,
    birth_place          TEXT,
    death_year           INT,
    death_date           DATE,
    death_place          TEXT,
    is_living            BOOLEAN      DEFAULT true,
    is_privacy_filtered  BOOLEAN      DEFAULT false,
    is_patrilineal       BOOLEAN      DEFAULT true,           -- true=chính tộc, false=ngoại tộc
    is_affiliated_family BOOLEAN      DEFAULT false,          -- true=gần họ Phạm dù không mang huyết thống (admin set)
    families             TEXT[]       DEFAULT '{}',           -- family handles mà người này là cha/mẹ
    parent_families      TEXT[]       DEFAULT '{}',           -- family handles mà người này là con
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
    avatar_url           TEXT,                                   -- ảnh đại diện chính (từ media table)
    created_at           TIMESTAMPTZ  DEFAULT now(),
    updated_at           TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    handle         TEXT        PRIMARY KEY,
    father_handle  TEXT,
    mother_handle  TEXT,
    children       TEXT[]      DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_generation   ON people (generation);
CREATE INDEX IF NOT EXISTS idx_people_surname      ON people (surname);
CREATE INDEX IF NOT EXISTS idx_people_birth_month_day
    ON people (EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
    WHERE birth_date IS NOT NULL AND is_living = true;
CREATE INDEX IF NOT EXISTS idx_families_father   ON families (father_handle);
CREATE INDEX IF NOT EXISTS idx_families_mother   ON families (mother_handle);

CREATE TRIGGER people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER families_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. profiles (xác thực & phân quyền)                   ║
-- ╚══════════════════════════════════════════════════════════╝

-- Roles: admin > editor > member
-- Status: pending (chờ duyệt) → active | rejected | suspended
CREATE TABLE IF NOT EXISTS profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT        UNIQUE NOT NULL,
    display_name  TEXT,
    role          TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('admin', 'editor', 'member')),
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    person_handle TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Tự động tạo profile khi user đăng ký.
-- Fault-tolerant: lỗi trigger không block đăng ký;
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
            NULL;  -- bỏ qua lỗi, profile sẽ được tạo qua API route
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
-- ║  3. contributions (đề xuất chỉnh sửa)                  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS contributions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email  TEXT,
    person_handle TEXT,
    person_name   TEXT,
    field_name    TEXT        NOT NULL,
    field_label   TEXT,
    old_value     TEXT,
    new_value     TEXT        NOT NULL,
    note          TEXT,
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note    TEXT,
    reviewed_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMPTZ,
    applied_at    TIMESTAMPTZ,                               -- null = chưa apply vào DB
    created_at    TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT contributions_value_length CHECK (char_length(new_value) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_contributions_status  ON contributions (status);
CREATE INDEX IF NOT EXISTS idx_contributions_person  ON contributions (person_handle);
CREATE INDEX IF NOT EXISTS idx_contributions_applied ON contributions (applied_at) WHERE applied_at IS NULL;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. comments (bình luận hồ sơ thành viên)              ║
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
-- ║  5. notifications (thông báo)                           ║
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
-- ║  6. posts + post_comments (bảng tin)                   ║
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
-- ║  7. events + event_rsvps (sự kiện gia đình)            ║
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
-- ║  8. family_questions (câu hỏi xác minh gia đình)       ║
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
-- ║  9. invite_links (mã mời thành viên)                   ║
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
-- ║  10. audit_logs (lịch sử hành động editor/admin)       ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL
                            CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
    entity_type TEXT        NOT NULL,   -- 'people' | 'families' | 'contribution' | 'profile' | ...
    entity_id   TEXT,                   -- handle hoặc UUID của đối tượng
    entity_name TEXT,                   -- tên hiển thị (display_name, email, ...)
    metadata    JSONB,                  -- chi tiết thay đổi (fields, old/new values, ...)
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs (entity_type, entity_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  11. app_settings (bật/tắt tính năng)                  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT        PRIMARY KEY,
    value       TEXT        NOT NULL,
    description TEXT,
    updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  12. bug_reports (báo cáo lỗi từ thành viên)           ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS bug_reports (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    category           TEXT        NOT NULL
                                   CHECK (category IN (
                                       'display_error', 'feature_not_working',
                                       'wrong_information', 'loading_error',
                                       'suggestion', 'other'
                                   )),
    title              TEXT        NOT NULL,
    description        TEXT        NOT NULL,
    steps_to_reproduce TEXT,
    status             TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'in_progress', 'resolved')),
    admin_note         TEXT,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter ON bug_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status   ON bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created  ON bug_reports (created_at DESC);

DROP TRIGGER IF EXISTS trg_bug_reports_updated_at ON bug_reports;
CREATE TRIGGER trg_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  13. media (thư viện hình ảnh & tài liệu)              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS media (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name     TEXT        NOT NULL,
    mime_type     TEXT,
    file_size     BIGINT,
    title         TEXT,
    description   TEXT,
    state         TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (state IN ('PENDING', 'PUBLISHED', 'REJECTED')),
    -- FK → profiles (public schema) để PostgREST resolve join media→profiles
    uploader_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    storage_path  TEXT,
    storage_url   TEXT,
    thumbnail_url TEXT,
    linked_person TEXT,
    media_type    TEXT        NOT NULL DEFAULT 'IMAGE'
                              CHECK (media_type IN ('IMAGE', 'DOCUMENT')),
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_linked_person ON media (linked_person);
CREATE INDEX IF NOT EXISTS idx_media_state         ON media (state);
CREATE INDEX IF NOT EXISTS idx_media_uploader      ON media (uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_created       ON media (created_at DESC);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  14. birthday_notifications (idempotency sinh nhật)     ║
-- ╚══════════════════════════════════════════════════════════╝

-- Tránh gửi email sinh nhật trùng nếu cron chạy lại trong ngày
CREATE TABLE IF NOT EXISTS birthday_notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    person_handle   TEXT        NOT NULL,
    sent_year       INT         NOT NULL,
    recipient_email TEXT        NOT NULL,
    sent_at         TIMESTAMPTZ DEFAULT now(),
    UNIQUE (person_handle, sent_year, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_birthday_notif_year
    ON birthday_notifications (sent_year);

ALTER TABLE birthday_notifications ENABLE ROW LEVEL SECURITY;

-- Chỉ service role được đọc/ghi (cron job dùng service key)
CREATE POLICY "service_role_only" ON birthday_notifications
    USING (false)
    WITH CHECK (false);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  15. ROW LEVEL SECURITY                                 ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── people ───────────────────────────────────────────────────
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read people"
    ON people FOR SELECT USING (true);
CREATE POLICY "authenticated can insert people"
    ON people FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated can update people"
    ON people FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin can delete people"
    ON people FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── families ─────────────────────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read families"
    ON families FOR SELECT USING (true);
CREATE POLICY "authenticated can insert families"
    ON families FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated can update families"
    ON families FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin can delete families"
    ON families FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read profiles"
    ON profiles FOR SELECT USING (true);
CREATE POLICY "users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users or admin can update profile"
    ON profiles FOR UPDATE USING (
        auth.uid() = id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── contributions ────────────────────────────────────────────
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read contributions"
    ON contributions FOR SELECT USING (true);
CREATE POLICY "users can insert contributions"
    ON contributions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "admin or editor can update contributions"
    ON contributions FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

-- ── comments ─────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read comments"
    ON comments FOR SELECT USING (true);
CREATE POLICY "users can insert comments"
    ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "owner or admin can delete comments"
    ON comments FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── notifications ────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
    ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications"
    ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "authenticated can insert notifications"
    ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── posts ────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read posts"
    ON posts FOR SELECT USING (status = 'published');
CREATE POLICY "admin or editor can insert posts"
    ON posts FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "admin or editor can update posts"
    ON posts FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "admin or author can delete posts"
    ON posts FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── post_comments ────────────────────────────────────────────
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read post_comments"
    ON post_comments FOR SELECT USING (true);
CREATE POLICY "authenticated can insert post_comments"
    ON post_comments FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND auth.uid() = author_id
    );
CREATE POLICY "owner or admin can delete post_comments"
    ON post_comments FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── events ───────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read events"
    ON events FOR SELECT USING (true);
CREATE POLICY "admin or editor can insert events"
    ON events FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "admin or editor or creator can update events"
    ON events FOR UPDATE USING (
        creator_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "admin or creator can delete events"
    ON events FOR DELETE USING (
        creator_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── event_rsvps ──────────────────────────────────────────────
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read event_rsvps"
    ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "user can insert own rsvp"
    ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can update own rsvp"
    ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);

-- ── family_questions ─────────────────────────────────────────
ALTER TABLE family_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access on family_questions"
    ON family_questions FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── invite_links ─────────────────────────────────────────────
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can manage invite_links"
    ON invite_links USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "authenticated can read invite_links"
    ON invite_links FOR SELECT USING (auth.role() = 'authenticated');

-- ── audit_logs ───────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Chỉ admin được đọc log
CREATE POLICY "admin can read audit_logs"
    ON audit_logs FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
-- Editor/admin được ghi log từ client
CREATE POLICY "editor or admin can insert audit_logs"
    ON audit_logs FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
-- Service role (API routes dùng service key) được ghi log
CREATE POLICY "service role can insert audit_logs"
    ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── app_settings ─────────────────────────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Mọi user đăng nhập đều đọc được (sidebar cần đọc)
CREATE POLICY "authenticated can read app_settings"
    ON app_settings FOR SELECT USING (auth.role() = 'authenticated');
-- Chỉ admin được ghi
CREATE POLICY "admin can manage app_settings"
    ON app_settings FOR ALL
    USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── bug_reports ──────────────────────────────────────────────
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Admin thấy toàn bộ
CREATE POLICY "admin can read all bug_reports"
    ON bug_reports FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
-- Member chỉ thấy bug của chính mình
CREATE POLICY "member can read own bug_reports"
    ON bug_reports FOR SELECT USING (reporter_id = auth.uid());
-- Mọi user đã đăng nhập được tạo bug report
CREATE POLICY "authenticated can insert bug_reports"
    ON bug_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Chỉ admin được cập nhật status / admin_note
CREATE POLICY "admin can update bug_reports"
    ON bug_reports FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── media ────────────────────────────────────────────────────
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Member thấy PUBLISHED + ảnh của mình
CREATE POLICY "authenticated can read media"
    ON media FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (state = 'PUBLISHED' OR auth.uid() = uploader_id)
    );
-- Admin/editor thấy tất cả
CREATE POLICY "admin or editor can read all media"
    ON media FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "authenticated can insert media"
    ON media FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND auth.uid() = uploader_id
    );
CREATE POLICY "admin or editor or owner can update media"
    ON media FOR UPDATE USING (
        auth.uid() = uploader_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "admin or owner can delete media"
    ON media FOR DELETE USING (
        auth.uid() = uploader_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── storage.objects (Supabase Storage bucket: media) ─────────
CREATE POLICY "authenticated can upload to media bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "public can view media bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'media');

CREATE POLICY "uploader or admin can delete from media bucket"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'media'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );


-- ============================================================
SELECT '✅ DDL setup complete! Chạy DML.sql để nạp dữ liệu mẫu.' AS status;
-- ============================================================
