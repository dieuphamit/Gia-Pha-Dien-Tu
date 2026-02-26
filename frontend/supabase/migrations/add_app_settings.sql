-- ============================================================
-- 🔧 App Settings — Feature Toggle System
-- ============================================================
-- Bảng key-value để admin bật/tắt tính năng từ UI
-- Chạy trong Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT        PRIMARY KEY,
    value       TEXT        NOT NULL,
    description TEXT,
    updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Trigger: tự cập nhật updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_app_settings_updated_at();

-- Giá trị mặc định
INSERT INTO app_settings (key, value, description)
VALUES ('feature_media_enabled', 'true', 'Bật/tắt chức năng Thư viện hình ảnh & tài liệu')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES ('media_upload_limit', '5', 'Số lượng file tối đa mỗi thành viên được tải lên (admin & editor không bị giới hạn)')
ON CONFLICT (key) DO NOTHING;


-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "admin can manage app_settings"       ON app_settings;

-- Mọi user đăng nhập đều đọc được (sidebar cần đọc)
CREATE POLICY "authenticated can read app_settings"
    ON app_settings FOR SELECT
    USING (auth.role() = 'authenticated');

-- Chỉ admin được ghi
CREATE POLICY "admin can manage app_settings"
    ON app_settings FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

SELECT '✅ app_settings table created!' AS status;
