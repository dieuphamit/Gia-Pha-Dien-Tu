/**
 * Mock data for demo mode — used when Supabase is not configured
 * Dòng họ Phạm — 5 thế hệ, 25 thành viên
 */
import type { TreeNode, TreeFamily } from './tree-layout';

export const MOCK_PEOPLE: TreeNode[] = [
    // ── Đời 1 ──────────────────────────────────────────────
    { handle: 'P001', displayName: 'Phạm Hướng',             gender: 1, generation: 1, birthYear: 1920, deathYear: 1995, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true,  families: ['F001'],  parentFamilies: [] },

    // ── Đời 2 ──────────────────────────────────────────────
    { handle: 'P002', displayName: 'Phạm Quang Viên',        gender: 1, generation: 2, birthYear: 1945, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: ['F002'],  parentFamilies: ['F001'] },
    { handle: 'P014', displayName: 'Đinh Thị Khai',          gender: 2, generation: 2, birthYear: 1925, deathYear: 2000, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: ['F002'],  parentFamilies: [] },

    // ── Đời 3 (8 con F002) ─────────────────────────────────
    { handle: 'P005', displayName: 'Phạm Quang Vũ',          gender: 1, generation: 3, birthYear: 1970, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: ['F005'],  parentFamilies: ['F002'] },
    { handle: 'P006', displayName: 'Phạm Thị Hoài Nga',      gender: 2, generation: 3, birthYear: 1974, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: ['F007'],  parentFamilies: ['F002'] },
    { handle: 'P028', displayName: 'Phạm Đăng Phương',       gender: 1, generation: 3, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F002'] },
    { handle: 'P029', displayName: 'Phạm Phương Anh',        gender: 2, generation: 3, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F002'] },
    { handle: 'P009', displayName: 'Phạm Vũ Tường Vi',       gender: 1, generation: 3, birthYear: 1980, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F002'] },
    { handle: 'P010', displayName: 'Phạm Thị Minh Nguyệt',   gender: 2, generation: 3, birthYear: 1980, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F002'] },
    { handle: 'P011', displayName: 'Phạm Quang Diệu',        gender: 1, generation: 3, birthYear: 1989, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: ['F006'],  parentFamilies: ['F002'] },
    { handle: 'P030', displayName: 'Phạm Đăng Hiền',         gender: 1, generation: 3, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F002'] },
    // Vợ/chồng ngoại tộc Đời 3
    { handle: 'P015', displayName: 'Nguyễn Thị Hoài Thương', gender: 2, generation: 3, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F005'],  parentFamilies: [] },
    { handle: 'P016', displayName: 'Ngô Huỳnh Yến Tiên',     gender: 2, generation: 3, birthYear: 1991, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F006'],  parentFamilies: [] },
    { handle: 'P018', displayName: 'Nguyễn Phước Hải',       gender: 1, generation: 3, birthYear: 1970, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F007'],  parentFamilies: [] },

    // ── Đời 4 ──────────────────────────────────────────────
    // Con F005 (Phạm Quang Vũ + Nguyễn Thị Hoài Thương)
    { handle: 'P013', displayName: 'Phạm Trọng Nhân',        gender: 1, generation: 4, birthYear: 1995, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F005'] },
    // Con F006 (Phạm Quang Diệu + Ngô Huỳnh Yến Tiên)
    { handle: 'P017', displayName: 'Phạm Tiên Đan',          gender: 2, generation: 4, birthYear: 2024, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: true,  families: [],        parentFamilies: ['F006'] },
    // 5 con F007 (Nguyễn Phước Hải + Phạm Thị Hoài Nga)
    { handle: 'P019', displayName: 'Nguyễn Nữ Thuỳ Trang',  gender: 2, generation: 4, birthYear: 1996, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: [],        parentFamilies: ['F007'] },
    { handle: 'P020', displayName: 'Nguyễn Thị Thuỳ Tiên',  gender: 2, generation: 4, birthYear: 1998, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F009'],  parentFamilies: ['F007'] },
    { handle: 'P021', displayName: 'Nguyễn Nữ Hoài Trâm',   gender: 2, generation: 4, birthYear: 2001, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F008'],  parentFamilies: ['F007'] },
    { handle: 'P027', displayName: 'Nguyễn Phạm Đăng Doanh', gender: 1, generation: 4, birthYear: 2009, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: [],        parentFamilies: ['F007'] },
    { handle: 'P024', displayName: 'Nguyễn Đức Triều',       gender: 1, generation: 4, birthYear: 2003, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: [],        parentFamilies: ['F007'] },
    // Chồng/vợ ngoại tộc Đời 4
    { handle: 'P026', displayName: 'Nguyễn Ngọc Dũng',       gender: 1, generation: 4, birthYear: 1997, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F008'],  parentFamilies: [] },
    { handle: 'P025', displayName: 'Nguyễn Tạo',             gender: 1, generation: 4, birthYear: 1998, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: ['F009'],  parentFamilies: [] },

    // ── Đời 5 (con F008: Nguyễn Ngọc Dũng + Nguyễn Nữ Hoài Trâm) ──
    { handle: 'P022', displayName: 'Nguyễn Ngọc Châu Anh',  gender: 2, generation: 5, birthYear: 2017, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: [],        parentFamilies: ['F008'] },
    { handle: 'P023', displayName: 'Nguyễn Ngọc Linh Đan',  gender: 2, generation: 5, birthYear: 2021, isLiving: true,  isPrivacyFiltered: false, isPatrilineal: false, families: [],        parentFamilies: ['F008'] },
];

export const MOCK_FAMILIES: TreeFamily[] = [
    { handle: 'F001', fatherHandle: 'P001',                         children: ['P002'] },
    { handle: 'F002', fatherHandle: 'P002', motherHandle: 'P014',   children: ['P005', 'P006', 'P028', 'P029', 'P009', 'P010', 'P011', 'P030'] },
    { handle: 'F005', fatherHandle: 'P005', motherHandle: 'P015',   children: ['P013'] },
    { handle: 'F006', fatherHandle: 'P011', motherHandle: 'P016',   children: ['P017'] },
    { handle: 'F007', fatherHandle: 'P018', motherHandle: 'P006',   children: ['P019', 'P020', 'P021', 'P024', 'P027'] },
    { handle: 'F008', fatherHandle: 'P026', motherHandle: 'P021',   children: ['P022', 'P023'] },
    { handle: 'F009', fatherHandle: 'P025', motherHandle: 'P020',   children: [] },
];

export function getMockTreeData() {
    return { people: MOCK_PEOPLE, families: MOCK_FAMILIES };
}
