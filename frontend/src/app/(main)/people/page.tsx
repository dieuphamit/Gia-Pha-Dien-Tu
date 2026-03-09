'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, UserPlus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { AddMemberDialog } from '@/components/add-member-dialog';
import { ContributeNewPersonDialog } from '@/components/contribute-new-person-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

// ── Types ──────────────────────────────────────────────────────

interface Person {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    birthDate?: string; // ISO DATE: "YYYY-MM-DD"
    deathDate?: string; // ISO DATE: "YYYY-MM-DD"
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    isPatrilineal: boolean;
    isAffiliatedFamily: boolean;
    clanHandle: string | null;
}

const CLAN_LABELS: Record<string, string> = { pham: 'Họ Phạm', ngo: 'Họ Ngô', dinh: 'Họ Đinh' };
type ClanFilter = 'all' | 'pham' | 'ngo' | 'dinh';

type SortKey = 'displayName' | 'gender' | 'generation' | 'birthDate' | 'deathDate' | 'isLiving';

function fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
type SortDir = 'asc' | 'desc';

// ── SortableHeader component ───────────────────────────────────

function SortableHead({
    label,
    sortKey,
    currentKey,
    currentDir,
    onSort,
    className,
}: {
    label: string;
    sortKey: SortKey;
    currentKey: SortKey;
    currentDir: SortDir;
    onSort: (key: SortKey) => void;
    className?: string;
}) {
    const isActive = currentKey === sortKey;
    return (
        <TableHead className={className}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`
                    flex items-center gap-1 group select-none transition-colors
                    hover:text-foreground
                    ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}
                `}
            >
                {label}
                <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                    {!isActive
                        ? <ChevronsUpDown className="h-3.5 w-3.5" />
                        : currentDir === 'asc'
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                    }
                </span>
            </button>
        </TableHead>
    );
}

// ── Main Page ──────────────────────────────────────────────────

export default function PeopleListPage() {
    const router = useRouter();
    const { canEdit, isMember, isAdmin } = useAuth();

    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<number | null>(null);
    const [livingFilter, setLivingFilter] = useState<boolean | null>(null);
    const [clanFilter, setClanFilter] = useState<ClanFilter>('all');
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    // Default sort: ngày sinh tăng dần
    const [sortKey, setSortKey] = useState<SortKey>('birthDate');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // ── Fetch ──
    const fetchPeople = useCallback(async () => {
        setLoading(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('people')
                .select('handle, display_name, gender, generation, birth_date, death_date, is_living, is_privacy_filtered, is_patrilineal, is_affiliated_family, clan_handle');
            if (!error && data) {
                setPeople(data.map((row: Record<string, unknown>) => ({
                    handle: row.handle as string,
                    displayName: row.display_name as string,
                    gender: row.gender as number,
                    generation: row.generation as number,
                    birthDate: row.birth_date as string | undefined,
                    deathDate: row.death_date as string | undefined,
                    isLiving: row.is_living as boolean,
                    isPrivacyFiltered: row.is_privacy_filtered as boolean,
                    isPatrilineal: (row.is_patrilineal as boolean) ?? false,
                    isAffiliatedFamily: (row.is_affiliated_family as boolean) ?? false,
                    clanHandle: (row.clan_handle as string | null) ?? null,
                })));
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchPeople(); }, [fetchPeople]);

    // ── Sort handler: click cùng key thì toggle dir, click key mới thì asc ──
    const handleSort = useCallback((key: SortKey) => {
        if (key === sortKey) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }, [sortKey]);

    // ── Filter + Sort (client-side) ──
    const sorted = useMemo(() => {
        const filtered = people.filter((p) => {
            if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
            if (genderFilter !== null && p.gender !== genderFilter) return false;
            if (livingFilter !== null && p.isLiving !== livingFilter) return false;
            if (clanFilter !== 'all' && p.clanHandle !== clanFilter) return false;
            return true;
        });

        return [...filtered].sort((a, b) => {
            let valA: string | number | boolean | undefined;
            let valB: string | number | boolean | undefined;

            switch (sortKey) {
                case 'displayName':
                    valA = a.displayName.toLowerCase();
                    valB = b.displayName.toLowerCase();
                    break;
                case 'gender':
                    valA = a.gender;
                    valB = b.gender;
                    break;
                case 'generation':
                    valA = a.generation;
                    valB = b.generation;
                    break;
                case 'birthDate':
                    // Người không có ngày sinh xếp cuối (ISO string sorts lexicographically)
                    valA = a.birthDate ?? (sortDir === 'asc' ? '\uFFFF' : '');
                    valB = b.birthDate ?? (sortDir === 'asc' ? '\uFFFF' : '');
                    break;
                case 'deathDate':
                    valA = a.deathDate ?? (sortDir === 'asc' ? '\uFFFF' : '');
                    valB = b.deathDate ?? (sortDir === 'asc' ? '\uFFFF' : '');
                    break;
                case 'isLiving':
                    valA = a.isLiving ? 0 : 1;
                    valB = b.isLiving ? 0 : 1;
                    break;
            }

            if (valA === valB) {
                // Secondary sort: ngày sinh tăng dần
                const ay = a.birthDate ?? '\uFFFF';
                const by = b.birthDate ?? '\uFFFF';
                return ay < by ? -1 : ay > by ? 1 : 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc'
                    ? valA.localeCompare(valB, 'vi')
                    : valB.localeCompare(valA, 'vi');
            }

            const na = valA as number;
            const nb = valB as number;
            return sortDir === 'asc' ? na - nb : nb - na;
        });
    }, [people, search, genderFilter, livingFilter, clanFilter, sortKey, sortDir]);

    const sortProps = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort };

    // ── Render ──
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Thành viên gia phả
                    </h1>
                    <p className="text-muted-foreground">{people.length} người trong gia phả</p>
                </div>
                <div className="flex gap-2">
                    {canEdit && (
                        <Button id="open-add-member-btn" onClick={() => setAddDialogOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Thêm thành viên
                        </Button>
                    )}
                    {isMember && <ContributeNewPersonDialog />}
                </div>
            </div>

            <AddMemberDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSuccess={fetchPeople}
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant={genderFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(null)}>Tất cả</Button>
                    <Button variant={genderFilter === 1 ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(1)}>Nam</Button>
                    <Button variant={genderFilter === 2 ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(2)}>Nữ</Button>
                </div>
                <div className="flex gap-2">
                    <Button variant={livingFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(null)}>Tất cả</Button>
                    <Button variant={livingFilter === true ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(true)}>Còn sống</Button>
                    <Button variant={livingFilter === false ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(false)}>Đã mất</Button>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <Button variant={clanFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setClanFilter('all')}>Tất cả họ</Button>
                        {(['pham', 'ngo', 'dinh'] as const).map(c => (
                            <Button key={c} variant={clanFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setClanFilter(c)}>
                                {CLAN_LABELS[c]}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Sort indicator badge */}
                <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    {sorted.length} kết quả
                    {sortDir === 'asc'
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    }
                    <span className="font-medium">
                        {sortKey === 'displayName' ? 'Họ tên'
                            : sortKey === 'gender' ? 'Giới tính'
                                : sortKey === 'generation' ? 'Đời'
                                    : sortKey === 'birthDate' ? 'Ngày sinh'
                                        : sortKey === 'deathDate' ? 'Ngày mất'
                                            : 'Trạng thái'}
                    </span>
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableHead label="Họ tên" sortKey="displayName" {...sortProps} />
                                    <SortableHead label="Giới tính" sortKey="gender"      {...sortProps} />
                                    <SortableHead label="Đời" sortKey="generation"  {...sortProps} />
                                    <SortableHead label="Ngày sinh" sortKey="birthDate"  {...sortProps} />
                                    <SortableHead label="Ngày mất" sortKey="deathDate"  {...sortProps} />
                                    <SortableHead label="Trạng thái" sortKey="isLiving"   {...sortProps} />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.map(p => (
                                    <TableRow
                                        key={p.handle}
                                        className="cursor-pointer hover:bg-accent/50"
                                        onClick={() => router.push(`/people/${p.handle}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {p.displayName}
                                            {p.isPrivacyFiltered && <span className="ml-1 text-amber-500">🔒</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {p.gender === 1 ? 'Nam' : p.gender === 2 ? 'Nữ' : '?'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">Đ{p.generation}</span>
                                        </TableCell>
                                        <TableCell className="tabular-nums text-sm">
                                            {fmtDate(p.birthDate) || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="tabular-nums text-sm">
                                            {p.deathDate
                                                ? fmtDate(p.deathDate)
                                                : p.isLiving
                                                    ? <span className="text-muted-foreground">—</span>
                                                    : <span className="text-muted-foreground">?</span>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={p.isLiving ? 'default' : 'secondary'}>
                                                {p.isLiving ? 'Còn sống' : 'Đã mất'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sorted.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                            {search ? `Không tìm thấy "${search}"` : 'Chưa có dữ liệu gia phả'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
