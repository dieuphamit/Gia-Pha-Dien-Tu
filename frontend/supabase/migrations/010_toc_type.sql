-- Migration 010: Replace 2-boolean toc system with single toc_type enum + trigger
-- Chính tộc  = surname matches clan (auto) OR admin override
-- Thân tộc   = not chính tộc + has parent_families in system
-- Ngoại tộc  = not chính tộc + no parent_families

-- ══════════════════════════════════════════════════════════════
-- 1. Add surname_patterns to clans table
-- ══════════════════════════════════════════════════════════════

ALTER TABLE clans ADD COLUMN IF NOT EXISTS surname_patterns TEXT[] DEFAULT '{}';

UPDATE clans SET surname_patterns = ARRAY['Phạm', 'Pham'] WHERE handle = 'pham';
UPDATE clans SET surname_patterns = ARRAY['Đinh', 'Dinh'] WHERE handle = 'dinh';
UPDATE clans SET surname_patterns = ARRAY['Ngô', 'Ngo']   WHERE handle = 'ngo';

-- ══════════════════════════════════════════════════════════════
-- 2. Add toc_type and toc_override to people table
-- ══════════════════════════════════════════════════════════════

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS toc_type TEXT DEFAULT 'ngoai'
    CHECK (toc_type IN ('chinh', 'than', 'ngoai'));

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS toc_override BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════════
-- 3. Trigger function: auto-compute toc_type
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_toc_type()
RETURNS TRIGGER AS $$
DECLARE
  v_patterns TEXT[];
  v_surname  TEXT;
BEGIN
  -- Admin override: giữ nguyên toc_type, không tính lại
  IF NEW.toc_override = true THEN
    RETURN NEW;
  END IF;

  -- Không có clan chính → ngoại tộc
  IF NEW.clan_handle IS NULL THEN
    NEW.toc_type := 'ngoai';
    RETURN NEW;
  END IF;

  -- Lấy surname patterns của clan chính
  SELECT surname_patterns INTO v_patterns
  FROM clans
  WHERE handle = NEW.clan_handle;

  -- Trích họ: từ đầu tiên trong display_name (vd: "Phạm Văn A" → "Phạm")
  v_surname := split_part(NEW.display_name, ' ', 1);

  -- Chính tộc: họ khớp với clan
  IF v_patterns IS NOT NULL AND v_surname = ANY(v_patterns) THEN
    NEW.toc_type := 'chinh';
    RETURN NEW;
  END IF;

  -- Thân tộc: có cha/mẹ trong hệ thống
  IF NEW.parent_families IS NOT NULL AND array_length(NEW.parent_families, 1) > 0 THEN
    NEW.toc_type := 'than';
    RETURN NEW;
  END IF;

  -- Còn lại: ngoại tộc
  NEW.toc_type := 'ngoai';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_toc_type
  BEFORE INSERT OR UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION compute_toc_type();

-- ══════════════════════════════════════════════════════════════
-- 4. Backfill: trigger tự tính lại toc_type cho toàn bộ dữ liệu
-- ══════════════════════════════════════════════════════════════

-- Trigger BEFORE UPDATE sẽ kích hoạt và tính toc_type
UPDATE people SET toc_override = false WHERE toc_override IS NULL;

-- ══════════════════════════════════════════════════════════════
-- 5. Deprecate is_affiliated_family (giữ column, chỉ comment)
-- ══════════════════════════════════════════════════════════════

COMMENT ON COLUMN people.is_affiliated_family IS
  'DEPRECATED: dùng toc_type thay thế. Sẽ xóa ở migration tiếp theo.';

COMMENT ON COLUMN people.is_patrilineal IS
  'DEPRECATED: dùng toc_type=chinh thay thế. Sẽ xóa ở migration tiếp theo.';

-- ══════════════════════════════════════════════════════════════
-- 6. Verify
-- ══════════════════════════════════════════════════════════════

SELECT
  toc_type,
  COUNT(*) AS total
FROM people
GROUP BY toc_type
ORDER BY toc_type;
