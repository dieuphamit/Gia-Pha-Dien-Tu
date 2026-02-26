import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') return null;
    return user.id;
}

// PATCH /api/bug-reports/[id] — admin cập nhật status và admin_note
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const adminId = await verifyAdmin(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { status, admin_note } = body;
    const VALID_STATUSES = ['open', 'in_progress', 'resolved'];
    if (status && !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Status không hợp lệ' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;

    const { data, error } = await supabaseAdmin
        .from('bug_reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[bug-reports PATCH]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

// GET /api/bug-reports/[id] — lấy chi tiết một bug (admin hoặc chính owner)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    const isAdmin = profile?.role === 'admin';

    const { data, error } = await supabaseAdmin
        .from('bug_reports')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isAdmin && data.reporter_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data });
}
