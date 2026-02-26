'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Search, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

// ── Constants ────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    APPROVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    REJECT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

const ACTION_ICONS: Record<string, string> = {
    CREATE: '➕',
    UPDATE: '✏️',
    DELETE: '🗑️',
    APPROVE: '✅',
    REJECT: '❌',
};

const ENTITY_LABELS: Record<string, string> = {
    people: '👤 Thành viên',
    families: '👨‍👩‍👧‍👦 Gia đình',
    contribution: '📝 Đóng góp',
    profile: '🔑 Tài khoản',
};

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'] as const;
type ActionType = typeof ACTIONS[number] | 'all';

// ── Types ────────────────────────────────────────────────────

interface AuditLog {
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor: { email: string; display_name: string | null } | null;
}

// ── Component ────────────────────────────────────────────────

export default function AuditLogPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableExists, setTableExists] = useState<boolean | null>(null);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<ActionType>('all');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 100;

    const fetchLogs = useCallback(async (pageIndex = 0) => {
        setLoading(true);

        // Lấy session token để xác thực với API route
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setLoading(false);
            return;
        }

        const params = new URLSearchParams({ page: String(pageIndex) });
        if (actionFilter !== 'all') params.set('action', actionFilter);
        if (entityFilter !== 'all') params.set('entity_type', entityFilter);

        const res = await fetch(`/api/audit-logs?${params}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            if (res.status === 404) setTableExists(false);
            console.error('[audit] fetch failed:', json.error);
            setLoading(false);
            return;
        }

        const json = await res.json();
        setTableExists(true);
        const data = json.data as AuditLog[];
        if (pageIndex === 0) {
            setLogs(data);
        } else {
            setLogs(prev => [...prev, ...data]);
        }
        setPage(pageIndex);
        setLoading(false);
    }, [actionFilter, entityFilter]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAdmin) { router.push('/tree'); return; }
        setPage(0);
        fetchLogs(0);
    }, [authLoading, isAdmin, fetchLogs, router]);

    const filtered = logs.filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (l.action || '').toLowerCase().includes(q) ||
            (l.entity_type || '').toLowerCase().includes(q) ||
            (l.entity_id || '').toLowerCase().includes(q) ||
            (l.entity_name || '').toLowerCase().includes(q) ||
            (l.actor?.email || '').toLowerCase().includes(q) ||
            (l.actor?.display_name || '').toLowerCase().includes(q)
        );
    });

    // Derive available entity types from loaded logs
    const entityTypes = Array.from(new Set(logs.map(l => l.entity_type)));

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6" /> Audit Log
                    </h1>
                    <p className="text-muted-foreground text-sm">Lịch sử hành động của editor / admin</p>
                </div>
                <Button variant="outline" onClick={() => fetchLogs(0)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                </Button>
            </div>

            {/* Migration banner — chỉ hiện khi bảng chưa tồn tại */}
            {tableExists === false && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">⚠️ Bảng <code>audit_logs</code> chưa tồn tại trong Supabase</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        Vào <strong>Supabase Dashboard → SQL Editor</strong> và chạy nội dung file migration:
                    </p>
                    <code className="block text-xs bg-amber-100 dark:bg-amber-900/40 rounded px-3 py-2 font-mono">
                        supabase/migrations/add_audit_logs.sql
                    </code>
                    <Button size="sm" variant="outline" className="border-amber-400" onClick={() => fetchLogs(0)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Kiểm tra lại
                    </Button>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-48 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên, action, entity..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Action filter */}
                <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                    <button
                        onClick={() => setActionFilter('all')}
                        className={`px-3 py-1.5 font-medium transition-colors ${actionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                        Tất cả
                    </button>
                    {ACTIONS.map(a => (
                        <button
                            key={a}
                            onClick={() => setActionFilter(a)}
                            className={`px-3 py-1.5 font-medium transition-colors ${actionFilter === a ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                            {ACTION_ICONS[a]} {a}
                        </button>
                    ))}
                </div>

                {/* Entity type filter */}
                {entityTypes.length > 1 && (
                    <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                        <button
                            onClick={() => setEntityFilter('all')}
                            className={`px-3 py-1.5 font-medium transition-colors ${entityFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                            Tất cả loại
                        </button>
                        {entityTypes.map(et => (
                            <button
                                key={et}
                                onClick={() => setEntityFilter(et)}
                                className={`px-3 py-1.5 font-medium transition-colors ${entityFilter === et ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >
                                {ENTITY_LABELS[et] || et}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Hiển thị <strong>{filtered.length}</strong> / {logs.length} log</span>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading && logs.length === 0 ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead>Hành động</TableHead>
                                    <TableHead>Loại</TableHead>
                                    <TableHead>Đối tượng</TableHead>
                                    <TableHead>Người thực hiện</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(log => (
                                    <>
                                        <TableRow
                                            key={log.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                        >
                                            <TableCell className="text-muted-foreground">
                                                {expandedId === log.id
                                                    ? <ChevronDown className="h-4 w-4" />
                                                    : <ChevronRight className="h-4 w-4" />
                                                }
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                                {new Date(log.created_at).toLocaleString('vi-VN')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={ACTION_COLORS[log.action] || ''}>
                                                    {ACTION_ICONS[log.action]} {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {ENTITY_LABELS[log.entity_type] || log.entity_type}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    {log.entity_name && (
                                                        <p className="text-sm font-medium">{log.entity_name}</p>
                                                    )}
                                                    {log.entity_id && (
                                                        <p className="text-xs text-muted-foreground font-mono">{log.entity_id}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.actor?.display_name || log.actor?.email || (
                                                    <span className="text-muted-foreground text-xs">API / System</span>
                                                )}
                                                {log.actor?.email && log.actor?.display_name && (
                                                    <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                                                )}
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded metadata row */}
                                        {expandedId === log.id && log.metadata && (
                                            <TableRow key={`${log.id}-meta`}>
                                                <TableCell colSpan={6} className="bg-muted/30 px-6 py-3">
                                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Chi tiết thay đổi</p>
                                                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                                                        {Object.entries(log.metadata)
                                                            .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                                            .map(([k, v]) => (
                                                                <div key={k} className="flex gap-2">
                                                                    <span className="text-muted-foreground shrink-0 capitalize w-28">{k.replace(/_/g, ' ')}:</span>
                                                                    <span className="font-medium break-all">
                                                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                            {logs.length === 0
                                                ? 'Chưa có log nào. Hãy chắc chắn đã tạo bảng audit_logs trong Supabase.'
                                                : 'Không tìm thấy log nào khớp với bộ lọc.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Load more */}
            {filtered.length >= PAGE_SIZE && (
                <div className="flex justify-center">
                    <Button variant="outline" onClick={() => fetchLogs(page + 1)} disabled={loading}>
                        {loading ? 'Đang tải...' : 'Tải thêm'}
                    </Button>
                </div>
            )}
        </div>
    );
}
