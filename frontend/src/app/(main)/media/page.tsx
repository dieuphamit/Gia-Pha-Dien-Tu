'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
    Image as ImageIcon, Upload, Search, Check, X, Loader2, Trash2,
    FileText, ChevronLeft, ChevronRight, Eye, Filter, Star, User,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────
interface MediaItem {
    id: string;
    file_name: string;
    mime_type: string | null;
    file_size: number | null;
    title: string | null;
    description: string | null;
    state: string;
    uploader_id: string | null;
    storage_url: string | null;
    media_type: string | null;
    linked_person: string | null;
    created_at: string;
    uploader?: { display_name: string | null; email: string };
}

const PAGE_SIZE = 20;

const STATE_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
    PENDING: { variant: 'secondary', label: 'Chờ duyệt' },
    PUBLISHED: { variant: 'default', label: 'Đã duyệt' },
    REJECTED: { variant: 'destructive', label: 'Từ chối' },
};

function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

// ── Main Page ────────────────────────────────────────────────
export default function MediaLibraryPage() {
    const { user, isAdmin, canEdit } = useAuth();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'IMAGE' | 'DOCUMENT'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);

    const fileRef = useRef<HTMLInputElement>(null);
    // ── Fix duplicate: dùng ref lock, không dùng state ────────
    const uploadingRef = useRef(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [preview, setPreview] = useState<MediaItem | null>(null);
    const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
    const [personNameMap, setPersonNameMap] = useState<Map<string, string>>(new Map());

    // ── Fetch ────────────────────────────────────────────────
    const fetchMedia = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('media')
            .select('*, uploader:profiles(display_name, email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (tab !== 'all') query = query.eq('state', tab);
        if (typeFilter !== 'all') query = query.eq('media_type', typeFilter);
        if (search.trim()) query = query.ilike('file_name', `%${search.trim()}%`);

        const { data, count } = await query;
        if (data) {
            setItems(data);
            // Fetch person names for all linked_person handles in batch
            const handles = [...new Set(data
                .map((m: Record<string, unknown>) => m.linked_person as string | null)
                .filter((h): h is string => !!h))];
            if (handles.length > 0) {
                const { data: people } = await supabase
                    .from('people')
                    .select('handle, display_name')
                    .in('handle', handles);
                if (people) {
                    const map = new Map<string, string>();
                    people.forEach((p: Record<string, unknown>) => map.set(p.handle as string, p.display_name as string));
                    setPersonNameMap(map);
                }
            }
        }
        if (count !== null) setTotal(count);
        setLoading(false);
    }, [tab, typeFilter, search, page]);

    useEffect(() => { fetchMedia(); }, [fetchMedia]);
    useEffect(() => { setPage(0); }, [tab, typeFilter, search]);

    // ── Realtime: cập nhật ngay khi media thay đổi ───────────
    // (admin approve/reject → các client khác tự cập nhật)
    useEffect(() => {
        const ch = supabase
            .channel('media-library-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, () => {
                fetchMedia();
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [fetchMedia]);

    // ── Fetch quota của user ─────────────────────────────────
    const fetchQuota = useCallback(async () => {
        if (!user) return;
        const { count } = await supabase
            .from('media')
            .select('id', { count: 'exact', head: true })
            .eq('uploader_id', user.id)
            .in('state', ['PENDING', 'PUBLISHED']);
        const { data: limitRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'media_upload_limit')
            .single();
        setQuota({ used: count ?? 0, limit: parseInt(limitRow?.value ?? '5', 10) });
    }, [user]);

    useEffect(() => { fetchQuota(); }, [fetchQuota]);

    // ── Upload ───────────────────────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // ── Client-side size check ───────────────────────────
        const isImage = file.type.startsWith('image/');
        if (isImage && file.size > 5 * 1024 * 1024) {
            setUploadError('Ảnh quá lớn. Giới hạn 5MB.');
            if (fileRef.current) fileRef.current.value = '';
            return;
        }

        // ── Lock: tránh double-fire ──────────────────────────
        if (uploadingRef.current) return;
        uploadingRef.current = true;
        setUploading(true);
        setUploadError(null);

        // Reset input ngay để không fire lại
        if (fileRef.current) fileRef.current.value = '';

        try {
            const token = await getToken();
            if (!token) throw new Error('Chưa đăng nhập');

            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Upload thất bại');

            // Cập nhật quota từ response
            if (json.quota) setQuota(json.quota);
            fetchMedia();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Lỗi không xác định');
        } finally {
            uploadingRef.current = false;
            setUploading(false);
        }
    };

    // ── Approve / Reject ─────────────────────────────────────
    const handleAction = async (id: string, state: 'PUBLISHED' | 'REJECTED') => {
        setUploadError(null);
        try {
            const token = await getToken();
            const res = await fetch(`/api/media/${id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setUploadError((json as { error?: string }).error || 'Thao tác thất bại');
                return;
            }
        } catch {
            setUploadError('Lỗi kết nối');
            return;
        }
        // Realtime sẽ trigger fetchMedia tự động,
        // nhưng gọi thêm để đảm bảo (REJECTED xóa khỏi danh sách ngay)
        fetchMedia();
        fetchQuota();
    };

    // ── Set as Avatar ─────────────────────────────────────────
    const handleSetAvatar = async (item: MediaItem) => {
        if (!item.linked_person) return;
        setUploadError(null);
        try {
            const token = await getToken();
            const res = await fetch(`/api/people/${item.linked_person}/set-avatar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaId: item.id }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setUploadError((json as { error?: string }).error || 'Không đặt được ảnh đại diện');
            }
        } catch {
            setUploadError('Lỗi kết nối');
        }
    };

    // ── Delete ───────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa file này?')) return;
        const token = await getToken();
        await fetch(`/api/media/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchMedia();
        fetchQuota();
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const isQuotaFull = !isAdmin && !canEdit && quota !== null && quota.used >= quota.limit;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ImageIcon className="h-6 w-6" />
                        Thư viện
                    </h1>
                    <p className="text-muted-foreground">Quản lý hình ảnh và tài liệu gia phả</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Quota badge cho member */}
                    {!isAdmin && !canEdit && quota && (
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${isQuotaFull
                                ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20'
                                : 'border-border text-muted-foreground'
                            }`}>
                            {quota.used}/{quota.limit} file
                        </span>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={handleUpload}
                    />
                    <Button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || isQuotaFull}
                        title={isQuotaFull ? `Đã đạt giới hạn ${quota?.limit} file` : undefined}
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? 'Đang tải...' : 'Tải lên'}
                    </Button>
                </div>
            </div>

            {/* Upload error */}
            {uploadError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                    <X className="h-4 w-4 shrink-0" />{uploadError}
                    <Button variant="ghost" size="sm" className="ml-auto h-auto p-0" onClick={() => setUploadError(null)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <Tabs value={tab} onValueChange={(v) => setTab(v)}>
                    <TabsList>
                        <TabsTrigger value="all">Tất cả</TabsTrigger>
                        <TabsTrigger value="PENDING">Chờ duyệt</TabsTrigger>
                        <TabsTrigger value="PUBLISHED">Đã duyệt</TabsTrigger>
                        {(isAdmin || canEdit) && <TabsTrigger value="REJECTED">Từ chối</TabsTrigger>}
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-1 rounded-md border p-1">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                    {(['all', 'IMAGE', 'DOCUMENT'] as const).map((t) => (
                        <Button key={t} variant={typeFilter === t ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setTypeFilter(t)}>
                            {t === 'all' ? 'Tất cả' : t === 'IMAGE' ? '🖼 Ảnh' : '📄 PDF'}
                        </Button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm theo tên file..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <span className="text-sm text-muted-foreground ml-auto">{total} file</span>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Không có file nào</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {items.map((item) => (
                        <MediaCard
                            key={item.id}
                            item={item}
                            userId={user?.id}
                            isAdmin={isAdmin}
                            canEdit={canEdit}
                            linkedPersonName={item.linked_person ? personNameMap.get(item.linked_person) : undefined}
                            onPreview={() => setPreview(item)}
                            onApprove={() => handleAction(item.id, 'PUBLISHED')}
                            onReject={() => handleAction(item.id, 'REJECTED')}
                            onDelete={() => handleDelete(item.id)}
                            onSetAvatar={canEdit && item.state === 'PUBLISHED' && item.media_type === 'IMAGE' && item.linked_person ? () => handleSetAvatar(item) : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Trang {page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Lightbox */}
            <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="truncate">{preview?.title || preview?.file_name}</DialogTitle>
                    </DialogHeader>
                    {preview?.storage_url && preview.media_type === 'IMAGE' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.storage_url} alt={preview.title || preview.file_name} className="w-full rounded-lg object-contain max-h-[70vh]" />
                    )}
                    {preview?.storage_url && preview.media_type === 'DOCUMENT' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <FileText className="h-16 w-16 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{preview.file_name}</p>
                            <Button asChild>
                                <a href={preview.storage_url} target="_blank" rel="noopener noreferrer">Mở PDF</a>
                            </Button>
                        </div>
                    )}
                    {!preview?.storage_url && (
                        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                            <ImageIcon className="h-12 w-12" /><p className="text-sm">File chưa được tải lên</p>
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground space-y-1">
                        <p>Kích thước: {formatSize(preview?.file_size ?? null)}</p>
                        <p>Người tải: {preview?.uploader?.display_name || preview?.uploader?.email?.split('@')[0] || '—'}</p>
                        <p>Ngày tải: {preview ? new Date(preview.created_at).toLocaleString('vi-VN') : ''}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── MediaCard ─────────────────────────────────────────────────
function MediaCard({
    item, userId, isAdmin, canEdit, linkedPersonName,
    onPreview, onApprove, onReject, onDelete, onSetAvatar,
}: {
    item: MediaItem;
    userId?: string;
    isAdmin: boolean;
    canEdit: boolean;
    linkedPersonName?: string;
    onPreview: () => void;
    onApprove: () => void;
    onReject: () => void;
    onDelete: () => void;
    onSetAvatar?: () => void;
}) {
    const isOwner = item.uploader_id === userId;
    const canDelete = isAdmin || isOwner;
    const canApprove = isAdmin || canEdit;

    return (
        <Card className="group overflow-hidden">
            <div className="relative aspect-square bg-muted cursor-pointer overflow-hidden" onClick={onPreview}>
                {item.media_type === 'IMAGE' && item.storage_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.storage_url}
                        alt={item.title || item.file_name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                        <FileText className="h-10 w-10 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">PDF</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Eye className="h-6 w-6 text-white" />
                </div>
                <div className="absolute top-1.5 right-1.5">
                    <Badge variant={STATE_BADGE[item.state]?.variant || 'secondary'} className="text-[10px] px-1.5 py-0.5">
                        {STATE_BADGE[item.state]?.label || item.state}
                    </Badge>
                </div>
            </div>
            <CardContent className="p-2 space-y-1.5">
                <p className="text-xs font-medium truncate" title={item.title || item.file_name}>
                    {item.title || item.file_name}
                </p>
                {/* Linked person info */}
                {item.linked_person && (
                    <Link
                        href={`/people/${item.linked_person}`}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline truncate"
                        onClick={e => e.stopPropagation()}
                    >
                        <User className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{linkedPersonName || item.linked_person}</span>
                    </Link>
                )}
                <p className="text-[10px] text-muted-foreground">
                    {formatSize(item.file_size)} · {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </p>
                <div className="flex gap-1 flex-wrap">
                    {canApprove && item.state === 'PENDING' && (
                        <>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1" onClick={onApprove}>
                                <Check className="h-2.5 w-2.5 mr-1" />Duyệt
                            </Button>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2 flex-1" onClick={onReject}>
                                <X className="h-2.5 w-2.5 mr-1" />Từ chối
                            </Button>
                        </>
                    )}
                    {onSetAvatar && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={e => { e.stopPropagation(); onSetAvatar(); }}
                            title="Đặt làm ảnh đại diện"
                        >
                            <Star className="h-2.5 w-2.5" />
                        </Button>
                    )}
                    {canDelete && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
                            <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
