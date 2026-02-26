-- ============================================================
-- 📸 Media Storage — Migration
-- ============================================================
-- Tạo bảng media nếu chưa có, thêm cột storage, RLS,
-- và Supabase Storage bucket
-- ============================================================

-- ── Tạo bảng media (hoặc thêm cột nếu đã có) ─────────────
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
    -- Storage fields
    storage_path  TEXT,
    storage_url   TEXT,
    thumbnail_url TEXT,
    linked_person TEXT,
    media_type    TEXT        NOT NULL DEFAULT 'IMAGE'
                              CHECK (media_type IN ('IMAGE', 'DOCUMENT')),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Nếu bảng đã tồn tại với FK cũ trỏ auth.users, đổi lại sang profiles
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_uploader_id_fkey;
ALTER TABLE media ADD CONSTRAINT media_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES profiles(id) ON DELETE SET NULL;


-- Thêm cột nếu bảng đã tồn tại nhưng thiếu cột
ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_path  TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_url   TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS linked_person TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS media_type    TEXT DEFAULT 'IMAGE';

-- Thêm CHECK constraint cho media_type nếu chưa có
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'media_media_type_check'
    ) THEN
        ALTER TABLE media ADD CONSTRAINT media_media_type_check
            CHECK (media_type IN ('IMAGE', 'DOCUMENT'));
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_linked_person ON media (linked_person);
CREATE INDEX IF NOT EXISTS idx_media_state         ON media (state);
CREATE INDEX IF NOT EXISTS idx_media_uploader      ON media (uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_created       ON media (created_at DESC);

-- ── RLS (bắt buộc đăng nhập — không có guest) ────────────
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có để tránh xung đột
DROP POLICY IF EXISTS "anyone can read published media"  ON media;
DROP POLICY IF EXISTS "authenticated can read media"     ON media;
DROP POLICY IF EXISTS "admin or editor can read all media" ON media;
DROP POLICY IF EXISTS "authenticated can insert media"   ON media;
DROP POLICY IF EXISTS "admin or editor or owner can update media" ON media;
DROP POLICY IF EXISTS "admin or owner can delete media"  ON media;

-- Member thấy PUBLISHED + ảnh của mình
CREATE POLICY "authenticated can read media"
    ON media FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (state = 'PUBLISHED' OR auth.uid() = uploader_id)
    );

-- Admin/editor thấy tất cả
CREATE POLICY "admin or editor can read all media"
    ON media FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

CREATE POLICY "authenticated can insert media"
    ON media FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = uploader_id);

CREATE POLICY "admin or editor or owner can update media"
    ON media FOR UPDATE
    USING (
        auth.uid() = uploader_id
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

CREATE POLICY "admin or owner can delete media"
    ON media FOR DELETE
    USING (
        auth.uid() = uploader_id
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── Supabase Storage bucket ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "authenticated can upload to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "public can view media bucket"             ON storage.objects;
DROP POLICY IF EXISTS "uploader or admin can delete from media bucket" ON storage.objects;

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

SELECT '✅ Media storage migration complete!' AS status;
