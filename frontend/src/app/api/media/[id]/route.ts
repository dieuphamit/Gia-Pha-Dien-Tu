import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

async function getAuthUser(req: NextRequest) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const { data: { user } } = await getServiceClient().auth.getUser(token);
    return user;
}

async function getProfile(userId: string) {
    const { data } = await getServiceClient()
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    return data;
}

/** Xóa file khỏi Storage + record DB */
async function deleteMediaRecord(id: string, storagePath: string | null) {
    const sc = getServiceClient();
    if (storagePath) {
        await sc.storage.from('media').remove([storagePath]);
    }
    await sc.from('media').delete().eq('id', id);
}

// DELETE /api/media/[id] — xóa file khỏi Storage + DB
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const { id } = await params;
    const sc = getServiceClient();

    const { data: media, error: fetchErr } = await sc
        .from('media')
        .select('id, storage_path, uploader_id')
        .eq('id', id)
        .single();

    if (fetchErr || !media) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });

    const profile = await getProfile(user.id);
    const isOwner = media.uploader_id === user.id;
    const isAdmin = profile?.role === 'admin';
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 });

    await deleteMediaRecord(id, media.storage_path);
    return NextResponse.json({ ok: true });
}

// PATCH /api/media/[id] — cập nhật state, title, linked_person
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const { id } = await params;
    const body = await req.json() as {
        state?: 'PENDING' | 'PUBLISHED' | 'REJECTED';
        title?: string;
        description?: string;
        linked_person?: string | null;
    };

    const profile = await getProfile(user.id);
    const isAdminOrEditor = profile?.role === 'admin' || profile?.role === 'editor';

    if (body.state !== undefined && !isAdminOrEditor) {
        return NextResponse.json({ error: 'Không có quyền duyệt media' }, { status: 403 });
    }

    const sc = getServiceClient();

    // ── Khi TỪ CHỐI: xóa file khỏi Storage + record DB luôn ──
    if (body.state === 'REJECTED' && isAdminOrEditor) {
        const { data: media } = await sc
            .from('media')
            .select('id, storage_path')
            .eq('id', id)
            .single();

        if (media) {
            await deleteMediaRecord(id, media.storage_path);
        }
        return NextResponse.json({ ok: true, deleted: true });
    }

    // ── Các cập nhật khác (PUBLISHED, title, ...) ─────────────
    const updates: Record<string, unknown> = {};
    if (body.state !== undefined && isAdminOrEditor) updates.state = body.state;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.linked_person !== undefined && isAdminOrEditor) updates.linked_person = body.linked_person;

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
    }

    const { data, error } = await sc
        .from('media')
        .update(updates)
        .eq('id', id)
        .select('id, state, title, linked_person, storage_url')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-set people.avatar_url for the first approved photo
    if (data.state === 'PUBLISHED' && data.linked_person && data.storage_url) {
        const { data: person } = await sc
            .from('people')
            .select('avatar_url')
            .eq('handle', data.linked_person)
            .maybeSingle();
        if (person && !person.avatar_url) {
            await sc
                .from('people')
                .update({ avatar_url: data.storage_url, updated_at: new Date().toISOString() })
                .eq('handle', data.linked_person);
        }
    }

    return NextResponse.json({ ok: true, media: data });
}
