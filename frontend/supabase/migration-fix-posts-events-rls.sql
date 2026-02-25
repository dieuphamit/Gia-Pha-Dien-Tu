-- ============================================================
-- Migration: Cho phép editor tạo bài viết và sự kiện
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Fix RLS posts: cho editor insert ──────────────────────

DROP POLICY IF EXISTS "admin can insert posts" ON posts;
CREATE POLICY "admin or editor can insert posts" ON posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

DROP POLICY IF EXISTS "admin can update posts" ON posts;
CREATE POLICY "admin or editor can update posts" ON posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

DROP POLICY IF EXISTS "admin or owner can delete posts" ON posts;
CREATE POLICY "admin or editor or owner can delete posts" ON posts
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );


-- ── 2. Fix RLS events: cho editor insert ─────────────────────

DROP POLICY IF EXISTS "admin can insert events" ON events;
CREATE POLICY "admin or editor can insert events" ON events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

DROP POLICY IF EXISTS "admin or creator can update events" ON events;
CREATE POLICY "admin or editor or creator can update events" ON events
    FOR UPDATE USING (
        creator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

DROP POLICY IF EXISTS "admin or creator can delete events" ON events;
CREATE POLICY "admin or editor or creator can delete events" ON events
    FOR DELETE USING (
        creator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    );


-- ── Verify ───────────────────────────────────────────────────
SELECT '✅ Migration fix posts/events RLS hoàn thành!' AS status;
