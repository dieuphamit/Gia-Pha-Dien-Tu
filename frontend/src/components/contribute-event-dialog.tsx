'use client';

import { useState } from 'react';
import { CalendarDays, Send, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { submitContribution } from '@/lib/supabase-data';

const typeLabels: Record<string, string> = {
    MEMORIAL: '🕯️ Giỗ',
    MEETING: '🤝 Họp họ',
    FESTIVAL: '🎊 Lễ hội',
    OTHER: '📅 Khác',
};

interface EventPayload {
    title: string;
    description?: string;
    startAt: string;
    location?: string;
    type: string;
}

export function ContributeEventDialog() {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('MEETING');

    const reset = () => {
        setTitle(''); setDescription(''); setStartAt('');
        setLocation(''); setType('MEETING'); setError(''); setSent(false);
    };

    const handleSubmit = async () => {
        if (!title.trim()) { setError('Vui lòng nhập tên sự kiện'); return; }
        if (!startAt) { setError('Vui lòng chọn ngày giờ'); return; }
        if (!user) { setError('Bạn cần đăng nhập'); return; }

        setSubmitting(true);
        setError('');

        const payload: EventPayload = {
            title: title.trim(),
            description: description.trim() || undefined,
            startAt: new Date(startAt).toISOString(),
            location: location.trim() || undefined,
            type,
        };

        const { error: submitError } = await submitContribution({
            authorId: user.id,
            authorEmail: profile?.email || user.email || '',
            fieldName: 'add_event',
            fieldLabel: 'Thêm sự kiện',
            newValue: JSON.stringify(payload),
            personName: title.trim(),
        });

        setSubmitting(false);
        if (submitError) { setError(submitError); } else { setSent(true); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Đề xuất sự kiện
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-blue-500" />
                        Đề xuất sự kiện mới
                    </DialogTitle>
                </DialogHeader>

                {sent ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Đã gửi đề xuất!</p>
                        <p className="text-xs text-muted-foreground">
                            Quản trị viên / biên tập viên sẽ xem xét và tạo sự kiện.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }}>Đóng</Button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        <Input
                            placeholder="Tên sự kiện *"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                        <Textarea
                            placeholder="Mô tả"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                        />
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Ngày giờ *</label>
                            <Input
                                type="datetime-local"
                                value={startAt}
                                onChange={e => setStartAt(e.target.value)}
                            />
                        </div>
                        <Input
                            placeholder="Địa điểm"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                        <select
                            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                            value={type}
                            onChange={e => setType(e.target.value)}
                        >
                            {Object.entries(typeLabels).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>

                        <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                            📋 Đề xuất này sẽ được xem xét và tạo sự kiện chính thức sau khi duyệt.
                        </p>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || !title.trim() || !startAt}
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
