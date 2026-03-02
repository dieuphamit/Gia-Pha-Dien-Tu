'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Newspaper,
    MessageCircle,
    PenSquare,
    Pin,
    Trash2,
    ChevronDown,
    Send,
    User,
    Calendar,
    AlertCircle,
    MessageSquarePlus,
    CheckCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import {
    submitContribution,
    insertNotificationsForAllUsers,
    fetchUnreadContentIds,
    markPostNotificationRead,
    markNotificationsReadByType,
} from '@/lib/supabase-data';

// === Types ===

interface Post {
    id: string;
    author_id: string;
    type: string;
    title: string | null;
    body: string;
    is_pinned: boolean;
    status: string;
    created_at: string;
    updated_at: string;
    author_name?: string;   // enriched client-side
    comment_count?: number;
}

interface Comment {
    id: string;
    author_id: string;
    body: string;
    created_at: string;
    author_name?: string;
}

// === Post Composer ===

function PostComposer({ onPostCreated }: { onPostCreated: () => void }) {
    const { user, canEdit } = useAuth();
    const [body, setBody] = useState('');
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!body.trim() || !user) return;
        setSubmitting(true);
        setError(null);
        try {
            const { data: newPost, error: insertError } = await supabase
                .from('posts')
                .insert({
                    author_id: user.id,
                    title: title.trim() || null,
                    body: body.trim(),
                    type: 'general',
                    status: 'published',
                })
                .select('id')
                .single();
            if (insertError) {
                setError(`Lỗi đăng bài: ${insertError.message}`);
            } else {
                insertNotificationsForAllUsers({
                    type: 'NEW_POST',
                    title: 'Bài đăng mới trên Bảng tin',
                    message: title.trim()
                        ? `${title.trim()} — ${body.trim().slice(0, 80)}`
                        : body.trim().slice(0, 100),
                    linkUrl: `/feed?post=${newPost.id}`,
                    actorId: user.id,
                });
                setBody('');
                setTitle('');
                setExpanded(false);
                onPostCreated();
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!canEdit) return null;

    return (
        <Card>
            <CardContent className="pt-4 space-y-3">
                {expanded && (
                    <Input
                        placeholder="Tiêu đề (tùy chọn)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                )}
                <Textarea
                    placeholder="Chia sẻ điều gì đó với dòng họ..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onFocus={() => setExpanded(true)}
                    rows={expanded ? 4 : 2}
                />
                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
                {expanded && (
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setExpanded(false); setError(null); }}>
                            Hủy
                        </Button>
                        <Button size="sm" onClick={handleSubmit} disabled={!body.trim() || submitting}>
                            <PenSquare className="mr-2 h-4 w-4" />
                            {submitting ? 'Đang đăng...' : 'Đăng bài'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// === Contribute Post Composer (for members) ===

function ContributePostComposer() {
    const { user, profile, isMember } = useAuth();
    const [body, setBody] = useState('');
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!body.trim() || !user) return;
        setSubmitting(true);
        setError(null);
        try {
            const payload = { title: title.trim() || undefined, body: body.trim() };
            const { error: submitError } = await submitContribution({
                authorId: user.id,
                authorEmail: profile?.email || user.email || '',
                fieldName: 'add_post',
                fieldLabel: 'Đề xuất bài viết',
                newValue: JSON.stringify(payload),
                personName: title.trim() || body.trim().slice(0, 50),
            });
            if (submitError) { setError(submitError); } else {
                setBody(''); setTitle(''); setExpanded(false); setSent(true);
                setTimeout(() => setSent(false), 4000);
            }
        } finally { setSubmitting(false); }
    };

    if (!isMember) return null;

    return (
        <Card>
            <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <MessageSquarePlus className="h-4 w-4 text-blue-500" />
                    <span>Đề xuất bài viết cho bảng tin (cần duyệt)</span>
                </div>
                {sent && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-700 dark:text-green-400">
                        ✅ Đã gửi đề xuất! Biên tập viên sẽ xem xét.
                    </div>
                )}
                {expanded && (
                    <Input
                        placeholder="Tiêu đề (tùy chọn)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                )}
                <Textarea
                    placeholder="Chia sẻ điều gì đó... (sẽ được xem xét trước khi đăng)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onFocus={() => setExpanded(true)}
                    rows={expanded ? 4 : 2}
                />
                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
                {expanded && (
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setExpanded(false); setError(null); }}>
                            Hủy
                        </Button>
                        <Button size="sm" onClick={handleSubmit} disabled={!body.trim() || submitting}>
                            <Send className="mr-2 h-4 w-4" />
                            {submitting ? 'Đang gửi...' : 'Gửi đề xuất'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// === Comment Section ===

function CommentSection({ postId }: { postId: string }) {
    const { user, isLoggedIn } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchComments = useCallback(async () => {
        setLoading(true);
        // Fetch comments, then enrich with profile names separately
        const { data } = await supabase
            .from('post_comments')
            .select('id, author_id, body, created_at')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (data && data.length > 0) {
            // Get author names
            const authorIds = [...new Set(data.map((c: { author_id: string }) => c.author_id).filter(Boolean))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, display_name, email')
                .in('id', authorIds);
            const profileMap: Record<string, string> = {};
            profiles?.forEach((p: { id: string; display_name: string | null; email: string }) => {
                profileMap[p.id] = p.display_name || p.email?.split('@')[0] || 'Ẩn danh';
            });
            setComments(data.map((c: { id: string; author_id: string; body: string; created_at: string }) => ({
                ...c,
                author_name: profileMap[c.author_id] || 'Ẩn danh',
            })));
        } else {
            setComments([]);
        }
        setLoading(false);
    }, [postId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSubmit = async () => {
        if (!newComment.trim() || !user) return;
        const { error } = await supabase.from('post_comments').insert({
            post_id: postId,
            author_id: user.id,
            body: newComment.trim(),
        });
        if (!error) {
            setNewComment('');
            fetchComments();
        }
    };

    return (
        <div className="border-t pt-3 space-y-3">
            {loading ? (
                <p className="text-xs text-muted-foreground">Đang tải...</p>
            ) : (
                comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-medium">{c.author_name}</p>
                            <p className="text-sm">{c.body}</p>
                            <span className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))
            )}
            {isLoggedIn && (
                <div className="flex gap-2">
                    <Input
                        placeholder="Viết bình luận..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        className="text-sm"
                    />
                    <Button size="icon" variant="ghost" onClick={handleSubmit} disabled={!newComment.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// === Post Card ===

function PostCard({
    post,
    onRefresh,
    isUnread,
    onMarkRead,
}: {
    post: Post;
    onRefresh: () => void;
    isUnread?: boolean;
    onMarkRead?: () => void;
}) {
    const { user, isAdmin } = useAuth();
    const [showComments, setShowComments] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-mark as read via IntersectionObserver when post scrolls into view
    useEffect(() => {
        if (!isUnread || !onMarkRead) return;
        const el = cardRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { onMarkRead(); observer.disconnect(); } },
            { threshold: 0.6 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [isUnread, onMarkRead]);

    const handleDelete = async () => {
        const { error } = await supabase.from('posts').delete().eq('id', post.id);
        if (!error) onRefresh();
    };

    const handleTogglePin = async () => {
        const { error } = await supabase.from('posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
        if (!error) onRefresh();
    };

    const cardClass = [
        post.is_pinned ? 'border-primary/30 bg-primary/5' : '',
        isUnread ? 'border-l-4 border-l-blue-500' : '',
    ].filter(Boolean).join(' ');

    return (
        <Card ref={cardRef} className={cardClass}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{post.author_name || 'Ẩn danh'}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(post.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {isUnread && (
                                    <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-blue-500 text-white">Mới</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    {(isAdmin || user?.id === post.author_id) && (
                        <div className="flex gap-1">
                            {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={handleTogglePin} title={post.is_pinned ? 'Bỏ ghim' : 'Ghim'}>
                                    <Pin className={`h-4 w-4 ${post.is_pinned ? 'text-primary' : ''}`} />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {post.is_pinned && <Badge variant="secondary" className="text-xs">📌 Ghim</Badge>}
                {post.title && <h3 className="font-semibold">{post.title}</h3>}
                <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                <div className="flex items-center justify-between pt-1">
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowComments(!showComments)}>
                        <MessageCircle className="mr-1 h-4 w-4" />
                        Bình luận {post.comment_count ? `(${post.comment_count})` : ''}
                        <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${showComments ? 'rotate-180' : ''}`} />
                    </Button>
                    {isUnread && (
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Checkbox
                                checked={false}
                                onCheckedChange={() => onMarkRead?.()}
                            />
                            Đánh dấu đã đọc
                        </label>
                    )}
                </div>
                {showComments && <CommentSection postId={post.id} />}
            </CardContent>
        </Card>
    );
}

// === Main Feed Page ===

export default function FeedPage() {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [unreadPostIds, setUnreadPostIds] = useState<Set<string>>(new Set());

    // Fetch per-post unread IDs; also clean up legacy '/feed' notifications
    useEffect(() => {
        if (!user?.id) return;
        const uid = user.id;
        fetchUnreadContentIds(uid, 'NEW_POST').then(ids => setUnreadPostIds(ids));
        // Clean up old-style notifications that have no post ID (pre-migration)
        supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', uid)
            .eq('type', 'NEW_POST')
            .eq('link_url', '/feed')
            .eq('is_read', false)
            .then(() => {});
    }, [user?.id]);

    const handleMarkPostRead = useCallback(async (postId: string) => {
        if (!user?.id) return;
        await markPostNotificationRead(user.id, postId);
        setUnreadPostIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
        window.dispatchEvent(new Event('refresh-badges'));
    }, [user?.id]);

    const handleMarkAllRead = useCallback(async () => {
        if (!user?.id || unreadPostIds.size === 0) return;
        await markNotificationsReadByType(user.id, 'NEW_POST');
        setUnreadPostIds(new Set());
        window.dispatchEvent(new Event('refresh-badges'));
    }, [user?.id, unreadPostIds.size]);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            // Step 1: Fetch posts WITHOUT join (tránh lỗi FK không match)
            const { data, error } = await supabase
                .from('posts')
                .select('id, author_id, type, title, body, is_pinned, status, created_at, updated_at')
                .eq('status', 'published')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                setFetchError(`Không thể tải bảng tin: ${error.message}`);
                return;
            }
            if (!data || data.length === 0) {
                setPosts([]);
                return;
            }

            // Step 2: Enrich author names from profiles (separate query)
            const authorIds = [...new Set(data.map((p: Post) => p.author_id).filter(Boolean))];
            const profileMap: Record<string, string> = {};
            if (authorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, display_name, email')
                    .in('id', authorIds);
                profiles?.forEach((p: { id: string; display_name: string | null; email: string }) => {
                    profileMap[p.id] = p.display_name || p.email?.split('@')[0] || 'Ẩn danh';
                });
            }

            // Step 3: Count comments from post_comments (correct table name)
            const postIds = data.map((p: Post) => p.id);
            const countMap: Record<string, number> = {};
            const { data: counts } = await supabase
                .from('post_comments')
                .select('post_id')
                .in('post_id', postIds);
            counts?.forEach((c: { post_id: string }) => {
                countMap[c.post_id] = (countMap[c.post_id] || 0) + 1;
            });

            setPosts(data.map((p: Post) => ({
                ...p,
                author_name: profileMap[p.author_id] || 'Ẩn danh',
                comment_count: countMap[p.id] || 0,
            })));
        } catch (e) {
            setFetchError(`Lỗi kết nối: ${e instanceof Error ? e.message : 'Unknown'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Newspaper className="h-6 w-6" />
                        Bảng tin
                        {unreadPostIds.size > 0 && (
                            <span className="text-sm font-normal px-2 py-0.5 rounded-full bg-blue-500 text-white">
                                {unreadPostIds.size} mới
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground">Tin tức và hoạt động dòng họ</p>
                </div>
                {unreadPostIds.size > 0 && (
                    <label
                        className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={handleMarkAllRead}
                    >
                        <Checkbox checked={false} onCheckedChange={handleMarkAllRead} />
                        <span className="flex items-center gap-1">
                            <CheckCheck className="h-3.5 w-3.5" />
                            Đánh dấu tất cả đã đọc
                        </span>
                    </label>
                )}
            </div>

            <PostComposer onPostCreated={fetchPosts} />
            <ContributePostComposer />

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
            ) : posts.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Chưa có bài viết nào</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onRefresh={fetchPosts}
                            isUnread={unreadPostIds.has(post.id)}
                            onMarkRead={() => handleMarkPostRead(post.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
