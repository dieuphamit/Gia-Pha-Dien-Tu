'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Shield, Plus, MoreHorizontal, Copy, Check, Link2, Trash2, RefreshCw, Loader2, UserPlus, Clock, UserCog, Search, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { AddMemberDialog } from '@/components/add-member-dialog';
import { insertAuditLog, updateProfilePersonHandle, updateEditablePersonHandles, fetchPeopleForSelect, fetchClans } from '@/lib/supabase-data';

type StatusFilter = 'all' | 'pending' | 'active' | 'suspended';
type ClanFilter = 'all' | 'pham' | 'huynh' | 'dinh';

const CLAN_LABELS: Record<string, string> = {
    pham: 'Họ Phạm',
    huynh: 'Họ Huỳnh',
    dinh: 'Họ Đinh',
};
const ALL_CLAN_HANDLES = ['pham', 'huynh', 'dinh'];

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    member: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    editor: 'Editor',
    member: 'Thành viên',
};

interface PersonForSelect {
    handle: string;
    displayName: string;
    generation: number;
    gender: number;
}

/** Searchable combobox to select a person from the family tree */
function PersonPicker({
    people,
    value,
    onChange,
    placeholder = 'Chọn người...',
    clanFilter,
    onClanFilterChange,
    clans,
}: {
    people: PersonForSelect[];
    value: string;
    onChange: (handle: string) => void;
    placeholder?: string;
    clanFilter: string;
    onClanFilterChange: (clan: string) => Promise<void>;
    clans: Array<{ handle: string; displayName: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);

    const selectedPerson = people.find(p => p.handle === value);

    const filtered = people.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            p.displayName.toLowerCase().includes(q) ||
            p.handle.toLowerCase().includes(q)
        );
    });

    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div ref={containerRef} className="space-y-1.5">
            {clans.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                    <button
                        type="button"
                        onClick={() => onClanFilterChange('')}
                        className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${!clanFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                    >
                        All
                    </button>
                    {clans.map(cl => (
                        <button
                            key={cl.handle}
                            type="button"
                            onClick={() => onClanFilterChange(cl.handle)}
                            className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${clanFilter === cl.handle ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                        >
                            {cl.displayName}
                        </button>
                    ))}
                </div>
            )}
            <div
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer bg-background hover:bg-muted/50 min-h-[38px]"
                onClick={() => setOpen(v => !v)}
            >
                {selectedPerson ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{selectedPerson.handle}</span>
                        <span className="truncate">{selectedPerson.displayName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({selectedPerson.generation})</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                )}
                <div className="flex items-center gap-1 ml-2 shrink-0">
                    {value && (
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onChange(''); setSearch(''); }}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
            {open && (
                <div className="relative z-50">
                    <div className="absolute top-0 left-0 right-0 rounded-md border bg-popover shadow-md">
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <input
                                autoFocus
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Search name or code..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-52 overflow-y-auto py-1">
                            {filtered.length === 0 ? (
                                <p className="text-center text-xs text-muted-foreground py-4">Not found</p>
                            ) : filtered.map(p => (
                                <button
                                    key={p.handle}
                                    type="button"
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left ${p.handle === value ? 'bg-muted font-medium' : ''}`}
                                    onClick={() => { onChange(p.handle); setOpen(false); setSearch(''); }}
                                >
                                    <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{p.handle}</span>
                                    <span className="flex-1 truncate">{p.displayName}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">Gen {p.generation}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ProfileUser {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    status: string;
    created_at: string;
    clan_access: string[] | null;
    person_handle: string | null;
    editable_person_handles: string[] | null;
}

interface InviteLink {
    id: string;
    code: string;
    role: string;
    max_uses: number;
    used_count: number;
    created_at: string;
}

function generateCode() {
    const chars = 'abcdef0123456789';
    let code = '';
    for (let i = 0; i < 32; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'active') return <Badge variant="default">Hoạt động</Badge>;
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100">Chờ duyệt</Badge>;
    if (status === 'suspended') return <Badge variant="destructive">Tạm ngưng</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="opacity-60">Từ chối</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminUsersPage() {
    const { isAdmin, loading: authLoading, user: currentUser } = useAuth();
    const [users, setUsers] = useState<ProfileUser[]>([]);
    const [invites, setInvites] = useState<InviteLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteTableExists, setInviteTableExists] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [clanFilter, setClanFilter] = useState<ClanFilter>('all');

    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [inviteRole, setInviteRole] = useState('member');
    const [inviteMaxUses, setInviteMaxUses] = useState(1);
    const [copied, setCopied] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true });
            if (!error && data) setUsers(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    const fetchInvites = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('invite_links')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                setInviteTableExists(false);
            } else if (data) {
                setInvites(data);
                setInviteTableExists(true);
            }
        } catch { setInviteTableExists(false); }
    }, []);

    useEffect(() => {
        if (!authLoading && isAdmin) {
            fetchUsers();
            fetchInvites();
        }
    }, [authLoading, isAdmin, fetchUsers, fetchInvites]);

    const handleCreateInvite = useCallback(async () => {
        const code = generateCode();
        const { data, error } = await supabase
            .from('invite_links')
            .insert({ code, role: inviteRole, max_uses: inviteMaxUses })
            .select()
            .single();
        if (!error && data) {
            setInvites(prev => [data, ...prev]);
        }
    }, [inviteRole, inviteMaxUses]);

    const handleDeleteInvite = useCallback(async (id: string) => {
        const { error } = await supabase.from('invite_links').delete().eq('id', id);
        if (!error) setInvites(prev => prev.filter(inv => inv.id !== id));
    }, []);

    const handleChangeRole = useCallback(async (userId: string, newRole: string) => {
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (!error) {
            const target = users.find(u => u.id === userId);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            if (currentUser) {
                insertAuditLog({
                    actorId: currentUser.id,
                    action: 'UPDATE',
                    entityType: 'profile',
                    entityId: userId,
                    entityName: target?.email,
                    metadata: { field: 'role', newValue: newRole, oldValue: target?.role },
                });
            }
        }
    }, [users, currentUser]);

    const [approveDialogUser, setApproveDialogUser] = useState<ProfileUser | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [approvalClanAccess, setApprovalClanAccess] = useState<string[]>([]);

    const handleApprove = useCallback((userId: string) => {
        const target = users.find(u => u.id === userId);
        if (!target) return;
        setApproveDialogUser(target);
        setApprovalClanAccess(target.clan_access ?? []);
        setApproveDialogOpen(true);
    }, [users]);

    const handleConfirmApprove = useCallback(async () => {
        if (!approveDialogUser) return;
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'active', clan_access: approvalClanAccess })
            .eq('id', approveDialogUser.id);
        if (!error) {
            setUsers(prev => prev.map(u =>
                u.id === approveDialogUser.id
                    ? { ...u, status: 'active', clan_access: approvalClanAccess }
                    : u
            ));
            setApproveDialogOpen(false);
            window.dispatchEvent(new Event('refresh-badges'));
            if (currentUser) {
                insertAuditLog({
                    actorId: currentUser.id,
                    action: 'APPROVE',
                    entityType: 'profile',
                    entityId: approveDialogUser.id,
                    entityName: approveDialogUser.email,
                    metadata: { field: 'status', newValue: 'active', clan_access: approvalClanAccess },
                });
            }
        }
    }, [approveDialogUser, approvalClanAccess, currentUser]);

    const handleReject = useCallback(async (userId: string) => {
        const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId);
        if (!error) {
            const target = users.find(u => u.id === userId);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected' } : u));
            window.dispatchEvent(new Event('refresh-badges'));
            if (currentUser) {
                insertAuditLog({
                    actorId: currentUser.id,
                    action: 'REJECT',
                    entityType: 'profile',
                    entityId: userId,
                    entityName: target?.email,
                    metadata: { field: 'status', newValue: 'rejected' },
                });
            }
        }
    }, [users, currentUser]);

    const handleToggleStatus = useCallback(async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
        if (!error) {
            const target = users.find(u => u.id === userId);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
            if (currentUser) {
                insertAuditLog({
                    actorId: currentUser.id,
                    action: 'UPDATE',
                    entityType: 'profile',
                    entityId: userId,
                    entityName: target?.email,
                    metadata: { field: 'status', oldValue: currentStatus, newValue: newStatus },
                });
            }
        }
    }, [users, currentUser]);

    const [clanDialogUser, setClanDialogUser] = useState<ProfileUser | null>(null);
    const [clanDialogOpen, setClanDialogOpen] = useState(false);
    const [pendingClanAccess, setPendingClanAccess] = useState<string[]>([]);

    // Permission dialog — assign person_handle + editable_person_handles
    const [permDialogUser, setPermDialogUser] = useState<ProfileUser | null>(null);
    const [permDialogOpen, setPermDialogOpen] = useState(false);
    const [permPersonHandle, setPermPersonHandle] = useState('');
    const [permEditableHandles, setPermEditableHandles] = useState<string[]>([]);
    const [permSaving, setPermSaving] = useState(false);
    const [permError, setPermError] = useState<string | null>(null);
    const [permPeople, setPermPeople] = useState<PersonForSelect[]>([]);
    const [permClans, setPermClans] = useState<Array<{ handle: string; displayName: string }>>([]);
    const [permClanFilter, setPermClanFilter] = useState('');
    const [permPeopleLoading, setPermPeopleLoading] = useState(false);

    const openClanDialog = useCallback((user: ProfileUser) => {
        setClanDialogUser(user);
        setPendingClanAccess(user.clan_access ?? []);
        setClanDialogOpen(true);
    }, []);

    const handleSaveClanAccess = useCallback(async () => {
        if (!clanDialogUser) return;
        const { error } = await supabase
            .from('profiles')
            .update({ clan_access: pendingClanAccess })
            .eq('id', clanDialogUser.id);
        if (!error) {
            setUsers(prev => prev.map(u =>
                u.id === clanDialogUser.id ? { ...u, clan_access: pendingClanAccess } : u
            ));
            setClanDialogOpen(false);
        }
    }, [clanDialogUser, pendingClanAccess]);

    const openPermDialog = useCallback(async (user: ProfileUser) => {
        setPermDialogUser(user);
        setPermPersonHandle(user.person_handle ?? '');
        setPermEditableHandles(user.editable_person_handles ?? []);
        setPermError(null);
        setPermClanFilter('');
        setPermDialogOpen(true);
        setPermPeopleLoading(true);
        const [people, clans] = await Promise.all([fetchPeopleForSelect(), fetchClans()]);
        setPermPeople(people);
        setPermClans(clans);
        setPermPeopleLoading(false);
    }, []);

    const handleSavePermissions = useCallback(async () => {
        if (!permDialogUser) return;
        setPermSaving(true);
        setPermError(null);
        // Save person_handle (identity link)
        const { error: e1 } = await updateProfilePersonHandle(permDialogUser.id, permPersonHandle.trim() || null);
        if (e1) { setPermError(e1); setPermSaving(false); return; }
        // Compute final editable list: merge identity handle + explicitly added handles
        const finalHandle = permPersonHandle.trim() || null;
        let finalEditable = [...permEditableHandles];
        if (finalHandle && !finalEditable.includes(finalHandle)) {
            finalEditable = [finalHandle, ...finalEditable];
        }
        const { error: e2 } = await updateEditablePersonHandles(permDialogUser.id, finalEditable);
        if (e2) { setPermError(e2); setPermSaving(false); return; }
        setUsers(prev => prev.map(u =>
            u.id === permDialogUser.id
                ? { ...u, person_handle: finalHandle, editable_person_handles: finalEditable }
                : u
        ));
        if (currentUser) {
            insertAuditLog({
                actorId: currentUser.id,
                action: 'UPDATE',
                entityType: 'profile',
                entityId: permDialogUser.id,
                entityName: permDialogUser.email,
                metadata: { field: 'person_permissions', person_handle: finalHandle, editable_person_handles: finalEditable },
            });
        }
        setPermSaving(false);
        setPermDialogOpen(false);
    }, [permDialogUser, permPersonHandle, permEditableHandles, currentUser]);

    const handleCopy = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(text);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(text);
            setTimeout(() => setCopied(null), 2000);
        }
    }, []);

    const getInviteUrl = (code: string) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/register?code=${code}`;
    };

    const pendingCount = users.filter(u => u.status === 'pending').length;

    const filteredUsers = users.filter(u => {
        if (statusFilter !== 'all' && u.status !== statusFilter) return false;
        if (clanFilter !== 'all') {
            if (u.role === 'admin') return true;
            if (!(u.clan_access ?? []).includes(clanFilter)) return false;
        }
        return true;
    });

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6" />
                        Quản lý thành viên
                    </h1>
                    <p className="text-muted-foreground">Quản lý tài khoản và quyền truy cập</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => { fetchUsers(); fetchInvites(); }}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setAddMemberOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Thêm thành viên
                    </Button>
                    <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!open) setInviteDialogOpen(false); else setInviteDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Tạo link mời
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tạo link mời thành viên</DialogTitle>
                                <DialogDescription>Chọn quyền và tạo link mời cho thành viên mới</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quyền</label>
                                    <select
                                        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                    >
                                        <option value="member">Thành viên — Xem thông tin</option>
                                        <option value="editor">Editor — Thêm/sửa thành viên, bảng tin, sự kiện</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Số lần dùng tối đa</label>
                                    <Input
                                        type="number"
                                        value={inviteMaxUses}
                                        onChange={e => setInviteMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                                        min={1}
                                        max={100}
                                    />
                                </div>
                                {!inviteTableExists && (
                                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-700 dark:text-amber-400 text-xs">
                                        ⚠️ Bảng <code>invite_links</code> chưa tồn tại.
                                    </div>
                                )}
                                <Button className="w-full" onClick={handleCreateInvite} disabled={!inviteTableExists}>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Tạo link mời
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <AddMemberDialog open={addMemberOpen} onOpenChange={setAddMemberOpen} onSuccess={fetchUsers} />

            {/* Pending alert */}
            {pendingCount > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                    <CardContent className="flex items-center gap-3 py-4">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                Có {pendingCount} tài khoản đang chờ phê duyệt
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Vui lòng xem xét và phê duyệt để các thành viên có thể đăng nhập
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                            onClick={() => setStatusFilter('pending')}
                        >
                            Xem ngay
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Danh sách thành viên</CardTitle>
                            <CardDescription>{filteredUsers.length} / {users.length} thành viên</CardDescription>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                        {/* Status filter tabs */}
                        <div className="flex gap-1 rounded-lg border p-1 bg-muted/50">
                            {([
                                { key: 'all', label: 'Tất cả' },
                                { key: 'pending', label: `Chờ duyệt${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
                                { key: 'active', label: 'Hoạt động' },
                                { key: 'suspended', label: 'Tạm ngưng' },
                            ] as { key: StatusFilter; label: string }[]).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === tab.key
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        } ${tab.key === 'pending' && pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {/* Clan filter tabs */}
                        <div className="flex gap-1 rounded-lg border p-1 bg-muted/50">
                            {([
                                { key: 'all', label: 'Tất cả họ' },
                                { key: 'pham', label: 'Họ Phạm' },
                                { key: 'huynh', label: 'Họ Huỳnh' },
                                { key: 'dinh', label: 'Họ Đinh' },
                            ] as { key: ClanFilter; label: string }[]).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setClanFilter(tab.key)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${clanFilter === tab.key
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Không có thành viên nào</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Quyền</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Dòng họ</TableHead>
                                    <TableHead>Hồ sơ gia phả</TableHead>
                                    <TableHead>Ngày tham gia</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.display_name || user.email.split('@')[0]}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={ROLE_COLORS[user.role] || ''}>
                                                {ROLE_LABELS[user.role] || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={user.status} />
                                        </TableCell>
                                        <TableCell>
                                            {user.role === 'admin' ? (
                                                <span className="text-xs text-muted-foreground">Tất cả</span>
                                            ) : (user.clan_access ?? []).length === 0 ? (
                                                <span className="text-xs text-muted-foreground italic">Chưa gán</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {(user.clan_access ?? []).map(c => (
                                                        <Badge key={c} variant="outline" className="text-xs">{CLAN_LABELS[c] ?? c}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.person_handle ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <a
                                                        href={`/people/${user.person_handle}`}
                                                        className="text-xs font-mono text-primary hover:underline"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {user.person_handle}
                                                    </a>
                                                    {(user.editable_person_handles ?? []).filter(h => h !== user.person_handle).length > 0 && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            +{(user.editable_person_handles ?? []).filter(h => h !== user.person_handle).length} hồ sơ khác
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Chưa gán</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{new Date(user.created_at).toLocaleDateString('vi-VN')}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {user.status === 'pending' && (
                                                        <>
                                                            <DropdownMenuItem
                                                                className="text-green-600"
                                                                onClick={() => handleApprove(user.id)}
                                                            >
                                                                ✅ Phê duyệt
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => handleReject(user.id)}
                                                            >
                                                                ❌ Từ chối
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                        </>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'admin')}>
                                                        🔴 Đặt Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'editor')}>
                                                        🔵 Đặt Editor
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'member')}>
                                                        🟢 Đặt Thành viên
                                                    </DropdownMenuItem>
                                                    {user.role !== 'admin' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => openClanDialog(user)}>
                                                                🏡 Gán dòng họ
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openPermDialog(user)}>
                                                                <UserCog className="mr-2 h-4 w-4" />
                                                                Phân quyền sửa hồ sơ
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {user.status !== 'pending' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className={user.status === 'active' ? 'text-destructive' : 'text-green-600'}
                                                                onClick={() => handleToggleStatus(user.id, user.status)}
                                                            >
                                                                {user.status === 'active' ? 'Tạm ngưng' : 'Kích hoạt lại'}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Invite Links Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Link mời
                    </CardTitle>
                    <CardDescription>{invites.length} link</CardDescription>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Chưa có link mời nào</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Link</TableHead>
                                    <TableHead>Quyền</TableHead>
                                    <TableHead>Đã dùng / Tối đa</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead className="w-20"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.map(inv => (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                ...?code={inv.code.slice(0, 8)}...
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={ROLE_COLORS[inv.role] || ''}>
                                                {inv.role.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{inv.used_count} / {inv.max_uses}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleCopy(getInviteUrl(inv.code))}
                                                    title="Sao chép link"
                                                >
                                                    {copied === getInviteUrl(inv.code) ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteInvite(inv.id)}
                                                    title="Xóa link"
                                                    className="text-destructive hover:text-destructive"
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

            {/* Approve + Clan Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={open => { if (!open) setApproveDialogOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Phê duyệt tài khoản</DialogTitle>
                        <DialogDescription>
                            Chọn dòng họ mà <strong>{approveDialogUser?.display_name || approveDialogUser?.email}</strong> được phép xem.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                        {ALL_CLAN_HANDLES.map(handle => (
                            <label key={handle} className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={approvalClanAccess.includes(handle)}
                                    onChange={e => setApprovalClanAccess(prev =>
                                        e.target.checked ? [...prev, handle] : prev.filter(c => c !== handle)
                                    )}
                                />
                                <span className="text-sm font-medium">{CLAN_LABELS[handle] ?? handle}</span>
                            </label>
                        ))}
                        {approvalClanAccess.length === 0 && (
                            <p className="text-xs text-amber-600">
                                ⚠️ Chưa chọn dòng họ — user sẽ không xem được nội dung sau khi được duyệt.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2 pt-4">
                        <Button className="flex-1" onClick={handleConfirmApprove}>✅ Phê duyệt</Button>
                        <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Hủy</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Clan Access Dialog */}
            <Dialog open={clanDialogOpen} onOpenChange={open => { if (!open) setClanDialogOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gán dòng họ</DialogTitle>
                        <DialogDescription>
                            Chọn các dòng họ mà {clanDialogUser?.display_name || clanDialogUser?.email} được phép xem.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                        {ALL_CLAN_HANDLES.map(handle => (
                            <label key={handle} className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={pendingClanAccess.includes(handle)}
                                    onChange={e => {
                                        setPendingClanAccess(prev =>
                                            e.target.checked
                                                ? [...prev, handle]
                                                : prev.filter(c => c !== handle)
                                        );
                                    }}
                                />
                                <span className="text-sm font-medium">{CLAN_LABELS[handle] ?? handle}</span>
                            </label>
                        ))}
                        <div className="flex gap-2 pt-2">
                            <Button className="flex-1" onClick={handleSaveClanAccess}>Lưu</Button>
                            <Button variant="outline" onClick={() => setClanDialogOpen(false)}>Hủy</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Person Permissions Dialog */}
            <Dialog open={permDialogOpen} onOpenChange={open => { if (!open) setPermDialogOpen(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Phân quyền sửa hồ sơ
                        </DialogTitle>
                        <DialogDescription>
                            Chỉ định hồ sơ gia phả mà <strong>{permDialogUser?.display_name || permDialogUser?.email}</strong> được phép cập nhật (qua đóng góp chờ duyệt).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 mt-2">
                        {/* Identity handle */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Hồ sơ cá nhân (danh tính)</label>
                            <p className="text-xs text-muted-foreground">Người này trong cây gia phả là ai?</p>
                            {permPeopleLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
                                </div>
                            ) : (
                                <PersonPicker
                                    people={permPeople}
                                    value={permPersonHandle}
                                    onChange={setPermPersonHandle}
                                    placeholder="Chọn hồ sơ cá nhân..."
                                    clanFilter={permClanFilter}
                                    onClanFilterChange={async (clan) => {
                                        setPermClanFilter(clan);
                                        setPermPeopleLoading(true);
                                        const people = await fetchPeopleForSelect(clan || undefined);
                                        setPermPeople(people);
                                        setPermPeopleLoading(false);
                                    }}
                                    clans={permClans}
                                />
                            )}
                            {permEditableHandles.filter(h => h !== permPersonHandle).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {permEditableHandles
                                        .filter(h => h !== permPersonHandle)
                                        .map(h => (
                                            <span
                                                key={h}
                                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-mono"
                                            >
                                                {h}
                                                <button
                                                    type="button"
                                                    onClick={() => setPermEditableHandles(prev => prev.filter(x => x !== h))}
                                                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Extra editable handles */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Hồ sơ được phép sửa thêm</label>
                            <p className="text-xs text-muted-foreground">Ngoài hồ sơ cá nhân, người này còn được phép đề xuất sửa các hồ sơ sau</p>
                            {!permPeopleLoading && (
                                <PersonPicker
                                    people={permPeople.filter(p => p.handle !== permPersonHandle && !permEditableHandles.includes(p.handle))}
                                    value=""
                                    onChange={h => {
                                        if (h && !permEditableHandles.includes(h)) {
                                            setPermEditableHandles(prev => [...prev, h]);
                                        }
                                    }}
                                    placeholder="Thêm hồ sơ..."
                                    clanFilter={permClanFilter}
                                    onClanFilterChange={async (clan) => {
                                        setPermClanFilter(clan);
                                        setPermPeopleLoading(true);
                                        const people = await fetchPeopleForSelect(clan || undefined);
                                        setPermPeople(people);
                                        setPermPeopleLoading(false);
                                    }}
                                    clans={permClans}
                                />
                            )}
                        </div>

                        {permError && (
                            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{permError}</p>
                        )}

                        <div className="flex gap-2 pt-1">
                            <Button className="flex-1" onClick={handleSavePermissions} disabled={permSaving}>
                                {permSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Lưu
                            </Button>
                            <Button variant="outline" onClick={() => setPermDialogOpen(false)} disabled={permSaving}>Hủy</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
