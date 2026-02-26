import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// Helper: verify user session, return { uid, isAdmin } or null
async function verifyUser(req: NextRequest) {
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

    return { uid: user.id, isAdmin: profile?.role === 'admin' };
}

// GET /api/bug-reports — admin sees all, member sees own; supports ?status=open&page=0
export async function GET(req: NextRequest) {
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const PAGE_SIZE = 20;

    // 1. Query bug_reports (simple select, no complex foreign join)
    let query = supabaseAdmin
        .from('bug_reports')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (!user.isAdmin) {
        query = query.eq('reporter_id', user.uid);
    }
    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
        console.error('[bug-reports GET]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Enrich with reporter info from profiles table
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length > 0) {
        const reporterIds = [...new Set(rows.map(r => r.reporter_id as string).filter(Boolean))];
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, display_name, email')
            .in('id', reporterIds);

        const profileMap: Record<string, { id: string; display_name: string | null; email: string | null }> =
            Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

        rows.forEach(r => {
            r.reporter = profileMap[r.reporter_id as string] ?? null;
        });
    }

    return NextResponse.json({ data: rows, total: count ?? 0 });
}


// POST /api/bug-reports — create new bug report
export async function POST(req: NextRequest) {
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { category, title, description, steps_to_reproduce } = body;
    if (!category || !title?.trim() || !description?.trim()) {
        return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (category, title, description)' }, { status: 400 });
    }

    const VALID_CATEGORIES = ['display_error', 'feature_not_working', 'wrong_information', 'loading_error', 'suggestion', 'other'];
    if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json({ error: 'Category không hợp lệ' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('bug_reports')
        .insert({
            reporter_id: user.uid,
            category,
            title: title.trim(),
            description: description.trim(),
            steps_to_reproduce: steps_to_reproduce?.trim() || null,
            status: 'open',
        })
        .select()
        .single();

    if (error) {
        console.error('[bug-reports POST]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
}
