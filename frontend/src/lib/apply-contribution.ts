/**
 * apply-contribution.ts
 * Shared types and helpers for the auto-apply contribution feature.
 */

export interface ContributionApplyResult {
    ok: boolean;
    skipped?: boolean;
    error?: string;
    insertedId?: string;
}

/** Payload shapes parsed from contribution.new_value JSON */
export interface AddPersonPayload {
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number;
    deathYear?: number;
    isLiving?: boolean;
    occupation?: string;
    currentAddress?: string;
    phone?: string;
    email?: string;
    relationHint?: string;
    spouseHandle?: string;
}

export interface AddEventPayload {
    title: string;
    description?: string;
    startAt: string;
    location?: string;
    type?: string;
}

export interface AddPostPayload {
    title?: string;
    body: string;
}

export interface AddQuizQuestionPayload {
    question: string;
    correctAnswer: string;
    hint?: string;
}

export interface EditPersonFieldPayload {
    dbColumn: string;
    label: string;
    value: string;
}

/**
 * Whitelist of DB columns that may be updated via edit_person_field contributions.
 * Prevents arbitrary column injection.
 */
export const ALLOWED_PERSON_COLUMNS = new Set([
    'display_name', 'surname', 'first_name', 'nick_name',
    'birth_year', 'death_year', 'is_living',
    'occupation', 'company', 'education',
    'phone', 'email', 'zalo', 'facebook',
    'hometown', 'current_address',
    'biography', 'notes',
]);

/**
 * Generate a URL-safe handle from a Vietnamese display name.
 * e.g. "Nguyễn Văn A" → "nguyen-van-a-x4f2"
 */
export function generateHandle(displayName: string): string {
    const base = displayName
        // Normalize to NFD form (separate base chars from diacritics)
        .normalize('NFD')
        // Remove combining diacritical marks
        .replace(/[\u0300-\u036f]/g, '')
        // Handle Vietnamese đ/Đ specifically (not covered by NFD normalization)
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        // Replace non-alphanumeric sequences with dashes
        .replace(/[^a-z0-9]+/g, '-')
        // Trim leading/trailing dashes
        .replace(/^-+|-+$/g, '')
        // Limit length
        .slice(0, 40);

    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}-${suffix}`;
}

/** Validate that a string is a valid event type */
export function normalizeEventType(type?: string): string {
    const valid = ['MEMORIAL', 'MEETING', 'FESTIVAL', 'OTHER'];
    if (type && valid.includes(type.toUpperCase())) return type.toUpperCase();
    return 'OTHER';
}
