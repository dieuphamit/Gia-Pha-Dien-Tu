'use client';

import { useState } from 'react';
import { HelpCircle, Send, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { submitContribution } from '@/lib/supabase-data';

interface QuizQuestionPayload {
    question: string;
    correctAnswer: string;
    hint?: string;
}

export function ContributeQuizQuestionDialog() {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const [question, setQuestion] = useState('');
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [hint, setHint] = useState('');

    const reset = () => {
        setQuestion(''); setCorrectAnswer(''); setHint('');
        setError(''); setSent(false);
    };

    const handleSubmit = async () => {
        if (!question.trim()) { setError('Vui lòng nhập câu hỏi'); return; }
        if (!correctAnswer.trim()) { setError('Vui lòng nhập đáp án đúng'); return; }
        if (!user) { setError('Bạn cần đăng nhập'); return; }

        setSubmitting(true);
        setError('');

        const payload: QuizQuestionPayload = {
            question: question.trim(),
            correctAnswer: correctAnswer.trim(),
            hint: hint.trim() || undefined,
        };

        const { error: submitError } = await submitContribution({
            authorId: user.id,
            authorEmail: profile?.email || user.email || '',
            fieldName: 'add_quiz_question',
            fieldLabel: 'Đề xuất câu hỏi xác minh',
            newValue: JSON.stringify(payload),
            personName: question.trim().slice(0, 80),
        });

        setSubmitting(false);
        if (submitError) { setError(submitError); } else { setSent(true); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Đề xuất câu hỏi xác minh
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-500" />
                        Đề xuất câu hỏi xác minh
                    </DialogTitle>
                </DialogHeader>

                {sent ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Đã gửi đề xuất!</p>
                        <p className="text-xs text-muted-foreground">
                            Quản trị viên sẽ xem xét và thêm câu hỏi vào hệ thống.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }}>Đóng</Button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Câu hỏi *</label>
                            <Input
                                placeholder="VD: Ông tổ của dòng họ tên là gì?"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Đáp án đúng *</label>
                            <Input
                                placeholder="VD: Phạm Văn Tổ"
                                value={correctAnswer}
                                onChange={e => setCorrectAnswer(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Gợi ý (tùy chọn)</label>
                            <Input
                                placeholder="VD: Xem phả hệ đời 1"
                                value={hint}
                                onChange={e => setHint(e.target.value)}
                            />
                        </div>

                        <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                            📋 Câu hỏi đề xuất sẽ được quản trị viên xem xét trước khi thêm vào bộ câu hỏi xác minh đăng ký.
                        </p>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || !question.trim() || !correctAnswer.trim()}
                            >
                                {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4 mr-2" />Gửi đề xuất</>}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
