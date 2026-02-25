'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    CalendarDays, MapPin, Clock, Users, ArrowLeft,
    Check, X, HelpCircle, Loader2, Trash2, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

interface EventDetail {
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
    creator_name?: string;
}

interface RsvpEntry {
    id: string;
    user_id: string;
    status: string;
    user_name?: string;
}

// ── Constants ──────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
    MEMORIAL: { label: 'Giỗ', emoji: '🕯️' },
    MEETING: { label: 'Họp họ', emoji: '🤝' },
    FESTIVAL: { label: 'Lễ hội', emoji: '🎊' },
    OTHER: { label: 'Khác', emoji: '📅' },
};

const RSVP_OPTIONS = [
    { status: 'GOING', label: 'Tham dự', icon: Check, variant: 'default' as const },
    { status: 'MAYBE', label: 'Có thể', icon: HelpCircle, variant: 'secondary' as const },
    { status: 'NOT_GOING', label: 'Không đi', icon: X, variant: 'destructive' as const },
];

const RSVP_LABELS: Record<string, string> = {
    GOING: '✅ Tham dự',
    MAYBE: '🤔 Có thể',
    NOT_GOING: '❌ Không đi',
};

// ── Main Page ──────────────────────────────────────────────────

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoggedIn, isAdmin, canEdit } = useAuth();

    const [event, setEvent] = useState<EventDetail | null>(null);
    const [rsvps, setRsvps] = useState<RsvpEntry[]>([]);
    const [myRsvp, setMyRsvp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── Fetch event (no PostgREST join) ────────────────────────
    const fetchEvent = useCallback(async () => {
        const id = params.id as string;
        if (!id) return;
        setLoading(true);
        try {
            // Step 1: Fetch event row
            const { data, error } = await supabase
                .from('events')
                .select('id, title, description, start_at, end_at, location, type, is_recurring, creator_id, created_at')
                .eq('id', id)
                .maybeSingle();

            if (error || !data) {
                setNotFound(true);
                return;
            }

            // Step 2: Get creator name separately
            let creator_name: string | undefined;
            if (data.creator_id) {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('display_name, email')
                    .eq('id', data.creator_id)
                    .maybeSingle();
                if (prof) {
                    creator_name = prof.display_name || prof.email?.split('@')[0];
                }
            }

            setEvent({ ...data, creator_name });

            // Step 3: Fetch RSVPs
            const { data: rsvpData } = await supabase
                .from('event_rsvps')
                .select('id, user_id, status')
                .eq('event_id', id);

            if (rsvpData && rsvpData.length > 0) {
                // Enrich RSVP user names
                const userIds = [...new Set(rsvpData.map((r: { user_id: string }) => r.user_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, display_name, email')
                    .in('id', userIds);
                const profileMap: Record<string, string> = {};
                profiles?.forEach((p: { id: string; display_name: string | null; email: string }) => {
                    profileMap[p.id] = p.display_name || p.email?.split('@')[0] || 'Ẩn danh';
                });

                const enriched: RsvpEntry[] = rsvpData.map((r: { id: string; user_id: string; status: string }) => ({
                    ...r,
                    user_name: profileMap[r.user_id] || 'Ẩn danh',
                }));
                setRsvps(enriched);

                if (user) {
                    const mine = enriched.find(r => r.user_id === user.id);
                    setMyRsvp(mine?.status ?? null);
                }
            } else {
                setRsvps([]);
            }
        } catch {
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }, [params.id, user]);

    useEffect(() => { fetchEvent(); }, [fetchEvent]);

    // ── RSVP handler ───────────────────────────────────────────
    const handleRsvp = async (status: string) => {
        if (!user || !params.id) return;
        const { error } = await supabase
            .from('event_rsvps')
            .upsert(
                { event_id: params.id, user_id: user.id, status },
                { onConflict: 'event_id,user_id' }
            );
        if (!error) {
            setMyRsvp(status);
            fetchEvent();
        }
    };

    // ── Delete handler ─────────────────────────────────────────
    const handleDelete = async () => {
        if (!event) return;
        setDeleting(true);
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', event.id);
        if (!error) {
            router.push('/events');
        } else {
            setDeleting(false);
        }
    };

    // ── Render states ──────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (notFound || !event) {
        return (
            <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">Không tìm thấy sự kiện</p>
                <p className="text-sm text-muted-foreground">Sự kiện không tồn tại hoặc đã bị xóa</p>
                <Button variant="outline" onClick={() => router.push('/events')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại danh sách
                </Button>
            </div>
        );
    }

    const tl = TYPE_LABELS[event.type] || TYPE_LABELS.OTHER;
    const goingCount = rsvps.filter(r => r.status === 'GOING').length;
    const isCreator = user?.id === event.creator_id;
    const canDelete = isAdmin || isCreator;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Nav */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.push('/events')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Button>

                {/* Delete button — admin hoặc người tạo */}
                {canDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deleting}
                            >
                                {deleting
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Trash2 className="mr-2 h-4 w-4" />
                                }
                                Xóa sự kiện
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xóa sự kiện?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Sự kiện <strong>&ldquo;{event.title}&rdquo;</strong> sẽ bị xóa vĩnh viễn.
                                    Tất cả đăng ký tham dự cũng sẽ bị xóa theo. Không thể hoàn tác.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Xóa vĩnh viễn
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            {/* Event Detail Card */}
            <Card>
                <CardHeader>
                    <Badge variant="secondary" className="w-fit text-sm">
                        {tl.emoji} {tl.label}
                    </Badge>
                    <CardTitle className="text-2xl mt-1">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {event.description && (
                        <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                    )}

                    <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-2.5">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>
                                {new Date(event.start_at).toLocaleString('vi-VN', {
                                    weekday: 'long', day: 'numeric', month: 'long',
                                    year: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                            </span>
                        </div>
                        {event.end_at && (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span>Kết thúc: {new Date(event.end_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' })}</span>
                            </div>
                        )}
                        {event.location && (
                            <div className="flex items-center gap-2.5">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>{event.location}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2.5">
                            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>
                                {goingCount > 0
                                    ? <><strong>{goingCount}</strong> người sẽ tham dự</>
                                    : 'Chưa có ai đăng ký tham dự'
                                }
                            </span>
                        </div>
                        {event.creator_name && (
                            <div className="flex items-center gap-2.5">
                                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>Tạo bởi <strong>{event.creator_name}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* RSVP section */}
                    {isLoggedIn && (
                        <div className="pt-4 border-t space-y-2">
                            <p className="text-sm font-medium">Bạn có tham gia không?</p>
                            <div className="flex flex-wrap gap-2">
                                {RSVP_OPTIONS.map(opt => (
                                    <Button
                                        key={opt.status}
                                        variant={myRsvp === opt.status ? opt.variant : 'outline'}
                                        size="sm"
                                        onClick={() => handleRsvp(opt.status)}
                                    >
                                        <opt.icon className="mr-1.5 h-4 w-4" />
                                        {opt.label}
                                        {myRsvp === opt.status && ' ✓'}
                                    </Button>
                                ))}
                            </div>
                            {myRsvp && (
                                <p className="text-xs text-muted-foreground">
                                    Phản hồi của bạn: <span className="font-medium">{RSVP_LABELS[myRsvp]}</span>
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* RSVP List */}
            {rsvps.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Danh sách phản hồi ({rsvps.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {rsvps.map(r => (
                                <div key={r.id} className="flex items-center justify-between text-sm py-1">
                                    <span className="font-medium">{r.user_name}</span>
                                    <Badge
                                        variant={
                                            r.status === 'GOING' ? 'default' :
                                                r.status === 'NOT_GOING' ? 'destructive' : 'secondary'
                                        }
                                        className="text-xs"
                                    >
                                        {RSVP_LABELS[r.status] || r.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
