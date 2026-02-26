import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
    generateHandle,
    normalizeEventType,
    ALLOWED_PERSON_COLUMNS,
    type ContributionApplyResult,
    type AddPersonPayload,
    type AddEventPayload,
    type AddPostPayload,
    type AddQuizQuestionPayload,
    type EditPersonFieldPayload,
} from '@/lib/apply-contribution';

// ── Auth helper ──────────────────────────────────────────────

async function getCallerInfo(request: NextRequest): Promise<{ role: string | null; userId: string | null }> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return { role: null, userId: null };

    const token = authHeader.slice(7);
    const serviceClient = createServiceClient();

    const { data: { user }, error } = await serviceClient.auth.getUser(token);
    if (error || !user) return { role: null, userId: null };

    const { data: profile } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    return { role: profile?.role ?? null, userId: user.id };
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // 1. Verify caller is admin or editor
        const { role, userId: callerId } = await getCallerInfo(request);
        if (!role || !['admin', 'editor'].includes(role)) {
            return NextResponse.json({ ok: false, error: 'Không có quyền thực hiện' }, { status: 403 });
        }

        // 2. Parse body
        const { contributionId } = await request.json();
        if (!contributionId) {
            return NextResponse.json({ ok: false, error: 'contributionId is required' }, { status: 400 });
        }

        const serviceClient = createServiceClient();

        // 3. Fetch contribution — must be approved and not yet applied
        const { data: contribution, error: fetchError } = await serviceClient
            .from('contributions')
            .select('*')
            .eq('id', contributionId)
            .eq('status', 'approved')
            .is('applied_at', null)
            .maybeSingle();

        if (fetchError) {
            return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
        }
        if (!contribution) {
            // Either not found, not approved, or already applied
            return NextResponse.json({ ok: true, skipped: true });
        }

        // 4. Dispatch by field_name
        let result: ContributionApplyResult;
        switch (contribution.field_name) {
            case 'add_person':
                result = await applyAddPerson(serviceClient, contribution);
                break;
            case 'add_event':
                result = await applyAddEvent(serviceClient, contribution);
                break;
            case 'add_post':
                result = await applyAddPost(serviceClient, contribution);
                break;
            case 'add_quiz_question':
                result = await applyAddQuizQuestion(serviceClient, contribution);
                break;
            case 'delete_person':
                result = await applyDeletePerson(serviceClient, contribution);
                break;
            case 'edit_person_field':
                result = await applyEditPersonField(serviceClient, contribution);
                break;
            default:
                result = { ok: true, skipped: true };
        }

        // 5. Mark as applied if successful
        if (result.ok && !result.skipped) {
            await serviceClient
                .from('contributions')
                .update({ applied_at: new Date().toISOString() })
                .eq('id', contributionId);
        }

        // 6. Write audit log
        if (callerId && role === 'editor' && !result.skipped) {
            await serviceClient.from('audit_logs').insert({
                actor_id: callerId,
                action: result.ok ? 'APPROVE' : 'REJECT',
                entity_type: 'contribution',
                entity_id: contributionId,
                entity_name: (contribution.person_name as string) || (contribution.field_label as string) || (contribution.field_name as string),
                metadata: {
                    field_name: contribution.field_name,
                    person_handle: contribution.person_handle,
                    author_email: contribution.author_email,
                    inserted_id: result.insertedId,
                    error: result.error,
                },
            });
        }

        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// ── Handlers ─────────────────────────────────────────────────

async function applyAddPerson(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    let payload: AddPersonPayload;
    try {
        payload = JSON.parse(contribution.new_value as string) as AddPersonPayload;
    } catch {
        return { ok: false, error: 'Dữ liệu đóng góp không hợp lệ (JSON parse error)' };
    }

    if (!payload.displayName?.trim()) {
        return { ok: false, error: 'Thiếu họ tên thành viên' };
    }
    if (!payload.generation) {
        return { ok: false, error: 'Thiếu đời thứ' };
    }

    const handle = generateHandle(payload.displayName);

    const { data, error } = await serviceClient
        .from('people')
        .insert({
            handle,
            display_name: payload.displayName.trim(),
            gender: payload.gender ?? 1,
            generation: payload.generation,
            birth_year: payload.birthYear || null,
            death_year: payload.deathYear || null,
            is_living: payload.isLiving ?? true,
            is_patrilineal: (payload.gender ?? 1) === 1,
            is_privacy_filtered: false,
            occupation: payload.occupation?.trim() || null,
            current_address: payload.currentAddress?.trim() || null,
            phone: payload.phone?.trim() || null,
            email: payload.email?.trim() || null,
            families: [],
            parent_families: [],
        })
        .select('handle')
        .single();

    if (error) return { ok: false, error: `Lỗi tạo thành viên: ${error.message}` };

    // Handle initial spouse setup
    if (payload.spouseHandle) {
        const { generateFamilyHandle, addFamily, addPersonAsSpouse } = await import('@/lib/supabase-data');
        const familyHandle = await generateFamilyHandle();

        let fatherHandle = payload.gender === 1 ? handle : payload.spouseHandle;
        let motherHandle = payload.gender === 2 ? handle : payload.spouseHandle;

        // Ensure the imported generateFamilyHandle works outside typical client context or ensure it takes no argument
        const { error: famError } = await addFamily({
            handle: familyHandle,
            fatherHandle,
            motherHandle,
            children: []
        });

        if (!famError) {
            // Update people.families for both
            await addPersonAsSpouse(handle, familyHandle, payload.gender === 2 ? 'mother' : 'father');
            await addPersonAsSpouse(payload.spouseHandle, familyHandle, payload.gender === 2 ? 'father' : 'mother');
        } else {
            console.error('Failed to create family with spouse:', famError);
        }
    }

    return { ok: true, insertedId: (data as { handle: string }).handle };
}

async function applyAddEvent(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    let payload: AddEventPayload;
    try {
        payload = JSON.parse(contribution.new_value as string) as AddEventPayload;
    } catch {
        return { ok: false, error: 'Dữ liệu đóng góp không hợp lệ (JSON parse error)' };
    }

    if (!payload.title?.trim()) {
        return { ok: false, error: 'Thiếu tên sự kiện' };
    }
    if (!payload.startAt) {
        return { ok: false, error: 'Thiếu ngày giờ sự kiện' };
    }

    const startDate = new Date(payload.startAt);
    if (isNaN(startDate.getTime())) {
        return { ok: false, error: 'Ngày giờ không hợp lệ' };
    }

    const { data, error } = await serviceClient
        .from('events')
        .insert({
            title: payload.title.trim(),
            description: payload.description?.trim() || null,
            start_at: startDate.toISOString(),
            location: payload.location?.trim() || null,
            type: normalizeEventType(payload.type),
            creator_id: contribution.reviewed_by || null,
        })
        .select('id')
        .single();

    if (error) return { ok: false, error: `Lỗi tạo sự kiện: ${error.message}` };
    return { ok: true, insertedId: (data as { id: string }).id };
}

async function applyAddPost(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    let payload: AddPostPayload;
    try {
        payload = JSON.parse(contribution.new_value as string) as AddPostPayload;
    } catch {
        return { ok: false, error: 'Dữ liệu đóng góp không hợp lệ (JSON parse error)' };
    }

    if (!payload.body?.trim()) {
        return { ok: false, error: 'Thiếu nội dung bài viết' };
    }
    if (payload.body.length > 10000) {
        return { ok: false, error: 'Nội dung bài viết vượt quá 10.000 ký tự' };
    }

    const { data, error } = await serviceClient
        .from('posts')
        .insert({
            author_id: contribution.author_id || null,
            title: payload.title?.trim() || null,
            body: payload.body.trim(),
            type: 'general',
            status: 'published',
        })
        .select('id')
        .single();

    if (error) return { ok: false, error: `Lỗi tạo bài viết: ${error.message}` };
    return { ok: true, insertedId: (data as { id: string }).id };
}

async function applyAddQuizQuestion(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    let payload: AddQuizQuestionPayload;
    try {
        payload = JSON.parse(contribution.new_value as string) as AddQuizQuestionPayload;
    } catch {
        return { ok: false, error: 'Dữ liệu đóng góp không hợp lệ (JSON parse error)' };
    }

    if (!payload.question?.trim()) {
        return { ok: false, error: 'Thiếu nội dung câu hỏi' };
    }
    if (!payload.correctAnswer?.trim()) {
        return { ok: false, error: 'Thiếu đáp án đúng' };
    }

    const { data, error } = await serviceClient
        .from('family_questions')
        .insert({
            question: payload.question.trim(),
            correct_answer: payload.correctAnswer.trim(),
            hint: payload.hint?.trim() || null,
            is_active: true,
        })
        .select('id')
        .single();

    if (error) return { ok: false, error: `Lỗi tạo câu hỏi: ${error.message}` };
    return { ok: true, insertedId: (data as { id: string }).id };
}

async function applyDeletePerson(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    // For delete_person: person_handle is stored in contribution.person_handle
    const handle = (contribution.person_handle as string) || (contribution.new_value as string);
    if (!handle?.trim()) {
        return { ok: false, error: 'Không tìm thấy handle của thành viên cần xóa' };
    }

    // Pre-check: ensure person is not linked in any family
    const { data: linkedFamilies } = await serviceClient
        .from('families')
        .select('handle')
        .or(`father_handle.eq.${handle},mother_handle.eq.${handle},children.cs.{${handle}}`);

    if (linkedFamilies && linkedFamilies.length > 0) {
        return {
            ok: false,
            error: `Người này đang được liên kết trong gia đình (${linkedFamilies.length} mối liên kết). Hãy xóa liên kết trong cây gia phả trước.`,
        };
    }

    const { error } = await serviceClient
        .from('people')
        .delete()
        .eq('handle', handle);

    if (error) return { ok: false, error: `Lỗi xóa thành viên: ${error.message}` };
    return { ok: true };
}

async function applyEditPersonField(
    serviceClient: ReturnType<typeof createServiceClient>,
    contribution: Record<string, unknown>
): Promise<ContributionApplyResult> {
    const handle = (contribution.person_handle as string)?.trim();
    if (!handle) {
        return { ok: false, error: 'Không tìm thấy handle của thành viên' };
    }

    let payload: EditPersonFieldPayload;
    try {
        payload = JSON.parse(contribution.new_value as string) as EditPersonFieldPayload;
    } catch {
        return { ok: false, error: 'Dữ liệu đóng góp không hợp lệ (JSON parse error)' };
    }

    if (!payload.dbColumn || !ALLOWED_PERSON_COLUMNS.has(payload.dbColumn)) {
        return { ok: false, error: `Trường "${payload.dbColumn}" không được phép chỉnh sửa qua đóng góp` };
    }

    // Cast value to appropriate type based on column
    let typedValue: string | number | boolean | null = payload.value;
    if (payload.dbColumn === 'is_living') {
        typedValue = payload.value === 'true';
    } else if (payload.dbColumn === 'birth_year' || payload.dbColumn === 'death_year') {
        typedValue = payload.value ? Number(payload.value) : null;
        if (payload.value && isNaN(typedValue as number)) {
            return { ok: false, error: 'Năm không hợp lệ' };
        }
    }

    const { error } = await serviceClient
        .from('people')
        .update({ [payload.dbColumn]: typedValue })
        .eq('handle', handle);

    if (error) return { ok: false, error: `Lỗi cập nhật thông tin: ${error.message}` };
    return { ok: true };
}
