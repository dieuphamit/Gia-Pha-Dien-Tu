/**
 * Supabase data layer for the genealogy tree
 * Replaces localStorage-based persistence with Supabase PostgreSQL
 */
import { supabase } from './supabase';
import type { TreeNode, TreeFamily } from './tree-layout';

export type { TreeNode, TreeFamily };

// 笏笏 Audit log helper 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

/**
 * Ghi audit log (fire-and-forget 窶・khﾃｴng block UI, khﾃｴng throw).
 * actorId: UUID c盻ｧa ngﾆｰ盻拱 dﾃｹng hi盻㌻ t蘯｡i (t盻ｫ useAuth().user.id)
 */
export async function insertAuditLog(params: {
    actorId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT';
    entityType: string;
    entityId?: string;
    entityName?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        // Chỉ ghi log cho role 'editor'
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', params.actorId)
            .maybeSingle();

        if (profile?.role !== 'editor') {
            return; // Bỏ qua nếu không phải editor
        }

        const { error } = await supabase.from('audit_logs').insert({
            actor_id: params.actorId,
            action: params.action,
            entity_type: params.entityType,
            entity_id: params.entityId ?? null,
            entity_name: params.entityName ?? null,
            metadata: params.metadata ?? null,
        });

        if (error) {
            console.error('[insertAuditLog] INSERT failed:', error.code, error.message, params);
        }
    } catch (err) {
        console.error('[insertAuditLog] Error checking role or inserting log:', err);
    }
}


// 笏笏 Convert snake_case DB rows to camelCase 笏笏

function dbRowToTreeNode(row: Record<string, unknown>): TreeNode {
    return {
        handle: row.handle as string,
        displayName: row.display_name as string,
        gender: row.gender as number,
        birthYear: row.birth_year as number | undefined,
        deathYear: row.death_year as number | undefined,
        generation: row.generation as number,
        isLiving: row.is_living as boolean,
        isPrivacyFiltered: row.is_privacy_filtered as boolean,
        isPatrilineal: row.is_patrilineal as boolean,
        families: (row.families as string[]) || [],
        parentFamilies: (row.parent_families as string[]) || [],
    };
}

function dbRowToTreeFamily(row: Record<string, unknown>): TreeFamily {
    return {
        handle: row.handle as string,
        fatherHandle: row.father_handle as string | undefined,
        motherHandle: row.mother_handle as string | undefined,
        children: (row.children as string[]) || [],
    };
}

// 笏笏 Read operations 笏笏

/** Fetch all people from Supabase */
export async function fetchPeople(): Promise<TreeNode[]> {
    const { data, error } = await supabase
        .from('people')
        .select('handle, display_name, gender, birth_year, death_year, generation, is_living, is_privacy_filtered, is_patrilineal, families, parent_families')
        .order('generation')
        .order('handle');

    if (error) {
        console.error('Failed to fetch people:', error.message);
        return [];
    }
    return (data || []).map(dbRowToTreeNode);
}

/** Fetch all families from Supabase */
export async function fetchFamilies(): Promise<TreeFamily[]> {
    const { data, error } = await supabase
        .from('families')
        .select('handle, father_handle, mother_handle, children')
        .order('handle');

    if (error) {
        console.error('Failed to fetch families:', error.message);
        return [];
    }
    return (data || []).map(dbRowToTreeFamily);
}

/** Fetch both people and families in parallel */
export async function fetchTreeData(): Promise<{ people: TreeNode[]; families: TreeFamily[] }> {
    const [people, families] = await Promise.all([fetchPeople(), fetchFamilies()]);
    return { people, families };
}

// 笏笏 Write operations (editor mode) 笏笏

/** Update children order for a family */
export async function updateFamilyChildren(
    familyHandle: string,
    newChildrenOrder: string[],
    actorId?: string
): Promise<void> {
    const { error } = await supabase
        .from('families')
        .update({ children: newChildrenOrder })
        .eq('handle', familyHandle);

    if (error) {
        console.error('Failed to update family children:', error.message);
    } else if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { children: newChildrenOrder },
        });
    }
}

/** Move a child from one family to another */
export async function moveChildToFamily(
    childHandle: string,
    fromFamilyHandle: string,
    toFamilyHandle: string,
    currentFamilies: TreeFamily[],
    actorId?: string
): Promise<void> {
    const fromFam = currentFamilies.find(f => f.handle === fromFamilyHandle);
    const toFam = currentFamilies.find(f => f.handle === toFamilyHandle);

    const updates: Promise<unknown>[] = [];

    // Update families.children on both families
    if (fromFam) {
        updates.push(
            updateFamilyChildren(fromFamilyHandle, fromFam.children.filter(ch => ch !== childHandle))
        );
    }
    if (toFam) {
        updates.push(
            updateFamilyChildren(toFamilyHandle, [...toFam.children.filter(ch => ch !== childHandle), childHandle])
        );
    }

    // Update people.parent_families on the child
    const { data: personData } = await supabase
        .from('people')
        .select('parent_families')
        .eq('handle', childHandle)
        .single();

    if (personData) {
        const currentPF = (personData.parent_families as string[]) || [];
        const newPF = [...currentPF.filter(pf => pf !== fromFamilyHandle), toFamilyHandle];
        updates.push(
            (async () => { await supabase.from('people').update({ parent_families: newPF, updated_at: new Date().toISOString() }).eq('handle', childHandle); })()
        );
    }

    await Promise.all(updates);

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: childHandle,
            metadata: { from: fromFamilyHandle, to: toFamilyHandle },
        });
    }
}

/** Remove a child from a family */
export async function removeChildFromFamily(
    childHandle: string,
    familyHandle: string,
    currentFamilies: TreeFamily[],
    actorId?: string
): Promise<void> {
    const fam = currentFamilies.find(f => f.handle === familyHandle);
    const updates: Promise<unknown>[] = [];

    if (fam) {
        updates.push(
            updateFamilyChildren(familyHandle, fam.children.filter(ch => ch !== childHandle))
        );
    }

    // Also update people.parent_families on the child
    const { data: personData } = await supabase
        .from('people')
        .select('parent_families')
        .eq('handle', childHandle)
        .single();

    if (personData) {
        const currentPF = (personData.parent_families as string[]) || [];
        const newPF = currentPF.filter(pf => pf !== familyHandle);
        updates.push(
            (async () => { await supabase.from('people').update({ parent_families: newPF, updated_at: new Date().toISOString() }).eq('handle', childHandle); })()
        );
    }

    await Promise.all(updates);

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { removed_child: childHandle },
        });
    }
}

/** Update a person's isLiving status */
export async function updatePersonLiving(
    handle: string,
    isLiving: boolean
): Promise<void> {
    const { error } = await supabase
        .from('people')
        .update({ is_living: isLiving })
        .eq('handle', handle);

    if (error) console.error('Failed to update person living status:', error.message);
}

/** Update a person's editable fields */
export async function updatePerson(
    handle: string,
    fields: {
        displayName?: string;
        gender?: number;
        surname?: string | null;
        firstName?: string | null;
        nickName?: string | null;
        birthYear?: number | null;
        deathYear?: number | null;
        isLiving?: boolean;
        phone?: string | null;
        email?: string | null;
        zalo?: string | null;
        facebook?: string | null;
        currentAddress?: string | null;
        hometown?: string | null;
        occupation?: string | null;
        company?: string | null;
        education?: string | null;
        notes?: string | null;
        biography?: string | null;
    },
    actorId?: string
): Promise<{ error: string | null }> {
    // Convert camelCase 竊・snake_case for DB
    const dbFields: Record<string, unknown> = {};
    if (fields.displayName !== undefined) dbFields.display_name = fields.displayName;
    if (fields.gender !== undefined) dbFields.gender = fields.gender;
    if (fields.surname !== undefined) dbFields.surname = fields.surname;
    if (fields.firstName !== undefined) dbFields.first_name = fields.firstName;
    if (fields.nickName !== undefined) dbFields.nick_name = fields.nickName;
    if (fields.birthYear !== undefined) dbFields.birth_year = fields.birthYear;
    if (fields.deathYear !== undefined) dbFields.death_year = fields.deathYear;
    if (fields.isLiving !== undefined) dbFields.is_living = fields.isLiving;
    if (fields.phone !== undefined) dbFields.phone = fields.phone;
    if (fields.email !== undefined) dbFields.email = fields.email;
    if (fields.zalo !== undefined) dbFields.zalo = fields.zalo;
    if (fields.facebook !== undefined) dbFields.facebook = fields.facebook;
    if (fields.currentAddress !== undefined) dbFields.current_address = fields.currentAddress;
    if (fields.hometown !== undefined) dbFields.hometown = fields.hometown;
    if (fields.occupation !== undefined) dbFields.occupation = fields.occupation;
    if (fields.company !== undefined) dbFields.company = fields.company;
    if (fields.education !== undefined) dbFields.education = fields.education;
    if (fields.notes !== undefined) dbFields.notes = fields.notes;
    if (fields.biography !== undefined) dbFields.biography = fields.biography;

    console.log('[updatePerson] handle:', handle, 'fields:', JSON.stringify(dbFields));

    const { data, error } = await supabase
        .from('people')
        .update(dbFields)
        .eq('handle', handle)
        .select('handle, display_name');

    console.log('[updatePerson] result:', { data, error: error?.message });

    if (error) {
        console.error('Failed to update person:', error.message, error.details, error.hint);
        return { error: error.message };
    }
    if (!data || data.length === 0) {
        return { error: 'Khﾃｴng th盻・c蘯ｭp nh蘯ｭt. B蘯｡n c蘯ｧn ﾄ惰ハg nh蘯ｭp ﾄ黛ｻ・cﾃｳ quy盻］ s盻ｭa.' };
    }

    if (actorId) {
        const displayName = (data[0] as { display_name?: string }).display_name || handle;
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'people',
            entityId: handle,
            entityName: displayName,
            metadata: { fields: Object.fromEntries(Object.entries(dbFields).map(([k, v]) => [k, v])) },
        });
    }

    return { error: null };
}

/** Add a new person to the tree */
export async function addPerson(person: {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number | null;
    deathYear?: number | null;
    isLiving?: boolean;
    families?: string[];
    parentFamilies?: string[];
}, actorId?: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('people')
        .insert({
            handle: person.handle,
            display_name: person.displayName,
            gender: person.gender,
            generation: person.generation,
            birth_year: person.birthYear || null,
            death_year: person.deathYear || null,
            is_living: person.isLiving ?? true,
            is_privacy_filtered: false,
            is_patrilineal: person.gender === 1,
            families: person.families || [],
            parent_families: person.parentFamilies || [],
        });

    if (error) {
        console.error('Failed to add person:', error.message);
        return { error: error.message };
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'CREATE',
            entityType: 'people',
            entityId: person.handle,
            entityName: person.displayName,
            metadata: { generation: person.generation, gender: person.gender, birthYear: person.birthYear },
        });
    }

    return { error: null };
}

/** Delete a person from the tree */
export async function deletePerson(handle: string, actorId?: string, entityName?: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('people')
        .delete()
        .eq('handle', handle);

    if (error) {
        console.error('Failed to delete person:', error.message);
        return { error: error.message };
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'DELETE',
            entityType: 'people',
            entityId: handle,
            entityName: entityName,
        });
    }

    return { error: null };
}

/** Fetch a single family by handle */
export async function fetchFamily(handle: string): Promise<TreeFamily | null> {
    const { data, error } = await supabase
        .from('families')
        .select('handle, father_handle, mother_handle, children')
        .eq('handle', handle)
        .single();
    if (error || !data) return null;
    return dbRowToTreeFamily(data as Record<string, unknown>);
}

/** Helper: update + verify rows affected */
async function verifiedUpdate(
    table: 'people' | 'families',
    fields: Record<string, unknown>,
    eqField: string,
    eqValue: string,
): Promise<{ error: string | null }> {
    console.log(`[verifiedUpdate] ${table} where ${eqField}=${eqValue}`, JSON.stringify(fields));

    const { data, error } = await supabase
        .from(table)
        .update(fields)
        .eq(eqField, eqValue)
        .select(eqField);

    console.log(`[verifiedUpdate] ${table} result:`, { data, error: error?.message });

    if (error) {
        console.error(`Update ${table} failed:`, error.message, error.details, error.hint);
        return { error: error.message };
    }
    if (!data || data.length === 0) {
        return { error: `Khﾃｴng th盻・c蘯ｭp nh蘯ｭt ${table}. B蘯｡n c蘯ｧn ﾄ惰ハg nh蘯ｭp ﾄ黛ｻ・cﾃｳ quy盻］ s盻ｭa.` };
    }
    return { error: null };
}

/** Add person as child to a parent family */
export async function addPersonAsChild(personHandle: string, familyHandle: string, actorId?: string): Promise<{ error: string | null }> {
    const fam = await fetchFamily(familyHandle);
    if (!fam) return { error: 'Khﾃｴng tﾃｬm th蘯･y gia ﾄ妥ｬnh ' + familyHandle };

    if (!fam.children.includes(personHandle)) {
        const r1 = await verifiedUpdate('families', { children: [...fam.children, personHandle] }, 'handle', familyHandle);
        if (r1.error) return r1;
    }

    const { data: personData } = await supabase
        .from('people')
        .select('parent_families')
        .eq('handle', personHandle)
        .single();
    const currentPF = (personData?.parent_families as string[]) || [];
    if (!currentPF.includes(familyHandle)) {
        const r2 = await verifiedUpdate('people', { parent_families: [...currentPF, familyHandle] }, 'handle', personHandle);
        if (r2.error) return r2;
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { added_child: personHandle },
        });
    }

    return { error: null };
}

/** Remove person from a parent family */
export async function removePersonFromParentFamily(personHandle: string, familyHandle: string, actorId?: string): Promise<{ error: string | null }> {
    const fam = await fetchFamily(familyHandle);
    if (fam) {
        const r1 = await verifiedUpdate('families', { children: fam.children.filter(c => c !== personHandle) }, 'handle', familyHandle);
        if (r1.error) return r1;
    }
    const { data: personData } = await supabase
        .from('people')
        .select('parent_families')
        .eq('handle', personHandle)
        .single();
    if (personData) {
        const currentPF = (personData.parent_families as string[]) || [];
        const r2 = await verifiedUpdate('people', { parent_families: currentPF.filter(pf => pf !== familyHandle) }, 'handle', personHandle);
        if (r2.error) return r2;
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { removed_child: personHandle },
        });
    }

    return { error: null };
}

/** Add person as spouse (cha/m蘯ｹ) to a family */
export async function addPersonAsSpouse(
    personHandle: string,
    familyHandle: string,
    role: 'father' | 'mother',
    actorId?: string
): Promise<{ error: string | null }> {
    const fam = await fetchFamily(familyHandle);
    if (!fam) return { error: 'Khﾃｴng tﾃｬm th蘯･y gia ﾄ妥ｬnh ' + familyHandle };

    const field = role === 'father' ? 'father_handle' : 'mother_handle';
    const r1 = await verifiedUpdate('families', { [field]: personHandle }, 'handle', familyHandle);
    if (r1.error) return r1;

    const { data: personData } = await supabase
        .from('people')
        .select('families')
        .eq('handle', personHandle)
        .single();
    const currentFam = (personData?.families as string[]) || [];
    if (!currentFam.includes(familyHandle)) {
        const r2 = await verifiedUpdate('people', { families: [...currentFam, familyHandle] }, 'handle', personHandle);
        if (r2.error) return r2;
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { added_spouse: personHandle, role },
        });
    }

    return { error: null };
}

/** Remove person from a spouse family */
export async function removePersonFromSpouseFamily(
    personHandle: string,
    familyHandle: string,
    role: 'father' | 'mother',
    actorId?: string
): Promise<{ error: string | null }> {
    const field = role === 'father' ? 'father_handle' : 'mother_handle';
    const r1 = await verifiedUpdate('families', { [field]: null }, 'handle', familyHandle);
    if (r1.error) return r1;

    const { data: personData } = await supabase
        .from('people')
        .select('families')
        .eq('handle', personHandle)
        .single();
    if (personData) {
        const currentFam = (personData.families as string[]) || [];
        const r2 = await verifiedUpdate('people', { families: currentFam.filter(f => f !== familyHandle) }, 'handle', personHandle);
        if (r2.error) return r2;
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'UPDATE',
            entityType: 'families',
            entityId: familyHandle,
            metadata: { removed_spouse: personHandle, role },
        });
    }

    return { error: null };
}

/** Add a new family */
export async function addFamily(family: {
    handle: string;
    fatherHandle?: string;
    motherHandle?: string;
    children?: string[];
}, actorId?: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('families')
        .insert({
            handle: family.handle,
            father_handle: family.fatherHandle || null,
            mother_handle: family.motherHandle || null,
            children: family.children || [],
        });

    if (error) {
        console.error('Failed to add family:', error.message);
        return { error: error.message };
    }

    if (actorId) {
        insertAuditLog({
            actorId,
            action: 'CREATE',
            entityType: 'families',
            entityId: family.handle,
            metadata: { fatherHandle: family.fatherHandle, motherHandle: family.motherHandle },
        });
    }

    return { error: null };
}

/** Generate a unique person handle (e.g. P031, P032...) */
export async function generatePersonHandle(): Promise<string> {
    const { data } = await supabase
        .from('people')
        .select('handle')
        .like('handle', 'P%')
        .order('handle', { ascending: false });

    if (!data || data.length === 0) return 'P001';

    const nums = data
        .map((r: { handle: string }) => parseInt(r.handle.replace(/\D/g, ''), 10))
        .filter((n: number) => !isNaN(n));

    const max = nums.length > 0 ? Math.max(...nums) : 0;
    const next = max + 1;
    return `P${String(next).padStart(3, '0')}`;
}

/** Generate a unique family handle (e.g. F010, F011...) */
export async function generateFamilyHandle(): Promise<string> {
    const { data } = await supabase
        .from('families')
        .select('handle')
        .like('handle', 'F%')
        .order('handle', { ascending: false });

    if (!data || data.length === 0) return 'F001';

    const nums = data
        .map((r: { handle: string }) => parseInt(r.handle.replace(/\D/g, ''), 10))
        .filter((n: number) => !isNaN(n));

    const max = nums.length > 0 ? Math.max(...nums) : 0;
    const next = max + 1;
    return `F${String(next).padStart(3, '0')}`;
}

/** Fetch all families with display info (for dropdown) */
export async function fetchFamiliesForSelect(): Promise<Array<{
    handle: string;
    fatherName?: string;
    motherName?: string;
    label: string;
}>> {
    const { data: families } = await supabase
        .from('families')
        .select('handle, father_handle, mother_handle')
        .order('handle');

    if (!families) return [];

    // Collect all person handles to lookup
    const personHandles = new Set<string>();
    families.forEach((f: { handle: string; father_handle: string | null; mother_handle: string | null }) => {
        if (f.father_handle) personHandles.add(f.father_handle);
        if (f.mother_handle) personHandles.add(f.mother_handle);
    });

    let nameMap: Record<string, string> = {};
    if (personHandles.size > 0) {
        const { data: people } = await supabase
            .from('people')
            .select('handle, display_name')
            .in('handle', Array.from(personHandles));
        if (people) {
            people.forEach((p: { handle: string; display_name: string }) => {
                nameMap[p.handle] = p.display_name;
            });
        }
    }

    return families.map((f: { handle: string; father_handle: string | null; mother_handle: string | null }) => {
        const fatherName = f.father_handle ? nameMap[f.father_handle] : undefined;
        const motherName = f.mother_handle ? nameMap[f.mother_handle] : undefined;
        const parts = [fatherName, motherName].filter(Boolean);
        const label = parts.length > 0
            ? `${f.handle} 窶・${parts.join(' & ')}`
            : f.handle;
        return { handle: f.handle, fatherName, motherName, label };
    });
}

/** Fetch all people minimal info (for dropdown) */
export async function fetchPeopleForSelect(): Promise<Array<{
    handle: string;
    displayName: string;
    generation: number;
    gender: number;
}>> {
    const { data } = await supabase
        .from('people')
        .select('handle, display_name, generation, gender')
        .order('generation')
        .order('display_name');

    if (!data) return [];
    return data.map((r: { handle: string; display_name: string; generation: number; gender: number }) => ({
        handle: r.handle,
        displayName: r.display_name,
        generation: r.generation,
        gender: r.gender,
    }));
}

// 笏笏 Contribution helpers 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

export type ContributionType =
    | 'edit_person_field'
    | 'add_person'
    | 'delete_person'
    | 'add_event'
    | 'add_post'
    | 'add_quiz_question';

export interface Contribution {
    id: string;
    author_id: string;
    author_email: string;
    person_handle: string | null;
    person_name: string | null;
    field_name: string;
    field_label: string | null;
    old_value: string | null;
    new_value: string;
    note: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
}

export interface SubmitContributionParams {
    authorId: string;
    authorEmail: string;
    fieldName: ContributionType;
    fieldLabel: string;
    newValue: string;
    personHandle?: string;
    personName?: string;
    oldValue?: string;
    note?: string;
}

export async function submitContribution(params: SubmitContributionParams): Promise<{ error: string | null }> {
    const { error } = await supabase.from('contributions').insert({
        author_id: params.authorId,
        author_email: params.authorEmail,
        person_handle: params.personHandle || null,
        person_name: params.personName || null,
        field_name: params.fieldName,
        field_label: params.fieldLabel,
        old_value: params.oldValue || null,
        new_value: params.newValue,
        note: params.note || null,
        status: 'pending',
    });
    return { error: error ? error.message : null };
}

export async function fetchMyContributions(userId: string): Promise<Contribution[]> {
    const { data } = await supabase
        .from('contributions')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });
    return (data as Contribution[]) || [];
}

