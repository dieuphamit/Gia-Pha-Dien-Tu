'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquarePlus, Clock, Check, X, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { fetchMyContributions, type Contribution } from '@/lib/supabase-data';
import { ContributeQuizQuestionDialog } from '@/components/contribute-quiz-question-dialog';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3 w-3" />,
    approved: <Check className="h-3 w-3" />,
    rejected: <X className="h-3 w-3" />,
};

const TYPE_LABELS: Record<string, string> = {
    edit_person_field: '✏️ Sửa thông tin thành viên',
    add_person: '👤 Đề xuất thêm thành viên',
    delete_person: '🗑️ Đề xuất xóa thành viên',
    add_event: '📅 Đề xuất sự kiện',
    add_post: '📰 Đề xuất bài viết',
    add_quiz_question: '❓ Đề xuất câu hỏi xác minh',
};

export default function ContributionsPage() {
    const { user, canEdit, loading: authLoading } = useAuth();
    const router = useRouter();
    const [contributions, setContributions] = useState<Contribution[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterStatus>('all');

    const loadContributions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const data = await fetchMyContributions(user.id);
        setContributions(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.push('/login'); return; }
        // Redirect editors/admins to the full review page
        if (canEdit) { router.push('/admin/edits'); return; }
        loadContributions();
    }, [authLoading, user, canEdit, loadContributions, router]);

    const filtered = filter === 'all'
        ? contributions
        : contributions.filter(c => c.status === filter);

    const counts = {
        pending: contributions.filter(c => c.status === 'pending').length,
        approved: contributions.filter(c => c.status === 'approved').length,
        rejected: contributions.filter(c => c.status === 'rejected').length,
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquarePlus className="h-5 w-5" />
                    Đóng góp của tôi
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Theo dõi các đề xuất bạn đã gửi cho quản trị viên
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-amber-700">{counts.pending}</p>
                        <p className="text-xs text-amber-600">Chờ duyệt</p>
                    </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{counts.approved}</p>
                        <p className="text-xs text-green-600">Đã duyệt</p>
                    </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-red-700">{counts.rejected}</p>
                        <p className="text-xs text-red-600">Từ chối</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                <ContributeQuizQuestionDialog />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs w-fit">
                {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                        {f === 'all' ? 'Tất cả' : STATUS_LABELS[f]}
                        {f !== 'all' && counts[f] > 0 && (
                            <span className="ml-1 text-[10px] opacity-70">({counts[f]})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                        <ClipboardCheck className="h-10 w-10 opacity-30" />
                        <p className="text-sm">
                            {filter === 'all'
                                ? 'Bạn chưa gửi đóng góp nào'
                                : `Không có đóng góp nào ${STATUS_LABELS[filter].toLowerCase()}`
                            }
                        </p>
                        <p className="text-xs">Sử dụng các nút &quot;Đề xuất&quot; trên trang thành viên, sự kiện, bảng tin để đóng góp.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(c => (
                        <Card key={c.id} className={c.status === 'pending' ? 'border-amber-200' : ''}>
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        {/* Type + status */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${STATUS_COLORS[c.status]}`}>
                                                {STATUS_ICONS[c.status]}
                                                {STATUS_LABELS[c.status]}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {TYPE_LABELS[c.field_name] || c.field_label || c.field_name}
                                            </span>
                                        </div>

                                        {/* Subject */}
                                        {c.person_name && (
                                            <p className="text-sm font-medium truncate">{c.person_name}</p>
                                        )}

                                        {/* Preview of new value */}
                                        <ContributionPreview contribution={c} />

                                        {/* Note from reviewer */}
                                        {c.admin_note && (
                                            <p className="text-xs bg-blue-50 dark:bg-blue-950/30 rounded p-2 text-blue-700 dark:text-blue-400">
                                                💬 Ghi chú: {c.admin_note}
                                            </p>
                                        )}

                                        {/* Meta */}
                                        <p className="text-[11px] text-muted-foreground">
                                            {new Date(c.created_at).toLocaleString('vi-VN')}
                                            {c.reviewed_at && ` · Duyệt: ${new Date(c.reviewed_at).toLocaleString('vi-VN')}`}
                                        </p>
                                    </div>

                                    {/* Status badge */}
                                    <Badge
                                        variant="outline"
                                        className={`shrink-0 text-[10px] ${STATUS_COLORS[c.status]}`}
                                    >
                                        {c.status === 'pending' ? '⏳' : c.status === 'approved' ? '✅' : '❌'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContributionPreview({ contribution }: { contribution: Contribution }) {
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(contribution.new_value); } catch { /* plain text */ }

    if (!parsed) {
        return (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate">
                {contribution.new_value}
            </p>
        );
    }

    if (contribution.field_name === 'add_person') {
        const p = parsed as { displayName?: string; generation?: number; birthYear?: number; gender?: number };
        return (
            <div className="text-xs bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                <p><span className="text-muted-foreground">Họ tên:</span> {p.displayName}</p>
                {p.generation && <p><span className="text-muted-foreground">Đời:</span> {p.generation}</p>}
                {p.birthYear && <p><span className="text-muted-foreground">Năm sinh:</span> {p.birthYear}</p>}
                <p><span className="text-muted-foreground">Giới tính:</span> {p.gender === 1 ? 'Nam' : 'Nữ'}</p>
            </div>
        );
    }

    if (contribution.field_name === 'add_event') {
        const e = parsed as { title?: string; startAt?: string; location?: string; type?: string };
        return (
            <div className="text-xs bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                <p><span className="text-muted-foreground">Tiêu đề:</span> {e.title}</p>
                {e.startAt && <p><span className="text-muted-foreground">Ngày:</span> {new Date(e.startAt).toLocaleDateString('vi-VN')}</p>}
                {e.location && <p><span className="text-muted-foreground">Địa điểm:</span> {e.location}</p>}
            </div>
        );
    }

    if (contribution.field_name === 'add_post') {
        const p = parsed as { title?: string; body?: string };
        return (
            <div className="text-xs bg-muted/50 rounded px-2 py-1.5">
                {p.title && <p className="font-medium">{p.title}</p>}
                <p className="text-muted-foreground line-clamp-2">{p.body}</p>
            </div>
        );
    }

    if (contribution.field_name === 'add_quiz_question') {
        const q = parsed as { question?: string; correctAnswer?: string };
        return (
            <div className="text-xs bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                <p><span className="text-muted-foreground">Câu hỏi:</span> {q.question}</p>
                <p><span className="text-muted-foreground">Đáp án:</span> {q.correctAnswer}</p>
            </div>
        );
    }

    return (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate">
            {contribution.new_value}
        </p>
    );
}
