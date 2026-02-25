/**
 * Mock data for demo mode — used when Supabase is not configured
 * Dòng họ Phạm — 4 thế hệ, 10 thành viên
 */
import type { TreeNode, TreeFamily } from './tree-layout';

export const MOCK_PEOPLE: TreeNode[] = [
    // Đời 1
    { handle: 'P001', displayName: 'Phạm Hướng', gender: 1, generation: 1, birthYear: 1920, deathYear: 1995, isLiving: false, isPrivacyFiltered: false, isPatrilineal: true, families: ['F001'], parentFamilies: [] },
    // Đời 2
    { handle: 'P002', displayName: 'Phạm Quang Viên', gender: 1, generation: 2, birthYear: 1945, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F002'], parentFamilies: ['F001'] },
    // Đời 3 (con Phạm Quang Viên)
    { handle: 'P005', displayName: 'Phạm Quang Vũ', gender: 1, generation: 3, birthYear: 1970, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: ['F005'], parentFamilies: ['F002'] },
    { handle: 'P006', displayName: 'Phạm Thị Hoài Nga', gender: 2, generation: 3, birthYear: 1973, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F002'] },
    { handle: 'P009', displayName: 'Phạm Vũ Tường Vi', gender: 1, generation: 3, birthYear: 1980, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F002'] },
    { handle: 'P010', displayName: 'Phạm Thị Minh Nguyệt', gender: 2, generation: 3, birthYear: 1980, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F002'] },
    { handle: 'P011', displayName: 'Phạm Quang Diệu', gender: 1, generation: 3, birthYear: 1998, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F002'] },
    // Đời 4 (con Phạm Quang Vũ)
    { handle: 'P013', displayName: 'Phạm Trọng Nhân', gender: 1, generation: 4, birthYear: 1995, isLiving: true, isPrivacyFiltered: false, isPatrilineal: true, families: [], parentFamilies: ['F005'] },
    // Vợ (ngoại tộc)
    { handle: 'P014', displayName: 'Đinh Thị Khai', gender: 2, generation: 1, birthYear: 1925, deathYear: 2000, isLiving: false, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
    { handle: 'P015', displayName: 'Nguyễn Thị Hoài Thương', gender: 2, generation: 3, isLiving: true, isPrivacyFiltered: false, isPatrilineal: false, families: [], parentFamilies: [] },
];

export const MOCK_FAMILIES: TreeFamily[] = [
    { handle: 'F001', fatherHandle: 'P001', motherHandle: 'P014', children: ['P002'] },
    { handle: 'F002', fatherHandle: 'P002', children: ['P005', 'P006', 'P009', 'P010', 'P011'] },
    { handle: 'F005', fatherHandle: 'P005', motherHandle: 'P015', children: ['P013'] },
];

export function getMockTreeData() {
    return { people: MOCK_PEOPLE, families: MOCK_FAMILIES };
}
