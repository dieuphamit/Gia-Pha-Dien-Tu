-- Migration 014: Link Ngô Huỳnh Yến Tiên (P016) as child of Huỳnh Thị Yến Nga's family
-- Vấn đề: P016.parent_families trỏ đến family của Huỳnh Thị Yến Nga,
--         nhưng family đó chưa có P016 trong children[] nên tree không traverse đúng.

DO $$
DECLARE
    v_yennga_handle TEXT;
    v_family_handle TEXT;
BEGIN
    -- Tìm handle của Huỳnh Thị Yến Nga
    SELECT handle INTO v_yennga_handle
    FROM people
    WHERE display_name ILIKE '%Yến Nga%'
    LIMIT 1;

    IF v_yennga_handle IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy người có tên chứa "Yến Nga"';
    END IF;

    -- Tìm family mà Huỳnh Thị Yến Nga là cha/mẹ
    SELECT handle INTO v_family_handle
    FROM families
    WHERE father_handle = v_yennga_handle
       OR mother_handle = v_yennga_handle
    ORDER BY handle
    LIMIT 1;

    IF v_family_handle IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy gia đình của % (handle: %)', v_yennga_handle, v_yennga_handle;
    END IF;

    -- Thêm P016 vào children[] nếu chưa có
    IF NOT ('P016' = ANY(
        SELECT unnest(children) FROM families WHERE handle = v_family_handle
    )) THEN
        UPDATE families
        SET children = array_append(children, 'P016')
        WHERE handle = v_family_handle;

        RAISE NOTICE 'Đã thêm P016 vào children của family %', v_family_handle;
    ELSE
        RAISE NOTICE 'P016 đã có trong children của family %', v_family_handle;
    END IF;

    -- Cập nhật P016.parent_families nếu chưa có family này
    IF NOT (v_family_handle = ANY(
        SELECT unnest(parent_families) FROM people WHERE handle = 'P016'
    )) THEN
        UPDATE people
        SET parent_families = array_append(parent_families, v_family_handle)
        WHERE handle = 'P016';

        RAISE NOTICE 'Đã thêm % vào parent_families của P016', v_family_handle;
    ELSE
        RAISE NOTICE 'P016 đã có % trong parent_families', v_family_handle;
    END IF;

    RAISE NOTICE 'Done: P016 (Ngô Huỳnh Yến Tiên) → child of % (Huỳnh Thị Yến Nga: %)',
        v_family_handle, v_yennga_handle;
END $$;

-- Verify
SELECT
    p.handle,
    p.display_name,
    p.parent_families,
    p.toc_type
FROM people p
WHERE p.handle = 'P016';

SELECT
    f.handle,
    f.father_handle,
    f.mother_handle,
    f.children
FROM families f
WHERE EXISTS (
    SELECT 1 FROM people
    WHERE display_name ILIKE '%Yến Nga%'
      AND (f.father_handle = people.handle OR f.mother_handle = people.handle)
);
