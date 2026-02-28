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

/**
 * POST /api/people/[handle]/set-avatar
 * Body: { mediaId: string } — UUID của media record
 *
 * Đặt ảnh từ media table làm avatar_url cho người trong people table.
 * Chỉ admin hoặc editor được thực hiện.
 * Media phải: state='PUBLISHED', media_type='IMAGE', linked_person=handle
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ handle: string }> }
) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const sc = getServiceClient();
    const { handle } = await params;

    // Kiểm tra quyền admin/editor
    const { data: profile } = await sc
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || !['admin', 'editor'].includes(profile.role)) {
        return NextResponse.json({ error: 'Chỉ admin hoặc editor mới được thực hiện' }, { status: 403 });
    }

    let body: { mediaId?: string; clear?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
    }

    // Hỗ trợ xóa ảnh đại diện (clear=true)
    if (body.clear) {
        const { error } = await sc
            .from('people')
            .update({ avatar_url: null, updated_at: new Date().toISOString() })
            .eq('handle', handle);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, avatarUrl: null });
    }

    if (!body.mediaId) {
        return NextResponse.json({ error: 'Thiếu mediaId' }, { status: 400 });
    }

    // Lấy media record để kiểm tra và lấy storage_url
    const { data: media, error: mediaErr } = await sc
        .from('media')
        .select('id, storage_url, state, media_type, linked_person')
        .eq('id', body.mediaId)
        .single();

    if (mediaErr || !media) {
        return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });
    }

    if (media.state !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Ảnh chưa được duyệt' }, { status: 400 });
    }
    if (media.media_type !== 'IMAGE') {
        return NextResponse.json({ error: 'Chỉ hỗ trợ ảnh' }, { status: 400 });
    }
    if (media.linked_person !== handle) {
        return NextResponse.json({ error: 'Ảnh không liên kết với người này' }, { status: 400 });
    }

    // Cập nhật avatar_url cho người
    const { error: updateErr } = await sc
        .from('people')
        .update({ avatar_url: media.storage_url, updated_at: new Date().toISOString() })
        .eq('handle', handle);

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, avatarUrl: media.storage_url });
}
