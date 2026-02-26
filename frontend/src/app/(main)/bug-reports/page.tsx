'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bug, Send, RefreshCw, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────

interface BugReport {
    id: string;
    category: string;
    title: string;
    description: string;
    steps_to_reproduce: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
}

// ── Constants ────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'display_error', label: '🖥️ Lỗi hiển thị' },
    { value: 'feature_not_working', label: '⚙️ Tính năng không hoạt động' },
    { value: 'wrong_information', label: '📋 Thông tin sai hoặc thiếu' },
    { value: 'loading_error', label: '🔄 Trang tải lỗi / chậm' },
    { value: 'suggestion', label: '💡 Góp ý cải thiện' },
    { value: 'other', label: '📝 Khác' },
] as const;

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

// ── Component ────────────────────────────────────────────────

export default function BugReportsPage() {
    const { isLoggedIn, loading: authLoading } = useAuth();
    const router = useRouter();

    // Form state
    const [category, setCategory] = useState<string>('bug_content');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // List state
    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setLoading(false); return; }

        const res = await fetch('/api/bug-reports', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
            const json = await res.json();
            setReports(json.data ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!isLoggedIn) { router.push('/'); return; }
        fetchReports();
    }, [authLoading, isLoggedIn, fetchReports, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');
        if (!title.trim() || !description.trim()) {
            setSubmitError('Vui lòng nhập tiêu đề và mô tả.');
            return;
        }

        setSubmitting(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setSubmitting(false); return; }

        const res = await fetch('/api/bug-reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ category, title, description, steps_to_reproduce: steps }),
        });

        if (res.ok) {
            setSubmitSuccess(true);
            setTitle('');
            setDescription('');
            setSteps('');
            setCategory('bug_content');
            fetchReports();
            setTimeout(() => setSubmitSuccess(false), 5000);
        } else {
            const json = await res.json().catch(() => ({}));
            setSubmitError(json.error || 'Có lỗi xảy ra, vui lòng thử lại.');
        }
        setSubmitting(false);
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Bug className="h-7 w-7 text-primary" />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Báo cáo Bug</h1>
                    <p className="text-muted-foreground text-sm">Gửi báo cáo lỗi để giúp chúng tôi cải thiện ứng dụng</p>
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Gửi báo cáo mới</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Category */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Loại báo cáo <span className="text-destructive">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => setCategory(cat.value)}
                                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${category === cat.value
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'border-border hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <label htmlFor="bug-title" className="text-sm font-medium leading-none">Tiêu đề <span className="text-destructive">*</span></label>
                            <Input
                                id="bug-title"
                                placeholder="Mô tả ngắn gọn về lỗi..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                maxLength={200}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label htmlFor="bug-desc" className="text-sm font-medium leading-none">Nội dung bug <span className="text-destructive">*</span></label>
                            <Textarea
                                id="bug-desc"
                                placeholder="Mô tả chi tiết về lỗi bạn gặp phải..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4}
                                maxLength={2000}
                            />
                            <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
                        </div>

                        {/* Steps */}
                        <div className="space-y-2">
                            <label htmlFor="bug-steps" className="text-sm font-medium leading-none">Cách tái hiện <span className="text-muted-foreground text-xs">(tuỳ chọn)</span></label>
                            <Textarea
                                id="bug-steps"
                                placeholder="1. Vào trang...&#10;2. Click vào...&#10;3. Lỗi xuất hiện..."
                                value={steps}
                                onChange={e => setSteps(e.target.value)}
                                rows={3}
                                maxLength={1000}
                            />
                        </div>

                        {/* Error / Success */}
                        {submitError && (
                            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
                        )}
                        {submitSuccess && (
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Cảm ơn! Báo cáo của bạn đã được gửi thành công.
                            </div>
                        )}

                        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                            {submitting
                                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Đang gửi...</>
                                : <><Send className="h-4 w-4 mr-2" />Gửi báo cáo</>
                            }
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* My reports */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Báo cáo của tôi</h2>
                    <Button variant="ghost" size="sm" onClick={fetchReports} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-24">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                ) : reports.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground text-sm">
                            Bạn chưa gửi báo cáo bug nào.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {reports.map(report => {
                            const sc = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open;
                            const isExpanded = expandedId === report.id;
                            return (
                                <Card key={report.id} className="overflow-hidden">
                                    <button
                                        className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
                                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-muted-foreground">
                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-medium text-sm truncate">{report.title}</p>
                                                    <Badge variant="secondary" className={`${sc.className} flex items-center gap-1 text-[10px] shrink-0`}>
                                                        {sc.icon} {sc.label}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {CATEGORY_LABELS[report.category] || report.category} · {new Date(report.created_at).toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t px-4 py-3 bg-muted/20 space-y-3 text-sm">
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Nội dung bug</p>
                                                <p className="whitespace-pre-wrap">{report.description}</p>
                                            </div>
                                            {report.steps_to_reproduce && (
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Cách tái hiện</p>
                                                    <p className="whitespace-pre-wrap">{report.steps_to_reproduce}</p>
                                                </div>
                                            )}
                                            {report.admin_note && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                                                    <p className="font-medium text-xs text-blue-700 dark:text-blue-300 uppercase mb-1">Phản hồi từ admin</p>
                                                    <p className="text-blue-900 dark:text-blue-100">{report.admin_note}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
