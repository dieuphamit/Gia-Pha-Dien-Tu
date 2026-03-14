/**
 * Anchor-Based Tree Layout — Strict Vertical Lines
 *
 * RULES (bắt buộc):
 *  1. Single child → directly below father (same X column)
 *  2. N children → evenly distributed around father's X column,
 *     with the father at the center of the children block
 *  3. All parent-child connections are strictly orthogonal
 *     (vertical stub → horizontal bus → vertical drops)
 *  4. No diagonal or angled lines
 */

export interface TreeNode {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number;
    birthDate?: string; // ISO DATE: "YYYY-MM-DD"
    deathYear?: number;
    deathDate?: string; // ISO DATE: "YYYY-MM-DD"
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    tocType: 'chinh' | 'than' | 'ngoai';
    tocOverride: boolean;
    /** Per-clan manual toc_type map, e.g. { pham: 'chinh', ngo: 'ngoai' } */
    clanTocMap?: Record<string, 'chinh' | 'than' | 'ngoai'>;
    /** @deprecated dùng tocType === 'chinh' thay thế */
    isPatrilineal: boolean;
    /** @deprecated dùng tocType === 'than' thay thế */
    isAffiliatedFamily?: boolean;
    families: string[];
    parentFamilies: string[];
    avatarUrl?: string;
    clanHandle?: string;
    clanHandles?: string[];
}

export interface TreeFamily {
    handle: string;
    fatherHandle?: string;
    motherHandle?: string;
    children: string[];
    marriageOrder: number;
}

export interface PositionedNode {
    node: TreeNode;
    x: number;
    y: number;
    generation: number;
}

export interface PositionedCouple {
    familyHandle: string;
    fatherPos?: PositionedNode;
    motherPos?: PositionedNode;
    midX: number;
    y: number;
    familyUnitIndex?: number;
}

export interface Connection {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    type: 'parent-child' | 'couple';
    familyUnitIndex?: number;
}

export interface LayoutResult {
    nodes: PositionedNode[];
    couples: PositionedCouple[];
    connections: Connection[];
    width: number;
    height: number;
    generations: number;
}

// Sizing
export const CARD_W = 180;
export const CARD_H = 80;
export const H_SPACE = 24;
export const V_SPACE = 80;
export const COUPLE_GAP = 8;

// ═══ Internal subtree structure ═══

// Contour: per-depth-level left/right extent from anchor
// contourLeft[d] = leftmost X offset from anchorX at depth d
// contourRight[d] = rightmost X offset from anchorX at depth d
interface Contour { left: number[]; right: number[] }

interface Subtree {
    family: TreeFamily;
    father?: TreeNode;
    mother?: TreeNode;
    patrilineal?: TreeNode;
    spouse?: TreeNode;
    children: ChildItem[];
    width: number;       // total pixel width needed for this subtree
    anchorX: number;     // patrilineal person card center X from left edge of subtree
    contour: Contour;    // per-depth contour for overlap detection
}

interface ChildItem {
    subtree?: Subtree;
    leaf?: TreeNode;
    width: number;
    anchorX: number;     // card center X from left edge of this child item
    contour: Contour;    // per-depth contour
}

// Compute minimum separation between two contours so they don't overlap
// Returns the minimum distance between the two anchors
function minSeparation(leftContour: Contour, rightContour: Contour): number {
    const maxDepth = Math.min(leftContour.right.length, rightContour.left.length);
    let minSep = 0;
    for (let d = 0; d < maxDepth; d++) {
        // At depth d, left subtree extends to rightContour[d] from its anchor
        // right subtree starts at leftContour[d] from its anchor
        // Separation needed: leftRight - rightLeft + H_SPACE
        const needed = leftContour.right[d] - rightContour.left[d] + H_SPACE;
        minSep = Math.max(minSep, needed);
    }
    // Ensure minimum separation so cards don't touch
    return Math.max(minSep, H_SPACE);
}

// Merge two contours: shift rightContour by offset and produce combined contour
function mergeContours(leftContour: Contour, rightContour: Contour, offset: number): Contour {
    const maxDepth = Math.max(leftContour.left.length, rightContour.left.length);
    const merged: Contour = { left: [], right: [] };
    for (let d = 0; d < maxDepth; d++) {
        const ll = d < leftContour.left.length ? leftContour.left[d] : Infinity;
        const rl = d < rightContour.left.length ? rightContour.left[d] + offset : Infinity;
        merged.left.push(Math.min(ll, rl));

        const lr = d < leftContour.right.length ? leftContour.right[d] : -Infinity;
        const rr = d < rightContour.right.length ? rightContour.right[d] + offset : -Infinity;
        merged.right.push(Math.max(lr, rr));
    }
    return merged;
}

// ═══ Step 1: Build subtree recursively, compute widths bottom-up ═══
//
// STRICT RULES:
//   Rule 1: Single child → child card center == parent card center (same column)
//   Rule 2: N children → parent card center == midpoint of(first child center, last child center)
//

function buildSubtree(
    family: TreeFamily,
    personMap: Map<string, TreeNode>,
    familyMap: Map<string, TreeFamily>,
    visited: Set<string>,
): Subtree | null {
    if (visited.has(family.handle)) return null;
    visited.add(family.handle);

    const father = family.fatherHandle ? personMap.get(family.fatherHandle) : undefined;
    const mother = family.motherHandle ? personMap.get(family.motherHandle) : undefined;
    const patrilineal = father?.isPatrilineal ? father : mother?.isPatrilineal ? mother : (father || mother);
    const spouse = patrilineal === father ? mother : father;

    const children: ChildItem[] = [];

    for (const childHandle of family.children) {
        const child = personMap.get(childHandle);
        if (!child) continue;

        // Find child's own family (where child is a parent).
        // Prefer the most complete family (both father + mother) to avoid picking
        // an incomplete placeholder record when duplicates exist for the same person.
        const candidateFamilies = Array.from(familyMap.values()).filter(f =>
            !visited.has(f.handle) &&
            (f.fatherHandle === childHandle || f.motherHandle === childHandle)
        );
        const childFamily = candidateFamilies.find(f => f.fatherHandle && f.motherHandle)
            ?? candidateFamilies[0];

        // If the found family's spouse has an unvisited parent family, defer this child.
        // The child's family will be built when the spouse's parent family is traversed,
        // keeping cross-clan subtrees in the correct branch of the tree.
        if (childFamily) {
            const spouseHandle = childFamily.fatherHandle === childHandle
                ? childFamily.motherHandle
                : childFamily.fatherHandle;
            const spouseNode = spouseHandle ? personMap.get(spouseHandle) : undefined;
            if (spouseNode?.parentFamilies.some(pfId => familyMap.has(pfId) && !visited.has(pfId))) {
                continue;
            }
        }

        if (childFamily) {
            const sub = buildSubtree(childFamily, personMap, familyMap, visited);
            if (sub) {
                children.push({
                    subtree: sub, width: sub.width, anchorX: sub.anchorX,
                    contour: sub.contour,
                });
            } else {
                const leafContour: Contour = {
                    left: [-CARD_W / 2],
                    right: [CARD_W / 2],
                };
                children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: leafContour });
            }
        } else {
            const leafContour: Contour = {
                left: [-CARD_W / 2],
                right: [CARD_W / 2],
            };
            children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: leafContour });
        }
    }

    // ── Compute width and anchorX ──
    const hasCouple = patrilineal && spouse;
    const coupleWidth = hasCouple ? 2 * CARD_W + COUPLE_GAP : CARD_W;
    const halfCard = CARD_W / 2;

    if (children.length === 0) {
        // Leaf family: width = couple width, anchor = patri center
        const coupleRight = hasCouple ? halfCard + COUPLE_GAP + CARD_W : halfCard;
        const parentContour: Contour = {
            left: [-halfCard],
            right: [coupleRight],
        };
        return {
            family, father, mother, patrilineal, spouse, children,
            width: coupleWidth,
            anchorX: halfCard,
            contour: parentContour,
        };
    }

    if (children.length === 1) {
        // ═══ RULE 1: Single child → parent card center == child card center ═══
        const child = children[0];
        const childAnchor = child.anchorX;

        const coupleRight = hasCouple ? halfCard + COUPLE_GAP + CARD_W : halfCard;
        const leftExtent = Math.max(halfCard, childAnchor);
        const childRightExtent = child.width - childAnchor;
        const rightExtent = Math.max(coupleRight, childRightExtent);

        // Build contour: parent at depth 0, then child contour shifted down
        const parentContourLeft = -leftExtent;
        const parentContourRight = rightExtent;
        const combinedContour: Contour = {
            left: [Math.min(-halfCard, parentContourLeft)],
            right: [Math.max(coupleRight, parentContourRight)],
        };
        // Add child contour at depth 1+
        for (let d = 0; d < child.contour.left.length; d++) {
            combinedContour.left.push(child.contour.left[d]);
            combinedContour.right.push(child.contour.right[d]);
        }

        return {
            family, father, mother, patrilineal, spouse, children,
            width: leftExtent + rightExtent,
            anchorX: leftExtent,
            contour: combinedContour,
        };
    }

    // ═══ RULE 2: N children → contour-based minimum separation ═══
    // Place children as close as possible using contour overlap detection

    // Start: first child at anchor 0
    const childOffsets: number[] = [0]; // offset of each child's anchor from first child's anchor
    let mergedChildContour: Contour = {
        left: [...children[0].contour.left],
        right: [...children[0].contour.right],
    };

    for (let i = 1; i < children.length; i++) {
        // minSeparation returns distance from merged contour's reference (child 0 anchor)
        // to the new child's anchor that prevents overlap at all depths
        const sep = minSeparation(mergedChildContour, children[i].contour);
        childOffsets.push(sep);

        // Merge contours with the new child at offset sep from first child
        mergedChildContour = mergeContours(mergedChildContour, children[i].contour, sep);
    }

    const firstAnchor = childOffsets[0];
    const lastAnchor = childOffsets[childOffsets.length - 1];
    const midpointOfAnchors = (firstAnchor + lastAnchor) / 2;

    // Parent sits at midpoint of children anchors
    // Compute total width from leftmost to rightmost extent
    let blockLeft = Infinity, blockRight = -Infinity;
    for (let i = 0; i < children.length; i++) {
        const childLeft = childOffsets[i] - children[i].anchorX;
        const childRight = childOffsets[i] + (children[i].width - children[i].anchorX);
        blockLeft = Math.min(blockLeft, childLeft);
        blockRight = Math.max(blockRight, childRight);
    }

    const childrenTotalWidth = blockRight - blockLeft;

    // Store child offsets for use in assignPositions
    // We encode them in the anchorX positions relative to the children block
    const childAnchors: number[] = childOffsets.map(o => o - blockLeft);

    // Recompute anchorX positions in the ChildItem for assignPositions compatibility
    // We need to update the total block structure
    const adjustedAnchorX = midpointOfAnchors - blockLeft;
    const leftExtent = Math.max(halfCard, adjustedAnchorX);
    const coupleRight = hasCouple ? halfCard + COUPLE_GAP + CARD_W : halfCard;
    const childrenRight = childrenTotalWidth - adjustedAnchorX;
    const rightExtent = Math.max(coupleRight, childrenRight);

    // Build combined contour: parent at depth 0, merged child contour at depth 1+
    const combinedContour: Contour = {
        left: [Math.min(-halfCard, -(adjustedAnchorX))],
        right: [Math.max(coupleRight, childrenRight)],
    };
    // Shift merged child contour so it's relative to the parent anchor
    for (let d = 0; d < mergedChildContour.left.length; d++) {
        combinedContour.left.push(mergedChildContour.left[d] - midpointOfAnchors);
        combinedContour.right.push(mergedChildContour.right[d] - midpointOfAnchors);
    }

    // Override children layout: store block-relative positions
    // We'll use a different approach in assignPositions for contour-based layout
    // Store childAnchors and blockLeft info in the subtree for assignPositions
    const subtreeResult: Subtree & { childOffsets?: number[]; blockLeft?: number } = {
        family, father, mother, patrilineal, spouse, children,
        width: leftExtent + rightExtent,
        anchorX: leftExtent,
        contour: combinedContour,
    };
    (subtreeResult as any)._childOffsets = childOffsets;
    (subtreeResult as any)._blockLeft = blockLeft;

    return subtreeResult;
}

// ═══ Step 2: Assign positions top-down ═══

function assignPositions(
    subtree: Subtree,
    startX: number,
    generation: number,
    allNodes: PositionedNode[],
    placed: Set<string>,
) {
    const { patrilineal, spouse, children, anchorX } = subtree;
    const y = generation * (CARD_H + V_SPACE);
    const patriCenterX = startX + anchorX;

    // Place patrilineal person
    if (patrilineal && !placed.has(patrilineal.handle)) {
        allNodes.push({ node: patrilineal, x: patriCenterX - CARD_W / 2, y, generation });
        placed.add(patrilineal.handle);
    }

    // Place spouse (right of patrilineal)
    if (spouse && !placed.has(spouse.handle)) {
        allNodes.push({ node: spouse, x: patriCenterX + CARD_W / 2 + COUPLE_GAP, y, generation });
        placed.add(spouse.handle);
    }

    // Place children
    if (children.length === 0) return;

    if (children.length === 1) {
        // RULE 1: single child → child's anchor aligned at patriCenterX
        const item = children[0];
        const cx = patriCenterX - item.anchorX;
        if (item.subtree) {
            assignPositions(item.subtree, cx, generation + 1, allNodes, placed);
        } else if (item.leaf && !placed.has(item.leaf.handle)) {
            const childY = (generation + 1) * (CARD_H + V_SPACE);
            allNodes.push({ node: item.leaf, x: cx, y: childY, generation: generation + 1 });
            placed.add(item.leaf.handle);
        }
        return;
    }

    // RULE 2: N children → use contour-based offsets if available
    const storedOffsets = (subtree as any)._childOffsets as number[] | undefined;
    const storedBlockLeft = (subtree as any)._blockLeft as number | undefined;

    if (storedOffsets && storedBlockLeft !== undefined) {
        // Use contour-based child offsets for compact placement
        const firstAnchor = storedOffsets[0];
        const lastAnchor = storedOffsets[storedOffsets.length - 1];
        const midpoint = (firstAnchor + lastAnchor) / 2;

        for (let i = 0; i < children.length; i++) {
            const item = children[i];
            // Child's anchor absolute X = patriCenterX - midpoint + storedOffsets[i]
            const childAnchorX = patriCenterX - midpoint + storedOffsets[i];
            const childStartX = childAnchorX - item.anchorX;

            if (item.subtree) {
                assignPositions(item.subtree, childStartX, generation + 1, allNodes, placed);
            } else if (item.leaf && !placed.has(item.leaf.handle)) {
                const childY = (generation + 1) * (CARD_H + V_SPACE);
                allNodes.push({ node: item.leaf, x: childStartX, y: childY, generation: generation + 1 });
                placed.add(item.leaf.handle);
            }
        }
    } else {
        // Fallback: old spacing method
        const childAnchors: number[] = [];
        let blockOffset = 0;
        for (const item of children) {
            childAnchors.push(blockOffset + item.anchorX);
            blockOffset += item.width + H_SPACE;
        }
        const firstAnchor = childAnchors[0];
        const lastAnchor = childAnchors[childAnchors.length - 1];
        const midpoint = (firstAnchor + lastAnchor) / 2;

        const blockStartX = patriCenterX - midpoint;

        let cx = blockStartX;
        for (const item of children) {
            if (item.subtree) {
                assignPositions(item.subtree, cx, generation + 1, allNodes, placed);
            } else if (item.leaf && !placed.has(item.leaf.handle)) {
                const childY = (generation + 1) * (CARD_H + V_SPACE);
                allNodes.push({ node: item.leaf, x: cx, y: childY, generation: generation + 1 });
                placed.add(item.leaf.handle);
            }
            cx += item.width + H_SPACE;
        }
    }
}

// ═══ Multi-spouse helpers ═══

/** Extract ChildItem[] for a family without placing the couple itself */
function buildChildItems(
    family: TreeFamily,
    personMap: Map<string, TreeNode>,
    familyMap: Map<string, TreeFamily>,
    visited: Set<string>,
): ChildItem[] {
    const children: ChildItem[] = [];
    for (const childHandle of family.children) {
        const child = personMap.get(childHandle);
        if (!child) continue;

        const candidateFamilies = Array.from(familyMap.values()).filter(f =>
            !visited.has(f.handle) &&
            (f.fatherHandle === childHandle || f.motherHandle === childHandle)
        );
        const childFamily = candidateFamilies.find(f => f.fatherHandle && f.motherHandle)
            ?? candidateFamilies[0];

        if (childFamily) {
            const spouseHandle = childFamily.fatherHandle === childHandle
                ? childFamily.motherHandle
                : childFamily.fatherHandle;
            const spouseNode = spouseHandle ? personMap.get(spouseHandle) : undefined;
            if (spouseNode?.parentFamilies.some(pfId => familyMap.has(pfId) && !visited.has(pfId))) {
                continue;
            }
        }

        if (childFamily) {
            const sub = buildSubtree(childFamily, personMap, familyMap, visited);
            if (sub) {
                children.push({ subtree: sub, width: sub.width, anchorX: sub.anchorX, contour: sub.contour });
            } else {
                const lc: Contour = { left: [-CARD_W / 2], right: [CARD_W / 2] };
                children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: lc });
            }
        } else {
            const lc: Contour = { left: [-CARD_W / 2], right: [CARD_W / 2] };
            children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: lc });
        }
    }
    return children;
}

/** Compute total packed span of ChildItem[] using contour-based packing */
function computeChildrenSpan(items: ChildItem[]): number {
    if (items.length === 0) return 0;
    if (items.length === 1) return items[0].width;
    let totalOffset = 0;
    let merged: Contour = { left: [...items[0].contour.left], right: [...items[0].contour.right] };
    for (let i = 1; i < items.length; i++) {
        totalOffset = minSeparation(merged, items[i].contour);
        merged = mergeContours(merged, items[i].contour, totalOffset);
    }
    return totalOffset + items[items.length - 1].width;
}

/** Place ChildItem[] so their midpoint anchor is at centerX, at the given generation row */
function assignChildItems(
    items: ChildItem[],
    centerX: number,
    generation: number,
    allNodes: PositionedNode[],
    placed: Set<string>,
): void {
    if (items.length === 0) return;
    const y = generation * (CARD_H + V_SPACE);

    if (items.length === 1) {
        const item = items[0];
        const childStartX = centerX - item.anchorX;
        if (item.subtree) {
            assignPositions(item.subtree, childStartX, generation, allNodes, placed);
        } else if (item.leaf && !placed.has(item.leaf.handle)) {
            allNodes.push({ node: item.leaf, x: childStartX, y, generation });
            placed.add(item.leaf.handle);
        }
        return;
    }

    // N children: contour-based packing, centered at centerX
    const offsets: number[] = [0];
    let merged: Contour = { left: [...items[0].contour.left], right: [...items[0].contour.right] };
    for (let i = 1; i < items.length; i++) {
        const sep = minSeparation(merged, items[i].contour);
        offsets.push(sep);
        merged = mergeContours(merged, items[i].contour, sep);
    }
    const midpoint = (offsets[0] + offsets[offsets.length - 1]) / 2;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const childAnchorX = centerX - midpoint + offsets[i];
        const childStartX = childAnchorX - item.anchorX;
        if (item.subtree) {
            assignPositions(item.subtree, childStartX, generation, allNodes, placed);
        } else if (item.leaf && !placed.has(item.leaf.handle)) {
            allNodes.push({ node: item.leaf, x: childStartX, y, generation });
            placed.add(item.leaf.handle);
        }
    }
}

/**
 * Assign positions for a multi-spouse group.
 *
 * Layout (sorted by marriage_order):
 *   [F1_ch_span ][W1][COUPLE_GAP][P][COUPLE_GAP][W2][F2_ch_span][H_SPACE][W3]...
 *
 * F1 children centered at midpoint(W1, P).
 * F2 children centered at midpoint(P, W2).
 * F3+ children centered at Wi center.
 *
 * Returns total width consumed.
 */
function assignMultiSpouseGroup(
    patrilineal: TreeNode,
    families: TreeFamily[],
    personMap: Map<string, TreeNode>,
    familyMap: Map<string, TreeFamily>,
    visited: Set<string>,
    startX: number,
    startGeneration: number,
    allNodes: PositionedNode[],
    placed: Set<string>,
): number {
    // Mark all group families visited before building child items
    for (const fam of families) visited.add(fam.handle);

    const y = startGeneration * (CARD_H + V_SPACE);

    const familyData = families.map((fam, idx) => {
        const spouseHandle = fam.fatherHandle === patrilineal.handle
            ? fam.motherHandle
            : fam.fatherHandle;
        const spouse = spouseHandle ? personMap.get(spouseHandle) : undefined;
        const childItems = buildChildItems(fam, personMap, familyMap, visited);
        const childrenSpan = computeChildrenSpan(childItems);
        return { fam, spouse, childItems, childrenSpan, familyUnitIndex: idx };
    });

    // Left wing: distance from startX to P's left edge (includes W1 + her children span)
    // F1 children are centered at midpoint(W1, P) = P_cx - (CARD_W + COUPLE_GAP)/2
    // Left extent of F1 children = that midpoint - ch_span/2
    // Minimum left wing = (CARD_W + COUPLE_GAP + ch_span[0]) / 2
    const leftChildSpan = familyData[0].childrenSpan;
    const leftWing = Math.max(
        CARD_W + COUPLE_GAP,
        Math.ceil((CARD_W + COUPLE_GAP + leftChildSpan) / 2),
    );

    const P_cx = startX + leftWing + CARD_W / 2;

    // Place P
    if (!placed.has(patrilineal.handle)) {
        allNodes.push({ node: patrilineal, x: P_cx - CARD_W / 2, y, generation: startGeneration });
        placed.add(patrilineal.handle);
    }

    // Place W1 (left of P)
    const W1_cx = P_cx - CARD_W - COUPLE_GAP;
    if (familyData[0].spouse && !placed.has(familyData[0].spouse.handle)) {
        allNodes.push({ node: familyData[0].spouse, x: W1_cx - CARD_W / 2, y, generation: startGeneration });
        placed.add(familyData[0].spouse.handle);
    }

    // F1 children centered at midpoint(W1, P)
    if (familyData[0].childItems.length > 0) {
        assignChildItems(familyData[0].childItems, (W1_cx + P_cx) / 2, startGeneration + 1, allNodes, placed);
    }

    // Place right wives (W2, W3, ...) and their children
    let rightCursor = P_cx + CARD_W / 2 + COUPLE_GAP; // left edge of next wife card
    let rightTotal = 0;

    for (let i = 1; i < familyData.length; i++) {
        const fd = familyData[i];
        const Wi_cx = rightCursor + CARD_W / 2;
        const wingWidth = Math.max(CARD_W, fd.childrenSpan);

        if (fd.spouse && !placed.has(fd.spouse.handle)) {
            allNodes.push({ node: fd.spouse, x: rightCursor, y, generation: startGeneration });
            placed.add(fd.spouse.handle);
        }

        if (fd.childItems.length > 0) {
            const childCenter = i === 1 ? (P_cx + Wi_cx) / 2 : Wi_cx;
            assignChildItems(fd.childItems, childCenter, startGeneration + 1, allNodes, placed);
        }

        const usedWidth = COUPLE_GAP + wingWidth;
        rightTotal += usedWidth;
        rightCursor += wingWidth + H_SPACE;
    }

    return leftWing + CARD_W + rightTotal;
}

// ═══ Main layout ═══

export function computeLayout(people: TreeNode[], families: TreeFamily[]): LayoutResult {
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(families.map(f => [f.handle, f]));

    const gens = assignGenerations(people, families);

    // Find root families (parents NOT children of any family)
    const childOfAnyFamily = new Set<string>();
    for (const f of families) {
        for (const ch of f.children) childOfAnyFamily.add(ch);
    }
    // Also treat people as non-root if their parentFamilies reference an existing family,
    // even when the family's children array doesn't include them (data inconsistency guard).
    for (const p of people) {
        for (const pfId of p.parentFamilies) {
            if (familyMap.has(pfId)) childOfAnyFamily.add(p.handle);
        }
    }
    const rootFamilies = families.filter(f => {
        const fh = f.fatherHandle ? personMap.get(f.fatherHandle) : null;
        const mh = f.motherHandle ? personMap.get(f.motherHandle) : null;
        const fhIsRoot = !fh || !childOfAnyFamily.has(fh.handle);
        const mhIsRoot = !mh || !childOfAnyFamily.has(mh.handle);
        return fhIsRoot && mhIsRoot;
    });

    const allNodes: PositionedNode[] = [];
    const visited = new Set<string>();
    const placed = new Set<string>();
    let cursorX = 0;

    // Global minimum DB generation — used to align all root trees on the same Y grid.
    const globalMinGen = people.length > 0 ? Math.min(...people.map(p => p.generation)) : 1;

    // Detect multi-spouse groups: root families that share the same patrilineal person.
    const patrilinealFamilyGroups = new Map<string, TreeFamily[]>();
    for (const fam of rootFamilies) {
        const father = fam.fatherHandle ? personMap.get(fam.fatherHandle) : undefined;
        const mother = fam.motherHandle ? personMap.get(fam.motherHandle) : undefined;
        const pat = father?.isPatrilineal ? father : mother?.isPatrilineal ? mother : (father || mother);
        if (!pat) continue;
        const existing = patrilinealFamilyGroups.get(pat.handle) ?? [];
        existing.push(fam);
        patrilinealFamilyGroups.set(pat.handle, existing);
    }
    // Sort each group by marriageOrder
    for (const fams of patrilinealFamilyGroups.values()) {
        fams.sort((a, b) => a.marriageOrder - b.marriageOrder);
    }
    // Set of family handles that belong to a multi-spouse group
    const multiSpouseFamilies = new Set<string>();
    for (const fams of patrilinealFamilyGroups.values()) {
        if (fams.length > 1) fams.forEach(f => multiSpouseFamilies.add(f.handle));
    }

    const processedPatrilineal = new Set<string>();

    for (const fam of rootFamilies) {
        if (multiSpouseFamilies.has(fam.handle)) {
            const father = fam.fatherHandle ? personMap.get(fam.fatherHandle) : undefined;
            const mother = fam.motherHandle ? personMap.get(fam.motherHandle) : undefined;
            const pat = father?.isPatrilineal ? father : mother?.isPatrilineal ? mother : (father || mother);
            if (!pat || processedPatrilineal.has(pat.handle)) continue;
            processedPatrilineal.add(pat.handle);

            const groupFamilies = patrilinealFamilyGroups.get(pat.handle)!;
            const startGen = pat.generation - globalMinGen;
            const groupWidth = assignMultiSpouseGroup(
                pat, groupFamilies, personMap, familyMap,
                visited, cursorX, startGen, allNodes, placed,
            );
            cursorX += groupWidth + H_SPACE;
        } else {
            const subtree = buildSubtree(fam, personMap, familyMap, visited);
            if (!subtree) continue;
            // Start each root family at the layout row matching its members' DB generation,
            // so that separate family trees (e.g. multi-clan) share the same Y grid.
            const fatherGen = fam.fatherHandle ? personMap.get(fam.fatherHandle)?.generation : undefined;
            const motherGen = fam.motherHandle ? personMap.get(fam.motherHandle)?.generation : undefined;
            const memberGen = fatherGen ?? motherGen ?? globalMinGen;
            const startGen = memberGen - globalMinGen;
            assignPositions(subtree, cursorX, startGen, allNodes, placed);
            cursorX += subtree.width + H_SPACE;
        }
    }

    // ═══ REPAIR PASS: non-root multi-spouse ═══
    // After main layout, find persons already placed who have unvisited families.
    // This handles Sang-style cases: person is a child in the tree, but has 2+ spouses
    // and buildSubtree only processed the first family.
    {
        const repairNodeMap = new Map(allNodes.map(n => [n.node.handle, n]));

        for (const p of people) {
            if (!placed.has(p.handle)) continue;

            const unvisitedFams = p.families
                .map(h => familyMap.get(h))
                .filter((f): f is TreeFamily => !!f && !visited.has(f.handle))
                .sort((a, b) => a.marriageOrder - b.marriageOrder);

            if (unvisitedFams.length === 0) continue;

            const personNode = repairNodeMap.get(p.handle);
            if (!personNode) continue;

            const y = personNode.y;

            // Find the right edge at the same generation row by looking up
            // the already-placed first-family spouse (W1).
            const firstVisitedFam = p.families
                .map(h => familyMap.get(h))
                .filter((f): f is TreeFamily => !!f && visited.has(f.handle))
                .sort((a, b) => a.marriageOrder - b.marriageOrder)[0];

            let rightEdge = personNode.x + CARD_W;
            if (firstVisitedFam) {
                const w1Handle = firstVisitedFam.fatherHandle === p.handle
                    ? firstVisitedFam.motherHandle
                    : firstVisitedFam.fatherHandle;
                const w1Node = w1Handle ? repairNodeMap.get(w1Handle) : undefined;
                if (w1Node) rightEdge = w1Node.x + CARD_W;
            }

            for (const fam of unvisitedFams) {
                if (visited.has(fam.handle)) continue;
                visited.add(fam.handle);

                const spouseHandle = fam.fatherHandle === p.handle
                    ? fam.motherHandle
                    : fam.fatherHandle;
                const spouse = spouseHandle ? personMap.get(spouseHandle) : undefined;

                const spouseX = rightEdge + H_SPACE;
                const spouseCx = spouseX + CARD_W / 2;

                if (spouse && !placed.has(spouse.handle)) {
                    const spouseNode = { node: spouse, x: spouseX, y, generation: personNode.generation };
                    allNodes.push(spouseNode);
                    repairNodeMap.set(spouse.handle, spouseNode);
                    placed.add(spouse.handle);
                }

                const childItems = buildChildItems(fam, personMap, familyMap, visited);
                if (childItems.length > 0) {
                    const P_cx = personNode.x + CARD_W / 2;
                    assignChildItems(childItems, (P_cx + spouseCx) / 2, personNode.generation + 1, allNodes, placed);
                }

                rightEdge = spouseX + Math.max(CARD_W, computeChildrenSpan(childItems));
            }
        }
    }

    // Place orphans (people not in any family tree)
    for (const p of people) {
        if (!placed.has(p.handle)) {
            const gen = gens.get(p.handle) ?? 0;
            allNodes.push({
                node: p,
                x: cursorX,
                y: gen * (CARD_H + V_SPACE),
                generation: gen,
            });
            placed.add(p.handle);
            cursorX += CARD_W + H_SPACE;
        }
    }

    // ═══ Normalize: shift all nodes so min X = 0 ═══
    let minX = Infinity;
    for (const n of allNodes) {
        minX = Math.min(minX, n.x);
    }
    if (minX !== 0 && minX !== Infinity) {
        for (const n of allNodes) {
            n.x -= minX;
        }
    }

    // ═══ Compute strictly orthogonal connections ═══
    const nodeMap = new Map(allNodes.map(n => [n.node.handle, n]));
    const connections: Connection[] = [];
    const couples: PositionedCouple[] = [];

    // Build familyUnitIndex map for multi-spouse color coding
    const familyUnitIndexMap = new Map<string, number>();
    for (const p of people) {
        if (p.families.length <= 1) continue;
        const sortedFams = p.families
            .map(h => familyMap.get(h))
            .filter((f): f is TreeFamily => !!f)
            .sort((a, b) => a.marriageOrder - b.marriageOrder);
        sortedFams.forEach((f, idx) => familyUnitIndexMap.set(f.handle, idx));
    }

    for (const fam of families) {
        const fatherNode = fam.fatherHandle ? nodeMap.get(fam.fatherHandle) : undefined;
        const motherNode = fam.motherHandle ? nodeMap.get(fam.motherHandle) : undefined;
        if (!fatherNode && !motherNode) continue;

        const patriNode = (fatherNode?.node.isPatrilineal ? fatherNode : motherNode) ?? fatherNode;
        const familyUnitIdx = familyUnitIndexMap.get(fam.handle);

        // Couple line (horizontal between cards)
        if (fatherNode && motherNode) {
            const left = fatherNode.x < motherNode.x ? fatherNode : motherNode;
            const right = fatherNode.x < motherNode.x ? motherNode : fatherNode;
            connections.push({
                fromX: left.x + CARD_W, fromY: left.y + CARD_H / 2,
                toX: right.x, toY: right.y + CARD_H / 2,
                type: 'couple',
                familyUnitIndex: familyUnitIdx,
            });
            couples.push({
                familyHandle: fam.handle,
                fatherPos: fatherNode, motherPos: motherNode,
                midX: (left.x + CARD_W + right.x) / 2,
                y: left.y,
                familyUnitIndex: familyUnitIdx,
            });
        }

        // Parent-child connections: strictly orthogonal bus-line
        if (patriNode && fam.children.length > 0) {
            const parentCX = patriNode.x + CARD_W / 2;
            const parentBottomY = patriNode.y + CARD_H;

            const placedChildren = fam.children
                .map(ch => nodeMap.get(ch))
                .filter((n): n is PositionedNode => !!n);
            if (placedChildren.length === 0) continue;

            const childTopY = placedChildren[0].y;
            // Bus Y = halfway between parent bottom and child top
            const busY = parentBottomY + (childTopY - parentBottomY) * 0.5;

            if (placedChildren.length === 1) {
                const childCX = placedChildren[0].x + CARD_W / 2;

                if (Math.abs(childCX - parentCX) < 1) {
                    // RULE 1: straight vertical line (father and child same column)
                    connections.push({
                        fromX: parentCX, fromY: parentBottomY,
                        toX: parentCX, toY: childTopY,
                        type: 'parent-child',
                        familyUnitIndex: familyUnitIdx,
                    });
                } else {
                    // L-shape: vertical → horizontal → vertical
                    connections.push({
                        fromX: parentCX, fromY: parentBottomY,
                        toX: parentCX, toY: busY,
                        type: 'parent-child',
                        familyUnitIndex: familyUnitIdx,
                    });
                    connections.push({
                        fromX: parentCX, fromY: busY,
                        toX: childCX, toY: busY,
                        type: 'parent-child',
                        familyUnitIndex: familyUnitIdx,
                    });
                    connections.push({
                        fromX: childCX, fromY: busY,
                        toX: childCX, toY: childTopY,
                        type: 'parent-child',
                        familyUnitIndex: familyUnitIdx,
                    });
                }
            } else {
                // RULE 2: vertical stub → horizontal bus → vertical drops
                // All segments are strictly orthogonal

                // 1. Vertical stub down from parent center to bus
                connections.push({
                    fromX: parentCX, fromY: parentBottomY,
                    toX: parentCX, toY: busY,
                    type: 'parent-child',
                    familyUnitIndex: familyUnitIdx,
                });

                // 2. Horizontal bus spanning all children
                const childCenters = placedChildren
                    .map(c => c.x + CARD_W / 2)
                    .sort((a, b) => a - b);
                const busLeft = Math.min(parentCX, childCenters[0]);
                const busRight = Math.max(parentCX, childCenters[childCenters.length - 1]);

                connections.push({
                    fromX: busLeft, fromY: busY,
                    toX: busRight, toY: busY,
                    type: 'parent-child',
                    familyUnitIndex: familyUnitIdx,
                });

                // 3. Vertical drops from bus to each child
                for (const child of placedChildren) {
                    const cx = child.x + CARD_W / 2;
                    connections.push({
                        fromX: cx, fromY: busY,
                        toX: cx, toY: childTopY,
                        type: 'parent-child',
                        familyUnitIndex: familyUnitIdx,
                    });
                }
            }
        }
    }

    // Bounds
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
        maxX = Math.max(maxX, n.x + CARD_W);
        maxY = Math.max(maxY, n.y + CARD_H);
    }

    return {
        nodes: allNodes,
        couples,
        connections,
        width: maxX + H_SPACE,
        height: maxY + V_SPACE / 2,
        generations: Math.max(...Array.from(gens.values())) + 1,
    };
}

// ═══ Generation assignment ═══

function assignGenerations(people: TreeNode[], families: TreeFamily[]): Map<string, number> {
    const gens = new Map<string, number>();
    const familyMap = new Map(families.map(f => [f.handle, f]));

    function setGen(handle: string, gen: number) {
        const current = gens.get(handle);
        if (current !== undefined && current >= gen) return;
        gens.set(handle, gen);
        const person = people.find(p => p.handle === handle);
        if (!person) return;
        for (const famId of person.families) {
            const fam = familyMap.get(famId);
            if (!fam) continue;
            if (fam.fatherHandle && fam.fatherHandle !== handle) setGen(fam.fatherHandle, gen);
            if (fam.motherHandle && fam.motherHandle !== handle) setGen(fam.motherHandle, gen);
            for (const ch of fam.children) setGen(ch, gen + 1);
        }
    }

    for (const p of people) {
        if (p.parentFamilies.length === 0 && !gens.has(p.handle)) {
            setGen(p.handle, 0);
        }
    }
    for (const p of people) {
        if (!gens.has(p.handle)) setGen(p.handle, 0);
    }

    return gens;
}

// ═══ Filter functions ═══

export function filterAncestors(handle: string, people: TreeNode[], families: TreeFamily[]) {
    const result = new Set<string>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const personMap = new Map(people.map(p => [p.handle, p]));

    function walk(h: string) {
        if (result.has(h)) return;
        result.add(h);
        const person = personMap.get(h);
        if (!person) return;
        for (const pfId of person.parentFamilies) {
            const fam = familyMap.get(pfId);
            if (fam) {
                if (fam.fatherHandle) walk(fam.fatherHandle);
                if (fam.motherHandle) walk(fam.motherHandle);
            }
        }
    }
    walk(handle);

    return {
        filteredPeople: people.filter(p => result.has(p.handle)),
        filteredFamilies: families.filter(f =>
            (f.fatherHandle && result.has(f.fatherHandle)) || (f.motherHandle && result.has(f.motherHandle))
        ),
    };
}

export function filterDescendants(handle: string, people: TreeNode[], families: TreeFamily[]) {
    const result = new Set<string>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const personMap = new Map(people.map(p => [p.handle, p]));
    const includedFamilies = new Set<string>();

    function walk(h: string) {
        if (result.has(h)) return;
        result.add(h);
        const person = personMap.get(h);
        if (!person) return;
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (fam) {
                includedFamilies.add(fam.handle);
                if (fam.fatherHandle) result.add(fam.fatherHandle);
                if (fam.motherHandle) result.add(fam.motherHandle);
                for (const ch of fam.children) walk(ch);
            }
        }
    }
    walk(handle);

    return {
        filteredPeople: people.filter(p => result.has(p.handle)),
        // Only include families where a PARENT is in the result set (not ancestor families)
        filteredFamilies: families.filter(f => includedFamilies.has(f.handle)),
    };
}
