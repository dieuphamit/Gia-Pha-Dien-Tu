'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    TreePine,
    Users,
    Image,
    Shield,
    FileText,
    Database,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    ClipboardCheck,
    Contact,
    Newspaper,
    CalendarDays,
    HelpCircle,
    MessageSquarePlus,
    Settings2,
    Bug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

const navItems = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/feed', label: 'Bảng tin', icon: Newspaper },
    { href: '/directory', label: 'Danh bạ', icon: Contact },
    { href: '/events', label: 'Sự kiện', icon: CalendarDays },
    { href: '/tree', label: 'Cây gia phả', icon: TreePine },
    { href: '/book', label: 'Sách gia phả', icon: BookOpen },
    { href: '/people', label: 'Thành viên', icon: Users },
    { href: '/media', label: 'Thư viện', icon: Image },
    { href: '/bug-reports', label: 'Báo cáo bug', icon: Bug },
];

// Items dành cho editor + admin
const editorItems = [
    { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck },
];

// Items chỉ dành cho admin
const adminOnlyItems = [
    { href: '/admin/users', label: 'Quản lý Users', icon: Shield },
    { href: '/admin/questions', label: 'Câu hỏi xác minh', icon: HelpCircle },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    { href: '/admin/backup', label: 'Backup', icon: Database },
    { href: '/admin/settings', label: 'Cài đặt hệ thống', icon: Settings2 },
    { href: '/admin/bugs', label: 'Quản lý Bug', icon: Bug },
];

function PendingBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
    if (count === 0) return null;
    if (collapsed) {
        return <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />;
    }
    return (
        <span className="ml-auto text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-red-500 text-white min-w-[18px] text-center">
            {count > 99 ? '99+' : count}
        </span>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { isAdmin, canEdit, isLoggedIn } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingUsersCount, setPendingUsersCount] = useState(0);
    const [openBugsCount, setOpenBugsCount] = useState(0);
    const [pendingMediaCount, setPendingMediaCount] = useState(0);
    // Feature toggles — đọc từ app_settings, cập nhật realtime
    const [featureMedia, setFeatureMedia] = useState(true);

    // Fetch feature flags từ app_settings
    useEffect(() => {
        if (!isLoggedIn) return;

        supabase
            .from('app_settings')
            .select('key, value')
            .then(({ data }) => {
                if (!data) return;
                const map: Record<string, string> = {};
                data.forEach((r) => { map[r.key] = r.value; });
                setFeatureMedia(map['feature_media_enabled'] !== 'false');
            });

        // Realtime: sidebar cập nhật ngay khi admin thay đổi setting
        const ch = supabase
            .channel('sidebar-feature-flags')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_settings' },
                (payload) => {
                    if (payload.new.key === 'feature_media_enabled') {
                        setFeatureMedia(payload.new.value !== 'false');
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(ch); };
    }, [isLoggedIn]);

    // Fetch số lượng đóng góp chờ duyệt (chỉ khi là editor hoặc admin)
    useEffect(() => {
        if (!canEdit) return;

        const fetchPending = async () => {
            const { count } = await supabase
                .from('contributions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingCount(count ?? 0);
        };

        fetchPending();

        const handleRefresh = () => fetchPending();
        window.addEventListener('refresh-badges', handleRefresh);

        // Realtime subscription — badge tự cập nhật khi có đóng góp mới
        const channel = supabase
            .channel('sidebar-pending')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, fetchPending)
            .subscribe();

        return () => {
            window.removeEventListener('refresh-badges', handleRefresh);
            supabase.removeChannel(channel);
        };
    }, [canEdit]);

    // Fetch số lượng user chờ duyệt (chỉ khi là admin)
    useEffect(() => {
        if (!isAdmin) return;

        const fetchPendingUsers = async () => {
            const { count } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingUsersCount(count ?? 0);
        };

        fetchPendingUsers();

        const handleRefresh = () => fetchPendingUsers();
        window.addEventListener('refresh-badges', handleRefresh);

        // Realtime subscription — badge tự cập nhật khi có profile mới/sửa
        const channel = supabase
            .channel('sidebar-pending-users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchPendingUsers)
            .subscribe();

        return () => {
            window.removeEventListener('refresh-badges', handleRefresh);
            supabase.removeChannel(channel);
        };
    }, [isAdmin]);

    // Fetch số media chờ duyệt (admin/editor thấy badge trên Thư viện)
    useEffect(() => {
        if (!canEdit) return;

        const fetchPendingMedia = async () => {
            const { count } = await supabase
                .from('media')
                .select('id', { count: 'exact', head: true })
                .eq('state', 'PENDING');
            setPendingMediaCount(count ?? 0);
        };

        fetchPendingMedia();

        const channel = supabase
            .channel('sidebar-pending-media')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, fetchPendingMedia)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [canEdit]);

    // Fetch số bug open (chỉ khi là admin)
    useEffect(() => {
        if (!isAdmin) return;

        const fetchOpenBugs = async () => {
            const { count } = await supabase
                .from('bug_reports')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'open');
            setOpenBugsCount(count ?? 0);
        };

        fetchOpenBugs();

        const channel = supabase
            .channel('sidebar-open-bugs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, fetchOpenBugs)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isAdmin]);

    const renderNavItem = (item: { href: string; label: string; icon: React.ElementType }, badgeCount = 0) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
            <Link key={item.href} href={item.href}>
                <span
                    className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                    {badgeCount > 0 && <PendingBadge count={badgeCount} collapsed={collapsed} />}
                </span>
            </Link>
        );
    };

    return (
        <aside
            className={cn(
                'flex flex-col border-r bg-card transition-all duration-300 h-screen sticky top-0',
                collapsed ? 'w-16' : 'w-64',
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b">
                <TreePine className="h-6 w-6 text-primary shrink-0" />
                {!collapsed && <span className="font-bold text-lg">Gia phả họ Phạm</span>}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navItems
                    .filter(item => item.href !== '/media' || featureMedia || isAdmin)
                    .map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                        const badge = (item.href === '/media' && canEdit) ? pendingMediaCount : 0;
                        return (
                            <Link key={item.href} href={item.href}>
                                <span
                                    className={cn(
                                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                    )}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    {!collapsed && item.label}
                                    {badge > 0 && <PendingBadge count={badge} collapsed={collapsed} />}
                                </span>
                            </Link>
                        );
                    })}

                {/* Contributions — only for members (not editor/admin) */}
                {isLoggedIn && !canEdit && (
                    <Link href="/contributions">
                        <span className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                            pathname.startsWith('/contributions')
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}>
                            <MessageSquarePlus className="h-4 w-4 shrink-0" />
                            {!collapsed && 'Đóng góp của tôi'}
                        </span>
                    </Link>
                )}

                {/* Editor section — Kiểm duyệt + badge, chỉ hiển thị cho editor (không phải admin) */}
                {canEdit && !isAdmin && (
                    <>
                        {!collapsed && (
                            <div className="pt-4 pb-2">
                                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                    Biên tập
                                </span>
                            </div>
                        )}
                        {collapsed && <div className="border-t my-2" />}
                        {editorItems.map((item) => renderNavItem(item, item.href === '/admin/edits' ? pendingCount : 0))}
                    </>
                )}

                {/* Admin section — đầy đủ, chỉ visible cho admin */}
                {isAdmin && (
                    <>
                        {!collapsed && (
                            <div className="pt-4 pb-2">
                                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                    Quản trị
                                </span>
                            </div>
                        )}
                        {collapsed && <div className="border-t my-2" />}
                        {[...editorItems, ...adminOnlyItems].map((item) =>
                            renderNavItem(
                                item,
                                item.href === '/admin/edits' ? pendingCount :
                                    item.href === '/admin/users' ? pendingUsersCount :
                                        item.href === '/admin/bugs' ? openBugsCount : 0
                            )
                        )}
                    </>
                )}
            </nav>

            {/* Collapse toggle */}
            <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2">Thu gọn</span>}
                </Button>
            </div>
        </aside>
    );
}
