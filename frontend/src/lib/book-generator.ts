/**
 * Book Generator — Transforms genealogy tree data into a structured book format.
 *
 * Produces chapters by generation, with each patrilineal person getting
 * a full entry showing parents, spouse, and children.
 */

import type { TreeNode, TreeFamily } from './tree-layout';

// ═══ Book Data Types ═══

export interface BookPerson {
    handle: string;
    name: string;
    gender: number;
    birthDate?: string;
    deathDate?: string;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPatrilineal: boolean;
    generation: number;
    fatherName?: string;
    motherName?: string;
    spouseName?: string;
    spouseYears?: string;
    spouseNote?: string; // "(Ngoại tộc)"
    children: { name: string; years: string; note?: string }[];
    childIndex?: number; // thứ tự con trong gia đình (1, 2, 3...)
    avatarUrl?: string;
}

export interface BookChapter {
    generation: number;
    title: string;         // "ĐỜI THỨ I — THỦY TỔ"
    romanNumeral: string;  // "I", "II", etc.
    members: BookPerson[];
}

export interface BookData {
    familyName: string;
    exportDate: string;
    totalGenerations: number;
    totalMembers: number;
    totalPatrilineal: number;
    chapters: BookChapter[];
    nameIndex: { name: string; generation: number; isPatrilineal: boolean; isAffiliated: boolean }[];
}

// ═══ Helpers ═══

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const GEN_NAMES: Record<number, string> = {
    0: 'THỦY TỔ',
};

function romanNumeral(n: number): string {
    return ROMAN[n] || `${n + 1}`;
}

function genTitle(gen: number): string {
    const roman = romanNumeral(gen);
    const name = GEN_NAMES[gen] || '';
    return name ? `ĐỜI THỨ ${roman} — ${name}` : `ĐỜI THỨ ${roman}`;
}

function formatYears(birth?: number, death?: number, isLiving?: boolean): string {
    if (!birth) return '—';
    if (death) return `${birth} – ${death}`;
    if (isLiving) return `${birth} – nay`;
    return `${birth}`;
}

// ═══ Main Generator ═══

export function generateBookData(
    people: TreeNode[],
    families: TreeFamily[],
    familyName: string = 'Phạm',
    clanHandle?: string,
): BookData {
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(families.map(f => [f.handle, f]));

    // Determine if a person is a "main member" of this book.
    // isPatrilineal is the primary criterion (correctly set for Phạm and any clan with proper data).
    // Fallback: if the dataset has NO patrilineal members at all (e.g. a new clan whose data
    // hasn't been tagged yet), treat everyone as main to avoid empty chapters.
    const hasAnyPatrilineal = people.some(p => p.isPatrilineal);
    const isMainMember = (p: TreeNode): boolean =>
        hasAnyPatrilineal ? p.isPatrilineal : true;

    // Determine if a person is "external" (Ngoại tộc) for spouse/child notes.
    const isExternal = (p: TreeNode): boolean =>
        hasAnyPatrilineal ? !p.isPatrilineal : false;

    // ── Step 1: Assign generations from DB (1-based → 0-based) ──
    // DB generation is the source of truth (auto-computed when members are added).
    // A BFS approach had a race condition where non-Phạm spouses (root nodes)
    // could corrupt the generation of their in-tree partner and children.
    const generations = new Map<string, number>();
    for (const p of people) {
        generations.set(p.handle, Math.max(0, p.generation - 1));
    }

    // ── Step 2: Build person entries ──
    const bookPersons: BookPerson[] = [];

    // Group by generation
    const genGroups = new Map<number, TreeNode[]>();
    for (const p of people) {
        const gen = generations.get(p.handle) ?? 0;
        if (!genGroups.has(gen)) genGroups.set(gen, []);
        genGroups.get(gen)!.push(p);
    }

    // For each main member, build a BookPerson entry
    for (const p of people) {
        if (!isMainMember(p)) continue;

        const gen = generations.get(p.handle) ?? 0;

        // Find parent info
        let fatherName: string | undefined;
        let motherName: string | undefined;
        for (const pfId of p.parentFamilies) {
            const pf = familyMap.get(pfId);
            if (pf) {
                if (pf.fatherHandle) {
                    const father = personMap.get(pf.fatherHandle);
                    if (father) fatherName = father.displayName;
                }
                if (pf.motherHandle) {
                    const mother = personMap.get(pf.motherHandle);
                    if (mother) motherName = mother.displayName;
                }
            }
        }

        // Find spouse and children from families where this person is a parent
        let spouseName: string | undefined;
        let spouseYears: string | undefined;
        let spouseNote: string | undefined;
        const children: BookPerson['children'] = [];

        for (const famId of p.families) {
            const fam = familyMap.get(famId);
            if (!fam) continue;

            // Determine spouse
            const spouseHandle = fam.fatherHandle === p.handle ? fam.motherHandle : fam.fatherHandle;
            if (spouseHandle) {
                const spouse = personMap.get(spouseHandle);
                if (spouse) {
                    spouseName = spouse.displayName;
                    spouseYears = formatYears(spouse.birthYear, spouse.deathYear, spouse.isLiving);
                    if (isExternal(spouse)) spouseNote = 'Ngoại tộc';
                }
            }

            // Children
            for (let i = 0; i < fam.children.length; i++) {
                const childHandle = fam.children[i];
                const child = personMap.get(childHandle);
                if (child) {
                    children.push({
                        name: child.displayName,
                        years: formatYears(child.birthYear, child.deathYear, child.isLiving),
                        note: isExternal(child) ? 'Ngoại tộc' : undefined,
                    });
                }
            }
        }

        // Find child index within parent family
        let childIndex: number | undefined;
        if (p.parentFamilies.length > 0) {
            const pf = familyMap.get(p.parentFamilies[0]);
            if (pf) {
                const idx = pf.children.indexOf(p.handle);
                if (idx >= 0) childIndex = idx + 1;
            }
        }

        bookPersons.push({
            handle: p.handle,
            name: p.displayName,
            gender: p.gender,
            birthDate: p.birthDate,
            deathDate: p.deathDate,
            birthYear: p.birthYear,
            deathYear: p.deathYear,
            isLiving: p.isLiving,
            isPatrilineal: p.isPatrilineal,
            generation: gen,
            fatherName,
            motherName,
            spouseName,
            spouseYears,
            spouseNote,
            children,
            childIndex,
            avatarUrl: p.avatarUrl,
        });
    }

    // ── Step 3: Build chapters ──
    const maxGen = Math.max(...Array.from(generations.values()));
    const chapters: BookChapter[] = [];

    for (let g = 0; g <= maxGen; g++) {
        const members = bookPersons
            .filter(bp => bp.generation === g)
            .sort((a, b) => (a.childIndex ?? 99) - (b.childIndex ?? 99));

        if (members.length === 0) continue;

        chapters.push({
            generation: g,
            title: genTitle(g),
            romanNumeral: romanNumeral(g),
            members,
        });
    }

    // ── Step 4: Build name index ──
    const nameIndex = people
        .map(p => ({
            name: p.displayName,
            generation: generations.get(p.handle) ?? 0,
            isPatrilineal: p.isPatrilineal,
            isAffiliated: p.isAffiliatedFamily ?? false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
        familyName,
        exportDate: new Date().toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric',
        }),
        totalGenerations: maxGen + 1,
        totalMembers: people.length,
        totalPatrilineal: people.filter(p => isMainMember(p)).length,
        chapters,
        nameIndex,
    };
}
