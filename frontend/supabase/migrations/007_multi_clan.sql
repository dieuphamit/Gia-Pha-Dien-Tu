-- Migration 007: Multi-clan support
-- Adds clans table, clan_handle columns on people/families, clan_access on profiles

-- 1. Create clans table
CREATE TABLE IF NOT EXISTS clans (
    handle       TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clans_select_all" ON clans
    FOR SELECT USING (true);

CREATE POLICY "clans_admin_all" ON clans
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 2. Seed clans
INSERT INTO clans (handle, display_name, description) VALUES
    ('pham', 'Họ Phạm', 'Gia phả dòng họ Phạm'),
    ('ngo',  'Họ Ngô',  'Gia phả dòng họ Ngô'),
    ('dinh', 'Họ Đinh', 'Gia phả dòng họ Đinh')
ON CONFLICT (handle) DO NOTHING;

-- 3. Add clan_handle to people
ALTER TABLE people
    ADD COLUMN IF NOT EXISTS clan_handle TEXT REFERENCES clans(handle);

-- 4. Add clan_handle to families
ALTER TABLE families
    ADD COLUMN IF NOT EXISTS clan_handle TEXT REFERENCES clans(handle);

-- 5. Add clan_access to profiles
--    NULL = super-admin (access to all clans)
--    {} or array = explicit whitelist
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS clan_access TEXT[] DEFAULT '{}';

-- 6. Assign all existing people to 'pham' clan
UPDATE people SET clan_handle = 'pham' WHERE clan_handle IS NULL;

-- 7. Assign all existing families to 'pham' clan
UPDATE families SET clan_handle = 'pham' WHERE clan_handle IS NULL;

-- 8. Grant existing non-admin members access to 'pham' clan
UPDATE profiles
    SET clan_access = ARRAY['pham']
    WHERE role != 'admin'
    AND (clan_access IS NULL OR clan_access = '{}');
