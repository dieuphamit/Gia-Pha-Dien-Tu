import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';


// Verify caller có role admin
async function getCallerRole(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const serviceClient = createServiceClient();
    const { data: { user }, error } = await serviceClient.auth.getUser(token);
    if (error || !user) return null;
    const { data: profile } = await serviceClient
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
    return profile?.role ?? null;
}

export async function GET(request: NextRequest) {
    try {
        const role = await getCallerRole(request);
        if (role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Chỉ admin mới xem được audit log' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const entityType = searchParams.get('entity_type');
        const page = parseInt(searchParams.get('page') || '0', 10);
        const pageSize = 20;

        const serviceClient = createServiceClient();
        // audit_logs.actor_id → auth.users(id), không phải profiles(id)
        // nên không thể dùng embedded select trực tiếp — cần query 2 bước
        let query = serviceClient
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (action) query = query.eq('action', action);
        if (entityType) query = query.eq('entity_type', entityType);

        const { data: logs, count, error } = await query;
        if (error) {
            console.error('[audit-logs] Supabase error:', error);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        // Lấy thông tin actor từ bảng profiles
        const actorIds = [...new Set((logs ?? []).map((l: Record<string, unknown>) => l.actor_id).filter(Boolean))] as string[];
        let profileMap: Record<string, { email: string; display_name: string | null }> = {};
        if (actorIds.length > 0) {
            const { data: profiles } = await serviceClient
                .from('profiles')
                .select('id, email, display_name')
                .in('id', actorIds);
            for (const p of profiles ?? []) {
                profileMap[(p as { id: string; email: string; display_name: string | null }).id] = {
                    email: (p as { email: string }).email,
                    display_name: (p as { display_name: string | null }).display_name,
                };
            }
        }

        const data = (logs ?? []).map((l: Record<string, unknown>) => ({
            ...l,
            actor: l.actor_id ? (profileMap[l.actor_id as string] ?? null) : null,
        }));

        return NextResponse.json({ ok: true, data, total: count || 0 });
    } catch (err) {
        console.error('[audit-logs] Exception:', err);
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
