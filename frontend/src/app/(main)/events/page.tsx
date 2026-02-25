'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    CalendarDays,
    MapPin,
    Clock,
    Users,
    Plus,
    AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { supabase } from '@/lib/supabase';

interface EventItem {
    id: string;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    location: string | null;
    type: string;
    is_recurring: boolean;
    creator_id: string;
    created_at: string;
    creator_name?: string;  // enriched client-side
    rsvp_count?: number;
}

const typeLabels: Record<string, { label: string; emoji: string }> = {
    MEMORIAL: { label: 'Giỗ', emoji: '🕯️' },
    MEETING: { label: 'Họp họ', emoji: '🤝' },
    FESTIVAL: { label: 'Lễ hội', emoji: '🎊' },
    OTHER: { label: 'Khác', emoji: '📅' },
};

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
    });
}

// === Create Event Dialog ===

function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('MEETING');

    const handleSubmit = async () => {
        if (!title.trim() || !startAt || !user) return;
        setSubmitting(true);
        setError(null);
        try {
            const { error: insertError } = await supabase.from('events').insert({
                title: title.trim(),
                description: description.trim() || null,
                start_at: new Date(startAt).toISOString(),
                location: location.trim() || null,
                type,
                creator_id: user.id,
            });
            if (insertError) {
                setError(`Lỗi tạo sự kiện: ${insertError.message}`);
            } else {
                setOpen(false);
                setTitle(''); setDescription(''); setStartAt(''); setLocation('');
                setError(null);
                onCreated();
            }
        } finally { setSubmitting(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Tạo sự kiện</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Tạo sự kiện mới</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                    <Input placeholder="Tên sự kiện *" value={title} onChange={e => setTitle(e.target.value)} />
                    <Textarea placeholder="Mô tả" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Ngày giờ *</label>
                        <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
                    </div>
                    <Input placeholder="Địa điểm" value={location} onChange={e => setLocation(e.target.value)} />
                    <select
                        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                        value={type}
                        onChange={e => setType(e.target.value)}
                    >
                        {Object.entries(typeLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                        ))}
                    </select>
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    <Button
                        className="w-full"
                        onClick={handleSubmit}
                        disabled={!title.trim() || !startAt || submitting}
                    >
                        {submitting ? 'Đang tạo...' : 'Tạo sự kiện'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// === Event Card ===

function EventCard({ event }: { event: EventItem }) {
    const router = useRouter();
    const tl = typeLabels[event.type] || typeLabels.OTHER;

    return (
        <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/events/${event.id}`)}
        >
            <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                    <div>
                        <Badge variant="secondary" className="text-xs mb-1">{tl.emoji} {tl.label}</Badge>
                        <h3 className="font-semibold">{event.title}</h3>
                    </div>
                    {event.rsvp_count !== undefined && event.rsvp_count > 0 && (
                        <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{event.rsvp_count}</Badge>
                    )}
                </div>
                {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(event.start_at)} · {formatTime(event.start_at)}
                    </span>
                    {event.location && (
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{event.location}
                        </span>
                    )}
                    {event.creator_name && (
                        <span className="text-xs text-muted-foreground/70">
                            bởi {event.creator_name}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// === Main Page ===

export default function EventsPage() {
    const { canEdit } = useAuth();
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            // Step 1: Fetch events WITHOUT join
            const { data, error } = await supabase
                .from('events')
                .select('id, title, description, start_at, end_at, location, type, is_recurring, creator_id, created_at')
                .order('start_at', { ascending: true });

            if (error) {
                setFetchError(`Không thể tải sự kiện: ${error.message}`);
                return;
            }
            if (!data || data.length === 0) {
                setEvents([]);
                return;
            }

            // Step 2: Enrich creator names separately
            const creatorIds = [...new Set(data.map((e: EventItem) => e.creator_id).filter(Boolean))];
            const profileMap: Record<string, string> = {};
            if (creatorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, display_name, email')
                    .in('id', creatorIds);
                profiles?.forEach((p: { id: string; display_name: string | null; email: string }) => {
                    profileMap[p.id] = p.display_name || p.email?.split('@')[0] || 'Ẩn danh';
                });
            }

            // Step 3: RSVP counts
            const eventIds = data.map((e: EventItem) => e.id);
            const rsvpMap: Record<string, number> = {};
            const { data: rsvps } = await supabase
                .from('event_rsvps')
                .select('event_id')
                .in('event_id', eventIds)
                .eq('status', 'GOING');
            rsvps?.forEach((r: { event_id: string }) => {
                rsvpMap[r.event_id] = (rsvpMap[r.event_id] || 0) + 1;
            });

            setEvents(data.map((e: EventItem) => ({
                ...e,
                creator_name: profileMap[e.creator_id] || undefined,
                rsvp_count: rsvpMap[e.id] || 0,
            })));
        } catch (ex) {
            setFetchError(`Lỗi kết nối: ${ex instanceof Error ? ex.message : 'Unknown'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // Separate upcoming vs past
    const now = new Date();
    const upcoming = events.filter(e => new Date(e.start_at) >= now);
    const past = events.filter(e => new Date(e.start_at) < now);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6" />
                        Sự kiện
                    </h1>
                    <p className="text-muted-foreground">Lịch các hoạt động dòng họ</p>
                </div>
                {canEdit && <CreateEventDialog onCreated={fetchEvents} />}
            </div>

            {fetchError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {fetchError}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : events.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Chưa có sự kiện nào</p>
                        {canEdit && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Nhấn nút &ldquo;Tạo sự kiện&rdquo; để thêm sự kiện đầu tiên
                            </p>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {upcoming.length > 0 && (
                        <section>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                Sắp diễn ra ({upcoming.length})
                            </h2>
                            <div className="grid gap-4">
                                {upcoming.map(e => <EventCard key={e.id} event={e} />)}
                            </div>
                        </section>
                    )}
                    {past.length > 0 && (
                        <section>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                Đã diễn ra ({past.length})
                            </h2>
                            <div className="grid gap-4 opacity-70">
                                {past.map(e => <EventCard key={e.id} event={e} />)}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
