-- ============================================================
-- Migration 001: Chuyển birth_date và death_date từ TEXT → DATE
-- + Migrate dữ liệu từ birth_year/death_year
-- + Thêm index cho birthday query
-- + Thêm bảng birthday_notifications để idempotency
-- ============================================================
-- Chạy trong Supabase SQL Editor

-- 1. Thay đổi kiểu cột birth_date từ TEXT → DATE
ALTER TABLE people
    ALTER COLUMN birth_date TYPE DATE
    USING CASE
        WHEN birth_date IS NOT NULL AND birth_date != '' THEN birth_date::DATE
        ELSE NULL
    END;

-- 2. Migrate birth_year → birth_date cho những record chỉ có năm (mặc định 01/01)
UPDATE people
SET birth_date = make_date(birth_year, 1, 1)
WHERE birth_year IS NOT NULL
  AND birth_date IS NULL;

-- 3. Thay đổi kiểu cột death_date từ TEXT → DATE
ALTER TABLE people
    ALTER COLUMN death_date TYPE DATE
    USING CASE
        WHEN death_date IS NOT NULL AND death_date != '' THEN death_date::DATE
        ELSE NULL
    END;

-- 4. Migrate death_year → death_date cho những record chỉ có năm
UPDATE people
SET death_date = make_date(death_year, 1, 1)
WHERE death_year IS NOT NULL
  AND death_date IS NULL;

-- 5. Index để query sinh nhật theo tháng/ngày hiệu quả
CREATE INDEX IF NOT EXISTS idx_people_birth_month_day
    ON people (EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
    WHERE birth_date IS NOT NULL AND is_living = true;

-- 6. Bảng theo dõi email sinh nhật đã gửi (idempotency)
--    Tránh gửi trùng nếu cron chạy lại trong ngày
CREATE TABLE IF NOT EXISTS birthday_notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    person_handle TEXT      NOT NULL,
    sent_year   INT         NOT NULL,
    recipient_email TEXT    NOT NULL,
    sent_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (person_handle, sent_year, recipient_email)
);

-- Index để query nhanh theo năm
CREATE INDEX IF NOT EXISTS idx_birthday_notif_year
    ON birthday_notifications (sent_year);

-- RLS: chỉ service role mới đọc/ghi được
ALTER TABLE birthday_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON birthday_notifications
    USING (false)
    WITH CHECK (false);
