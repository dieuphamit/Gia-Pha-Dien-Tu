'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

interface Contribution {
    id: string;
    author_id: string;
    author_email: string;
    person_handle: string;
    person_name: string;
    field_name: string;
    field_label: string;
    old_value: string | null;
    new_value: string;
    note: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    created_at: string;
    reviewed_at: string | null;
}

const TYPE_ACTION_HINTS: Record<string, string> = {
    edit_person_field: 'ℹ️ Khi duyệt sẽ tự động cập nhật trường thông tin.',
    add_person: 'ℹ️ Khi duyệt sẽ tự động thêm vào gia phả. Liên kết gia đình cần thiết lập thủ công sau.',
    delete_person: 'ℹ️ Khi duyệt sẽ tự động xóa thành viên (chỉ khi chưa có liên kết gia đình).',
    add_event: 'ℹ️ Khi duyệt sẽ tự động tạo sự kiện.',
    add_post: 'ℹ️ Khi duyệt sẽ tự động đăng bài viết.',
    add_quiz_question: 'ℹ️ Khi duyệt sẽ tự động thêm câu hỏi vào hệ thống.',
};

function ContributionValuePreview({ contribution }: { contribution: Contribution }) {
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(contribution.new_value); } catch { /* plain text */ }

    const hint = TYPE_ACTION_HINTS[contribution.field_name];

    if (!parsed) {
        return (
            <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Giá trị mới:</p>
                <p className="text-sm font-medium">{contribution.new_value}</p>
                {contribution.note && (
                    <p className="text-xs text-muted-foreground mt-2 italic">📝 {contribution.note}</p>
                )}
            </div>
        );
    }

    if (contribution.field_name === 'edit_person_field') {
        const e = parsed as { dbColumn?: string; label?: string; value?: string };
        const hint = TYPE_ACTION_HINTS['edit_person_field'];
        return (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">✏️ Đề xuất sửa thông tin:</p>
                <div className="text-sm space-y-0.5">
                    <span className="text-muted-foreground text-xs">{e.label ?? contribution.field_label}:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-through text-muted-foreground">{contribution.old_value || '(trống)'}</span>
                        <span className="text-muted-foreground">→</span>
                        <strong>{e.value}</strong>
                    </div>
                </div>
                {contribution.note && (
                    <p className="text-xs text-muted-foreground italic">📝 {contribution.note}</p>
                )}
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">{hint}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'add_person') {
        const p = parsed as { displayName?: string; gender?: number; generation?: number; birthYear?: number; deathYear?: number; isLiving?: boolean; occupation?: string; currentAddress?: string; phone?: string; email?: string; relationHint?: string };
        return (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">👤 Thành viên mới đề xuất:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span><span className="text-muted-foreground">Họ tên:</span> <strong>{p.displayName}</strong></span>
                    <span><span className="text-muted-foreground">Giới tính:</span> {p.gender === 1 ? 'Nam' : 'Nữ'}</span>
                    <span><span className="text-muted-foreground">Đời:</span> {p.generation}</span>
                    {p.birthYear && <span><span className="text-muted-foreground">Năm sinh:</span> {p.birthYear}</span>}
                    {p.deathYear && <span><span className="text-muted-foreground">Năm mất:</span> {p.deathYear}</span>}
                    <span><span className="text-muted-foreground">Trạng thái:</span> {p.isLiving ? 'Còn sống' : 'Đã mất'}</span>
                    {p.occupation && <span><span className="text-muted-foreground">Nghề nghiệp:</span> {p.occupation}</span>}
                    {p.currentAddress && <span><span className="text-muted-foreground">Địa chỉ:</span> {p.currentAddress}</span>}
                    {p.phone && <span><span className="text-muted-foreground">SĐT:</span> {p.phone}</span>}
                    {p.email && <span><span className="text-muted-foreground">Email:</span> {p.email}</span>}
                </div>
                {p.relationHint && <p className="text-xs italic text-muted-foreground mt-1">🔗 Quan hệ: {p.relationHint}</p>}
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1 mt-1">{hint}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'delete_person') {
        return (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200">
                <p className="text-xs font-medium text-red-700">🗑️ Đề xuất xóa thành viên: <strong>{contribution.new_value}</strong></p>
                {contribution.note && <p className="text-xs text-red-600 mt-1 italic">Lý do: {contribution.note}</p>}
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1 mt-1">{hint}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'add_event') {
        const e = parsed as { title?: string; description?: string; startAt?: string; location?: string; type?: string };
        return (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">📅 Sự kiện đề xuất:</p>
                <p className="text-sm font-semibold">{e.title}</p>
                {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs">
                    {e.startAt && <span>🕐 {new Date(e.startAt).toLocaleString('vi-VN')}</span>}
                    {e.location && <span>📍 {e.location}</span>}
                    {e.type && <span>🏷️ {e.type}</span>}
                </div>
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">{hint}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'add_post') {
        const p = parsed as { title?: string; body?: string };
        return (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">📰 Bài viết đề xuất:</p>
                {p.title && <p className="text-sm font-semibold">{p.title}</p>}
                <p className="text-sm text-muted-foreground line-clamp-3">{p.body}</p>
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">{hint}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'add_quiz_question') {
        const q = parsed as { question?: string; correctAnswer?: string; hint?: string };
        return (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">❓ Câu hỏi xác minh đề xuất:</p>
                <p className="text-sm font-semibold">{q.question}</p>
                <p className="text-xs"><span className="text-muted-foreground">Đáp án:</span> <strong>{q.correctAnswer}</strong></p>
                {q.hint && <p className="text-xs text-muted-foreground">Gợi ý: {q.hint}</p>}
                {hint && <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">{hint}</p>}
            </div>
        );
    }

    // Fallback for unknown JSON types
    return (
        <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Giá trị mới:</p>
            <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(parsed, null, 2)}</pre>
            {contribution.note && (
                <p className="text-xs text-muted-foreground mt-2 italic">📝 {contribution.note}</p>
            )}
        </div>
    );
}

export default function AdminEditsPage() {
    const { canEdit, loading: authLoading, user } = useAuth();
    const router = useRouter();
    const [contributions, setContributions] = useState<Contribution[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});

    const fetchContributions = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('contributions').select('*').order('created_at', { ascending: false });
        if (filter !== 'all') query = query.eq('status', filter);
        const { data } = await query;
        setContributions((data as Contribution[]) || []);
        setLoading(false);
    }, [filter]);

    useEffect(() => {
        if (!authLoading && !canEdit) {
            router.push('/tree');
            return;
        }
        if (!authLoading && canEdit) fetchContributions();
    }, [authLoading, canEdit, fetchContributions, router]);

    const handleAction = async (id: string, action: 'approved' | 'rejected') => {
        setProcessingId(id);
        setApplyErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

        const { error: updateError } = await supabase.from('contributions').update({
            status: action,
            admin_note: adminNotes[id] || null,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
        }).eq('id', id);

        if (!updateError && action === 'approved') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                const res = await fetch('/api/apply-contribution', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ contributionId: id }),
                });
                const result = await res.json();
                if (!result.ok && !result.skipped) {
                    setApplyErrors(prev => ({ ...prev, [id]: result.error || 'Lỗi khi áp dụng đóng góp' }));
                }
            }
        }

        setProcessingId(null);
        fetchContributions();
    };

    const statusColors = {
        pending: 'bg-amber-100 text-amber-700 border-amber-200',
        approved: 'bg-green-100 text-green-700 border-green-200',
        rejected: 'bg-red-100 text-red-700 border-red-200',
    };

    const statusLabels = {
        pending: 'Chờ duyệt',
        approved: 'Đã duyệt',
        rejected: 'Từ chối',
    };

    const pendingCount = contributions.filter(c => c.status === 'pending').length;

    if (authLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquarePlus className="h-5 w-5" /> Đóng góp từ thành viên
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {pendingCount > 0 ? `${pendingCount} đóng góp chờ duyệt` : 'Không có đóng góp nào chờ duyệt'}
                    </p>
                </div>
                <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                            {f === 'all' ? 'Tất cả' : statusLabels[f]}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
            ) : contributions.length === 0 ? (
                <Card>
                    <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                        <p className="text-sm">Không có đóng góp nào {filter !== 'all' ? `(${statusLabels[filter]})` : ''}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {contributions.map(c => (
                        <Card key={c.id} className={`transition-all ${c.status === 'pending' ? 'border-amber-300 shadow-sm' : ''}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        {/* Header */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[c.status]}`}>
                                                {statusLabels[c.status]}
                                            </span>
                                            <span className="text-xs font-semibold">{c.person_name || c.person_handle}</span>
                                            <span className="text-xs text-muted-foreground">→ {c.field_label || c.field_name}</span>
                                        </div>

                                        {/* Value */}
                                        <ContributionValuePreview contribution={c} />

                                        {/* Meta */}
                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                            <span>Từ: {c.author_email}</span>
                                            <span>•</span>
                                            <span>{new Date(c.created_at).toLocaleString('vi-VN')}</span>
                                        </div>

                                        {/* Admin note */}
                                        {c.admin_note && (
                                            <p className="text-xs bg-blue-50 dark:bg-blue-950/30 rounded p-2 text-blue-700 dark:text-blue-400">
                                                💬 Admin: {c.admin_note}
                                            </p>
                                        )}

                                        {/* Apply error */}
                                        {applyErrors[c.id] && (
                                            <p className="text-xs bg-red-50 dark:bg-red-950/30 rounded p-2 text-red-700 dark:text-red-400">
                                                ⚠️ Lỗi áp dụng: {applyErrors[c.id]}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions for pending */}
                                    {c.status === 'pending' && (
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            <Input
                                                placeholder="Ghi chú..."
                                                className="text-xs h-7 w-32"
                                                value={adminNotes[c.id] || ''}
                                                onChange={e => setAdminNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                                            />
                                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                disabled={processingId === c.id}
                                                onClick={() => handleAction(c.id, 'approved')}>
                                                <Check className="w-3 h-3 mr-1" /> Duyệt
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                                disabled={processingId === c.id}
                                                onClick={() => handleAction(c.id, 'rejected')}>
                                                <X className="w-3 h-3 mr-1" /> Từ chối
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
