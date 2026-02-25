'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TreePine, ArrowLeft, Loader2, HelpCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Question {
    id: string;
    question: string;
    hint: string | null;
}

export default function VerifyFamilyPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<string[]>(['', '', '']);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadQuestions() {
            try {
                // Fetch via server API route (service key) so correct_answer never reaches browser
                const res = await fetch('/api/get-questions');
                const json = await res.json();

                if (!json.questions || json.questions.length === 0) {
                    setError('Không thể tải câu hỏi. Vui lòng thử lại sau.');
                    setLoading(false);
                    return;
                }

                setQuestions(json.questions);
            } catch {
                setError('Không thể tải câu hỏi. Vui lòng thử lại sau.');
            } finally {
                setLoading(false);
            }
        }
        loadQuestions();
    }, []);

    const handleAnswerChange = (index: number, value: string) => {
        setAnswers((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate all answers filled
        if (answers.some((a) => a.trim() === '')) {
            setError('Vui lòng trả lời đầy đủ tất cả các câu hỏi.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = questions.map((q, i) => ({
                questionId: q.id,
                answer: answers[i],
            }));

            const res = await fetch('/api/verify-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: payload }),
            });

            const result = await res.json();

            if (result.passed) {
                router.push('/login');
            } else {
                setError(
                    'Bạn chưa đủ điều kiện tham gia nhóm, về hỏi lại cha mẹ anh chị về thông tin gia đình rồi quay lại đăng ký.',
                );
            }
        } catch {
            setError('Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                        <TreePine className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Xác minh thành viên gia tộc</CardTitle>
                <CardDescription>
                    Vui lòng trả lời đúng các câu hỏi về gia đình để xác nhận bạn là thành viên dòng họ Phạm.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Hệ thống chưa có câu hỏi xác minh.</p>
                        <p className="text-sm mt-1">Vui lòng liên hệ admin để được hỗ trợ.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {questions.map((q, index) => (
                            <div key={q.id} className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-0.5">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <label className="text-sm font-medium leading-snug">
                                            {q.question}
                                        </label>
                                        {q.hint && (
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                <HelpCircle className="h-3 w-3" />
                                                Gợi ý: {q.hint}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Nhập câu trả lời..."
                                    value={answers[index]}
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    className="ml-8"
                                    disabled={submitting}
                                />
                            </div>
                        ))}

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push('/welcome')}
                                disabled={submitting}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Quay lại
                            </Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang kiểm tra...</>
                                ) : (
                                    <><CheckCircle className="h-4 w-4 mr-2" /> Xác nhận</>
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
