-- Migration 012: Add clan_handles to posts, events, media
-- Existing data defaults to 'pham' clan

-- posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS clan_handles TEXT[] DEFAULT '{}';
UPDATE posts SET clan_handles = ARRAY['pham'] WHERE clan_handles = '{}';
CREATE INDEX IF NOT EXISTS idx_posts_clan_handles ON posts USING GIN(clan_handles);

-- events
ALTER TABLE events ADD COLUMN IF NOT EXISTS clan_handles TEXT[] DEFAULT '{}';
UPDATE events SET clan_handles = ARRAY['pham'] WHERE clan_handles = '{}';
CREATE INDEX IF NOT EXISTS idx_events_clan_handles ON events USING GIN(clan_handles);

-- media
ALTER TABLE media ADD COLUMN IF NOT EXISTS clan_handles TEXT[] DEFAULT '{}';
UPDATE media SET clan_handles = ARRAY['pham'] WHERE clan_handles = '{}';
CREATE INDEX IF NOT EXISTS idx_media_clan_handles ON media USING GIN(clan_handles);
