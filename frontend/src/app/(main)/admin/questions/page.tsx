'use client';

import { useState, useCallback, useEffect } from 'react';
import { HelpCircle, Plus, Pencil, Trash2, RefreshCw, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

interface Question {
    id: string;
    question: string;
    correct_answer: string;
    hint: string | null;
    is_active: boolean;
    created_at: string;
}

interface QuestionForm {
    question: string;
    correct_answer: string;
    hint: string;
}

const emptyForm: QuestionForm = { question: '', correct_answer: '', hint: '' };

export default function AdminQuestionsPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<QuestionForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_questions')
                .select('*')
                .order('created_at', { ascending: true });
            if (!error && data) setQuestions(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!authLoading && isAdmin) fetchQuestions();
    }, [authLoading, isAdmin, fetchQuestions]);

    const openAddDialog = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError('');
        setDialogOpen(true);
    };

    const openEditDialog = (q: Question) => {
        setEditingId(q.id);
        setForm({ question: q.question, correct_answer: q.correct_answer, hint: q.hint ?? '' });
        setFormError('');
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.question.trim()) { setFormError('Vui lòng nhập câu hỏi.'); return; }
        if (!form.correct_answer.trim()) { setFormError('Vui lòng nhập đáp án đúng.'); return; }

        setSaving(true);
        setFormError('');
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('family_questions')
                    .update({ question: form.question.trim(), correct_answer: form.correct_answer.trim(), hint: form.hint.trim() || null })
                    .eq('id', editingId);
                if (error) { setFormError('Lỗi khi cập nhật câu hỏi.'); return; }
                setQuestions(prev => prev.map(q =>
                    q.id === editingId
                        ? { ...q, question: form.question.trim(), correct_answer: form.correct_answer.trim(), hint: form.hint.trim() || null }
                        : q
                ));
            } else {
                const { data, error } = await supabase
                    .from('family_questions')
                    .insert({ question: form.question.trim(), correct_answer: form.correct_answer.trim(), hint: form.hint.trim() || null, is_active: true })
                    .select()
                    .single();
                if (error || !data) { setFormError('Lỗi khi thêm câu hỏi.'); return; }
                setQuestions(prev => [...prev, data]);
            }
            setDialogOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = useCallback(async (id: string, currentActive: boolean) => {
        const { error } = await supabase
            .from('family_questions')
            .update({ is_active: !currentActive })
            .eq('id', id);
        if (!error) {
            setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: !currentActive } : q));
        }
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
        const { error } = await supabase.from('family_questions').delete().eq('id', id);
        if (!error) {
            setQuestions(prev => prev.filter(q => q.id !== id));
        }
    }, []);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">Bạn không có quyền truy cập trang này.</p>
            </div>
        );
    }

    const activeCount = questions.filter(q => q.is_active).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <HelpCircle className="h-6 w-6" />
                        Câu hỏi xác minh gia đình
                    </h1>
                    <p className="text-muted-foreground">
                        Quản lý danh sách câu hỏi dùng để xác minh thành viên trước khi đăng ký
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchQuestions}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button onClick={openAddDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Thêm câu hỏi
                    </Button>
                </div>
            </div>

            {activeCount < 3 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
                    ⚠️ Hiện chỉ có <strong>{activeCount}</strong> câu hỏi đang hoạt động. Cần ít nhất <strong>3 câu</strong> để quiz hoạt động đúng.
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Danh sách câu hỏi</CardTitle>
                    <CardDescription>
                        {activeCount} đang hoạt động / {questions.length} tổng số câu hỏi
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Chưa có câu hỏi nào</p>
                            <p className="text-sm mt-1">Nhấn &quot;Thêm câu hỏi&quot; để bắt đầu</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>Câu hỏi</TableHead>
                                    <TableHead>Đáp án đúng</TableHead>
                                    <TableHead>Gợi ý</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead className="w-24"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {questions.map((q, index) => (
                                    <TableRow key={q.id} className={!q.is_active ? 'opacity-50' : ''}>
                                        <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                                        <TableCell className="font-medium max-w-xs">
                                            <span className="line-clamp-2">{q.question}</span>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">{q.correct_answer}</code>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {q.hint || <span className="italic">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <button onClick={() => handleToggleActive(q.id, q.is_active)}>
                                                {q.is_active ? (
                                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 cursor-pointer">
                                                        <Check className="h-3 w-3 mr-1" /> Hoạt động
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                                                        <X className="h-3 w-3 mr-1" /> Ẩn
                                                    </Badge>
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(q.created_at).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(q)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(q.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</DialogTitle>
                        <DialogDescription>
                            Câu hỏi này sẽ được dùng để xác minh thành viên trước khi đăng ký tài khoản.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        {formError && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Câu hỏi <span className="text-destructive">*</span></label>
                            <Input
                                placeholder="VD: Tên của ông nội là gì?"
                                value={form.question}
                                onChange={e => setForm(prev => ({ ...prev, question: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Đáp án đúng <span className="text-destructive">*</span></label>
                            <Input
                                placeholder="VD: Phạm Hướng"
                                value={form.correct_answer}
                                onChange={e => setForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">So sánh không phân biệt hoa/thường, bỏ qua khoảng trắng thừa.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Gợi ý (không bắt buộc)</label>
                            <Input
                                placeholder="VD: Ông sinh năm 1920"
                                value={form.hint}
                                onChange={e => setForm(prev => ({ ...prev, hint: e.target.value }))}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Hủy
                            </Button>
                            <Button className="flex-1" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                {editingId ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
