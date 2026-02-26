-- ============================================================
-- Migration: add_audit_logs
-- Mô tả: Tạo bảng audit_logs để ghi lại lịch sử hành động
--        của editor và admin (CREATE/UPDATE/DELETE/APPROVE/REJECT).
-- Chạy: Supabase Dashboard → SQL Editor → paste và Run
-- ============================================================

-- 1. Tạo bảng (idempotent)
CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action       TEXT        NOT NULL
                             CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
    entity_type  TEXT        NOT NULL,  -- 'people' | 'families' | 'contribution' | 'profile'
    entity_id    TEXT,                  -- handle hoặc UUID của đối tượng
    entity_name  TEXT,                  -- tên hiển thị (display_name, email, ...)
    metadata     JSONB,                 -- chi tiết thay đổi (fields, old/new values, ...)
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs (entity_type, entity_id);

-- 3. RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu đã tồn tại (idempotent)
DROP POLICY IF EXISTS "admin can read audit_logs"            ON audit_logs;
DROP POLICY IF EXISTS "editor or admin can insert audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "service role can insert audit_logs"   ON audit_logs;

-- Chỉ admin được đọc log
CREATE POLICY "admin can read audit_logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Editor / admin được ghi log từ client
CREATE POLICY "editor or admin can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

-- Service role (API routes dùng service key) được ghi log
CREATE POLICY "service role can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

SELECT '✅ audit_logs migration complete.' AS status;
