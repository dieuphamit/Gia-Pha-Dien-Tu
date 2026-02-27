'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bug, RefreshCw, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────

interface BugReport {
    id: string;
    reporter_id: string | null;
    category: string;
    title: string;
    description: string;
    steps_to_reproduce: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
    updated_at: string;
    reporter: {
        id: string;
        email?: string[];
    } | null;
}

// ── Constants ────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    open: {
        label: 'Mở',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        icon: <AlertCircle className="h-3 w-3" />,
    },
    in_progress: {
        label: 'Đang xử lý',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        icon: <Clock className="h-3 w-3" />,
    },
    resolved: {
        label: 'Đã giải quyết',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        icon: <CheckCircle2 className="h-3 w-3" />,
    },
};

const CATEGORY_LABELS: Record<string, string> = {
    display_error: '🖥️ Lỗi hiển thị',
    feature_not_working: '⚙️ Tính năng không hoạt động',
    wrong_information: '📋 Thông tin sai hoặc thiếu',
    loading_error: '🔄 Trang tải lỗi / chậm',
    suggestion: '💡 Góp ý cải thiện',
    other: '📝 Khác',
};

const STATUS_FILTERS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'open', label: '🔴 Mở' },
    { value: 'in_progress', label: '🟡 Đang xử lý' },
    { value: 'resolved', label: '🟢 Đã giải quyết' },
];

const PAGE_SIZE = 20;

// ── Component ────────────────────────────────────────────────

export default function AdminBugsPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Inline edit state per bug
    const [editDraft, setEditDraft] = useState<Record<string, { status: string; admin_note: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const fetchReports = useCallback(async (pageIdx = 0) => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setLoading(false); return; }

        const params = new URLSearchParams({ page: String(pageIdx), admin: '1' });
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const res = await fetch(`/api/bug-reports?${params}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
            const json = await res.json();
            setReports(json.data ?? []);
            setTotal(json.total ?? 0);
            setPage(pageIdx);
        }
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAdmin) { router.push('/tree'); return; }
        setPage(0);
        fetchReports(0);
    }, [authLoading, isAdmin, fetchReports, router]);

    const openExpand = (report: BugReport) => {
        if (expandedId === report.id) { setExpandedId(null); return; }
        setExpandedId(report.id);
        // Seed draft with current values
        if (!editDraft[report.id]) {
            setEditDraft(prev => ({
                ...prev,
                [report.id]: { status: report.status, admin_note: report.admin_note ?? '' },
            }));
        }
    };

    const handleSave = async (id: string) => {
        setSaving(id);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setSaving(null); return; }

        const draft = editDraft[id];
        const res = await fetch(`/api/bug-reports/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ status: draft.status, admin_note: draft.admin_note }),
        });

        if (res.ok) {
            setReports(prev => prev.map(r =>
                r.id === id ? { ...r, status: draft.status, admin_note: draft.admin_note } : r
            ));
        }
        setSaving(null);
    };

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
                        <Bug className="h-6 w-6" /> Quản lý Bug
                    </h1>
                    <p className="text-muted-foreground text-sm">Danh sách báo cáo lỗi từ thành viên</p>
                </div>
                <Button variant="outline" onClick={() => fetchReports(0)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                </Button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => { setStatusFilter(f.value); }}
                            className={`px-3 py-1.5 font-medium transition-colors ${statusFilter === f.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">
                    {total} báo cáo
                </span>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading && reports.length === 0 ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Tiêu đề</TableHead>
                                    <TableHead>Loại</TableHead>
                                    <TableHead>Người báo cáo</TableHead>
                                    <TableHead>Ngày gửi</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reports.map(report => {
                                    const sc = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open;
                                    const isExpanded = expandedId === report.id;
                                    const draft = editDraft[report.id] ?? { status: report.status, admin_note: report.admin_note ?? '' };

                                    return (
                                        <>
                                            <TableRow
                                                key={report.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => openExpand(report)}
                                            >
                                                <TableCell className="text-muted-foreground">
                                                    {isExpanded
                                                        ? <ChevronDown className="h-4 w-4" />
                                                        : <ChevronRight className="h-4 w-4" />
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-sm max-w-xs truncate">{report.title}</p>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {CATEGORY_LABELS[report.category] || report.category}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {(report.reporter as { display_name?: string; email?: string })?.display_name
                                                        || (report.reporter as { display_name?: string; email?: string })?.email
                                                        || '—'}
                                                </TableCell>
                                                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                                    {new Date(report.created_at).toLocaleString('vi-VN')}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`${sc.className} flex items-center gap-1 text-[10px] w-fit`}>
                                                        {sc.icon} {sc.label}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <TableRow key={`${report.id}-detail`}>
                                                    <TableCell colSpan={6} className="bg-muted/20 px-6 py-4">
                                                        <div className="space-y-4">
                                                            {/* Bug detail */}
                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Nội dung bug</p>
                                                                    <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                                                                </div>
                                                                {report.steps_to_reproduce && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cách tái hiện</p>
                                                                        <p className="text-sm whitespace-pre-wrap">{report.steps_to_reproduce}</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Admin actions */}
                                                            <div className="border-t pt-3 space-y-3">
                                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Xử lý</p>
                                                                <div className="flex flex-wrap gap-3 items-start">
                                                                    <div className="space-y-1">
                                                                        <p className="text-xs text-muted-foreground">Trạng thái</p>
                                                                        <select
                                                                            className="border-input bg-background text-foreground h-8 rounded-md border px-2 py-1 text-xs w-44 outline-none focus:ring-2 focus:ring-ring/50"
                                                                            value={draft.status}
                                                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditDraft(prev => ({
                                                                                ...prev,
                                                                                [report.id]: { ...prev[report.id], status: e.target.value },
                                                                            }))}
                                                                        >
                                                                            <option value="open">🔴 Mở</option>
                                                                            <option value="in_progress">🟡 Đang xử lý</option>
                                                                            <option value="resolved">🟢 Đã giải quyết</option>
                                                                        </select>
                                                                    </div>

                                                                    <div className="flex-1 min-w-48 space-y-1">
                                                                        <p className="text-xs text-muted-foreground">Ghi chú admin</p>
                                                                        <Textarea
                                                                            value={draft.admin_note}
                                                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDraft(prev => ({
                                                                                ...prev,
                                                                                [report.id]: { ...prev[report.id], admin_note: e.target.value },
                                                                            }))}
                                                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                                            placeholder="Ghi chú phản hồi cho thành viên..."
                                                                            rows={2}
                                                                            className="text-sm"
                                                                        />
                                                                    </div>

                                                                    <Button
                                                                        size="sm"
                                                                        className="mt-5"
                                                                        disabled={saving === report.id}
                                                                        onClick={e => { e.stopPropagation(); handleSave(report.id); }}
                                                                    >
                                                                        {saving === report.id
                                                                            ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                                            : <Save className="h-3 w-3 mr-1" />
                                                                        }
                                                                        Lưu
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    );
                                })}

                                {reports.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                            Không có báo cáo bug nào.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-xs text-muted-foreground">
                        Trang {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => fetchReports(page - 1)}
                            disabled={loading || page === 0}
                        >
                            Trang trước
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => fetchReports(page + 1)}
                            disabled={loading || (page + 1) * PAGE_SIZE >= total}
                        >
                            Trang sau
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
