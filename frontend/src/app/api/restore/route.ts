import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────

export interface BackupData {
    version: number;
    exported_at: string;
    people?: Record<string, unknown>[];
    families?: Record<string, unknown>[];
    profiles?: Record<string, unknown>[];
    posts?: Record<string, unknown>[];
    post_comments?: Record<string, unknown>[];
    comments?: Record<string, unknown>[];
    events?: Record<string, unknown>[];
    event_rsvps?: Record<string, unknown>[];
    family_questions?: Record<string, unknown>[];
    contributions?: Record<string, unknown>[];
}

export interface RestoreTableResult {
    table: string;
    total: number;
    upserted: number;
    error?: string;
}

// ── Auth helper ──────────────────────────────────────────────

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const serviceClient = createServiceClient();

    const { data: { user }, error } = await serviceClient.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.role !== 'admin') return null;
    return { userId: user.id };
}

// ── Upsert helper ─────────────────────────────────────────────

async function upsertTable(
    serviceClient: ReturnType<typeof createServiceClient>,
    table: string,
    rows: Record<string, unknown>[],
    conflictColumn: string,
): Promise<RestoreTableResult> {
    if (!rows || rows.length === 0) {
        return { table, total: 0, upserted: 0 };
    }

    // Batch upsert in chunks of 500 to avoid request size limits
    const CHUNK_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await serviceClient
            .from(table)
            .upsert(chunk, { onConflict: conflictColumn, ignoreDuplicates: false });

        if (error) {
            return {
                table,
                total: rows.length,
                upserted: totalUpserted,
                error: error.message,
            };
        }
        totalUpserted += chunk.length;
    }

    return { table, total: rows.length, upserted: totalUpserted };
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // 1. Verify admin
        const caller = await requireAdmin(request);
        if (!caller) {
            return NextResponse.json(
                { ok: false, error: 'Chỉ admin mới có thể thực hiện restore' },
                { status: 403 }
            );
        }

        // 2. Parse backup JSON
        let backup: BackupData;
        try {
            backup = await request.json() as BackupData;
        } catch {
            return NextResponse.json(
                { ok: false, error: 'File backup không hợp lệ (JSON parse error)' },
                { status: 400 }
            );
        }

        // 3. Basic validation
        if (!backup.exported_at) {
            return NextResponse.json(
                { ok: false, error: 'File backup thiếu trường exported_at — không phải file backup hợp lệ' },
                { status: 400 }
            );
        }

        const serviceClient = createServiceClient();
        const results: RestoreTableResult[] = [];

        // 4. Restore theo thứ tự phụ thuộc (không có FK cứng nên upsert tuần tự là đủ)
        const tablePlan: Array<{
            key: keyof BackupData;
            table: string;
            conflictCol: string;
        }> = [
                { key: 'people', table: 'people', conflictCol: 'handle' },
                { key: 'families', table: 'families', conflictCol: 'handle' },
                { key: 'profiles', table: 'profiles', conflictCol: 'id' },
                { key: 'posts', table: 'posts', conflictCol: 'id' },
                { key: 'post_comments', table: 'post_comments', conflictCol: 'id' },
                { key: 'comments', table: 'comments', conflictCol: 'id' },
                { key: 'events', table: 'events', conflictCol: 'id' },
                { key: 'event_rsvps', table: 'event_rsvps', conflictCol: 'id' },
                { key: 'family_questions', table: 'family_questions', conflictCol: 'id' },
                { key: 'contributions', table: 'contributions', conflictCol: 'id' },
            ];

        for (const { key, table, conflictCol } of tablePlan) {
            const rows = backup[key] as Record<string, unknown>[] | undefined;
            if (!rows || rows.length === 0) {
                results.push({ table, total: 0, upserted: 0 });
                continue;
            }
            const result = await upsertTable(serviceClient, table, rows, conflictCol);
            results.push(result);

            // Stop on critical table errors
            if (result.error && (table === 'people' || table === 'families')) {
                return NextResponse.json({
                    ok: false,
                    error: `Lỗi restore bảng ${table}: ${result.error}`,
                    results,
                }, { status: 500 });
            }
        }

        // 5. Ghi audit log
        const totalRecords = results.reduce((s, r) => s + r.total, 0);
        await serviceClient.from('audit_logs').insert({
            actor_id: caller.userId,
            action: 'CREATE',
            entity_type: 'backup_restore',
            entity_name: `Restore ${totalRecords} records từ backup ${backup.exported_at}`,
            metadata: { exported_at: backup.exported_at, results },
        });

        const hasErrors = results.some(r => r.error);

        return NextResponse.json({
            ok: !hasErrors,
            partial: hasErrors,
            results,
            totalRecords,
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
