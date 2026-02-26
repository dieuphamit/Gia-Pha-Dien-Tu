-- ============================================================
-- Migration: add_bug_reports
-- Mô tả: Tạo bảng bug_reports để thành viên báo cáo lỗi,
--        admin quản lý và cập nhật trạng thái.
-- Chạy: Supabase Dashboard → SQL Editor → paste và Run
-- ============================================================

-- 1. Tạo bảng (idempotent)
CREATE TABLE IF NOT EXISTS bug_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    category            TEXT        NOT NULL
                                    CHECK (category IN ('display_error', 'feature_not_working', 'wrong_information', 'loading_error', 'suggestion', 'other')),
    title               TEXT        NOT NULL,
    description         TEXT        NOT NULL,
    steps_to_reproduce  TEXT,
    status              TEXT        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open', 'in_progress', 'resolved')),
    admin_note          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter  ON bug_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status    ON bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created   ON bug_reports (created_at DESC);

-- 3. Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bug_reports_updated_at ON bug_reports;
CREATE TRIGGER trg_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW EXECUTE FUNCTION update_bug_reports_updated_at();

-- 4. RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu đã tồn tại (idempotent)
DROP POLICY IF EXISTS "admin can read all bug_reports"       ON bug_reports;
DROP POLICY IF EXISTS "member can read own bug_reports"      ON bug_reports;
DROP POLICY IF EXISTS "authenticated can insert bug_reports" ON bug_reports;
DROP POLICY IF EXISTS "admin can update bug_reports"         ON bug_reports;

-- Admin thấy toàn bộ
CREATE POLICY "admin can read all bug_reports"
    ON bug_reports FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Member chỉ thấy bug của chính mình
CREATE POLICY "member can read own bug_reports"
    ON bug_reports FOR SELECT
    USING (reporter_id = auth.uid());

-- Mọi user đã đăng nhập được tạo bug report
CREATE POLICY "authenticated can insert bug_reports"
    ON bug_reports FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Chỉ admin được cập nhật status / admin_note
CREATE POLICY "admin can update bug_reports"
    ON bug_reports FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

SELECT '✅ bug_reports migration complete.' AS status;
