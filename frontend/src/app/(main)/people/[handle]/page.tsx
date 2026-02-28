'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Heart, Image, FileText, History, Lock, Phone, MapPin, Briefcase, GraduationCap, Tag, MessageCircle, Pencil, Save, X, Trash2, Upload, Star, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import { zodiacYear } from '@/lib/genealogy-types';
import { formatDateVN } from '@/components/ui/date-input';
import type { PersonDetail } from '@/lib/genealogy-types';
import { CommentSection } from '@/components/comment-section';
import { ContributeEditPersonDialog } from '@/components/contribute-edit-person-dialog';
import { PersonAvatar } from '@/components/person-avatar';
import { useAuth } from '@/components/auth-provider';
import {
    updatePerson,
    addPersonAsChild,
    removePersonFromParentFamily,
    addPersonAsSpouse,
    removePersonFromSpouseFamily,
} from '@/lib/supabase-data';

interface FamilyOption {
    handle: string;
    label: string;
}

interface EditForm {
    displayName: string;
    gender: number;
    generation: number;
    surname: string;
    firstName: string;
    nickName: string;
    birthDate: string; // ISO DATE: "YYYY-MM-DD"
    deathDate: string; // ISO DATE: "YYYY-MM-DD"
    isLiving: boolean;
    isAffiliatedFamily: boolean;
    phone: string;
    email: string;
    zalo: string;
    facebook: string;
    hometown: string;
    currentAddress: string;
    occupation: string;
    company: string;
    education: string;
    biography: string;
    notes: string;
}

export default function PersonProfilePage() {
    const params = useParams();
    const router = useRouter();
    const handle = params.handle as string;
    const { isAdmin, canEdit, isMember, user } = useAuth();
    const [person, setPerson] = useState<PersonDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [relLoading, setRelLoading] = useState(false);
    const [relError, setRelError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [allFamilies, setAllFamilies] = useState<FamilyOption[]>([]);
    const [allChildrenOptions, setAllChildrenOptions] = useState<FamilyOption[]>([]);
    const [familyInfoMap, setFamilyInfoMap] = useState<Map<string, string>>(new Map());
    const [selectedParentFamily, setSelectedParentFamily] = useState('');
    const [selectedChildrenHandles, setSelectedChildrenHandles] = useState<string[]>([]);
    const [allSpouseOptions, setAllSpouseOptions] = useState<FamilyOption[]>([]);
    const [selectedSpouseHandle, setSelectedSpouseHandle] = useState<string>('');

    // Media state
    interface MediaItem {
        id: string;
        storage_url: string;
        thumbnail_url: string | null;
        title: string | null;
        state: string;
        media_type: string;
        linked_person: string | null;
        created_at: string;
        uploader_id: string | null;
    }
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [mediaError, setMediaError] = useState('');
    const mediaInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<EditForm>({
        displayName: '', gender: 1, generation: 1, surname: '', firstName: '', nickName: '',
        birthDate: '', deathDate: '', isLiving: true, isAffiliatedFamily: false,
        phone: '', email: '', zalo: '', facebook: '',
        hometown: '', currentAddress: '',
        occupation: '', company: '', education: '',
        biography: '', notes: '',
    });

    const fetchPerson = async () => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('people')
                .select('*')
                .eq('handle', handle)
                .single();
            if (!error && data) {
                const row = data as Record<string, unknown>;
                setPerson({
                    handle: row.handle as string,
                    displayName: row.display_name as string,
                    gender: row.gender as number,
                    birthYear: row.birth_year as number | undefined,
                    birthDate: row.birth_date as string | undefined,
                    deathYear: row.death_year as number | undefined,
                    deathDate: row.death_date as string | undefined,
                    generation: row.generation as number,
                    isLiving: row.is_living as boolean,
                    isPrivacyFiltered: row.is_privacy_filtered as boolean,
                    isPatrilineal: row.is_patrilineal as boolean,
                    isAffiliatedFamily: (row.is_affiliated_family as boolean) ?? false,
                    families: (row.families as string[]) || [],
                    parentFamilies: (row.parent_families as string[]) || [],
                    phone: row.phone as string | undefined,
                    email: row.email as string | undefined,
                    zalo: row.zalo as string | undefined,
                    facebook: row.facebook as string | undefined,
                    currentAddress: row.current_address as string | undefined,
                    hometown: row.hometown as string | undefined,
                    occupation: row.occupation as string | undefined,
                    company: row.company as string | undefined,
                    education: row.education as string | undefined,
                    biography: row.biography as string | undefined,
                    notes: row.notes as string | undefined,
                    surname: row.surname as string | undefined,
                    firstName: row.first_name as string | undefined,
                    nickName: row.nick_name as string | undefined,
                    avatarUrl: (row.avatar_url as string | null) ?? undefined,
                } as PersonDetail);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    const loadFamilyInfo = async () => {
        const { supabase } = await import('@/lib/supabase');
        const [{ data: fams }, { data: people }] = await Promise.all([
            supabase.from('families').select('handle, father_handle, mother_handle').order('handle'),
            supabase.from('people').select('handle, display_name'),
        ]);
        if (!fams || !people) return;
        const nameMap = new Map(people.map(p => [p.handle as string, p.display_name as string]));
        const infoMap = new Map<string, string>();
        fams.forEach(f => {
            const parts: string[] = [];
            if (f.father_handle) parts.push(nameMap.get(f.father_handle) || f.father_handle);
            if (f.mother_handle) parts.push(nameMap.get(f.mother_handle) || f.mother_handle);
            infoMap.set(f.handle, parts.length > 0 ? parts.join(' & ') : f.handle);
        });
        setFamilyInfoMap(infoMap);
    };

    const fetchMedia = useCallback(async () => {
        setMediaLoading(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data } = await supabase
                .from('media')
                .select('id, storage_url, thumbnail_url, title, state, media_type, linked_person, created_at, uploader_id')
                .eq('linked_person', handle)
                .eq('media_type', 'IMAGE')
                .order('created_at', { ascending: false });
            // Privacy filter: member/viewer chỉ thấy PUBLISHED + ảnh PENDING/REJECTED của chính mình
            const allData = (data as MediaItem[]) || [];
            const filtered = canEdit
                ? allData
                : allData.filter(m => m.state === 'PUBLISHED' || m.uploader_id === user?.id);
            setMediaItems(filtered);
        } catch { /* ignore */ }
        setMediaLoading(false);
    }, [handle]);

    useEffect(() => {
        fetchPerson();
        loadFamilyInfo();
        fetchMedia();
    }, [handle, fetchMedia]);

    const startEdit = () => {
        if (!person) return;
        setForm({
            displayName: person.displayName || '',
            gender: person.gender || 1,
            generation: person.generation || 1,
            surname: person.surname || '',
            firstName: person.firstName || '',
            nickName: person.nickName || '',
            birthDate: person.birthDate || '',
            deathDate: person.deathDate || '',
            isLiving: person.isLiving,
            isAffiliatedFamily: person.isAffiliatedFamily ?? false,
            phone: person.phone || '',
            email: person.email || '',
            zalo: person.zalo || '',
            facebook: person.facebook || '',
            hometown: person.hometown || '',
            currentAddress: person.currentAddress || '',
            occupation: person.occupation || '',
            company: person.company || '',
            education: person.education || '',
            biography: person.biography || '',
            notes: person.notes || '',
        });
        setSelectedParentFamily('');
        setSelectedChildrenHandles([]);
        setSelectedSpouseHandle('');
        loadFamilyOptions();
        setEditing(true);
    };

    const loadFamilyOptions = async () => {
        const { supabase } = await import('@/lib/supabase');
        const [{ data: fams }, { data: people }] = await Promise.all([
            supabase.from('families').select('handle, father_handle, mother_handle, children').order('handle'),
            supabase.from('people').select('handle, display_name, generation, gender'),
        ]);
        if (!fams) return;
        const typedPeople = (people || []) as Array<{ handle: string; display_name: string; generation?: number; gender?: number }>;
        const nameMap = new Map(typedPeople.map(p => [p.handle, p.display_name]));
        setAllFamilies(fams.map(f => {
            const parts: string[] = [];
            if (f.father_handle) parts.push(nameMap.get(f.father_handle) || f.father_handle);
            if (f.mother_handle) parts.push(nameMap.get(f.mother_handle) || f.mother_handle);
            const label = parts.length > 0
                ? `${f.handle} — ${parts.join(' & ')} (${(f.children as string[])?.length || 0} con)`
                : `${f.handle} (chưa có thành viên)`;
            return { handle: f.handle, label };
        }));

        const currentPerson = await supabase.from('people').select('generation, gender').eq('handle', handle).single();
        const currentPersonData = currentPerson?.data as { generation?: number, gender?: number } | undefined;
        const pGen = currentPersonData?.generation;

        setAllChildrenOptions(
            typedPeople
                .filter(p => !pGen || (p.generation && p.generation > pGen))
                .map(p => ({
                    handle: p.handle,
                    label: `${p.handle} — ${p.display_name} ${p.generation ? `(Đời ${p.generation})` : ''}`
                }))
        );

        setAllSpouseOptions(
            typedPeople
                .filter(p => !pGen || (p.generation && p.generation <= pGen && p.gender !== currentPersonData?.gender && p.gender !== 0 && currentPersonData?.gender !== 0))
                .map(p => ({
                    handle: p.handle,
                    label: `${p.handle} — ${p.display_name} ${p.generation ? `(Đời ${p.generation})` : ''}`
                }))
        );

        setAllSpouseOptions(
            (people || [])
                .filter(p => !pGen || (p.generation && p.generation <= pGen && p.gender !== currentPerson?.data?.gender && p.gender !== 0 && currentPerson?.data?.gender !== 0))
                .map(p => ({
                    handle: p.handle,
                    label: `${p.handle} — ${p.display_name} ${p.generation ? `(Đời ${p.generation})` : ''}`
                }))
        );
    };

    const handleSave = async () => {
        if (!person) return;
        setSaving(true);
        setSaveError('');
        const result = await updatePerson(handle, {
            displayName: form.displayName || undefined,
            gender: Number(form.gender),
            generation: Number(form.generation) || person.generation,
            surname: form.surname || null,
            firstName: form.firstName || null,
            nickName: form.nickName || null,
            birthDate: form.birthDate || null,
            deathDate: form.deathDate || null,
            isLiving: form.isLiving,
            isAffiliatedFamily: form.isAffiliatedFamily,
            phone: form.phone || null,
            email: form.email || null,
            zalo: form.zalo || null,
            facebook: form.facebook || null,
            hometown: form.hometown || null,
            currentAddress: form.currentAddress || null,
            occupation: form.occupation || null,
            company: form.company || null,
            education: form.education || null,
            biography: form.biography || null,
            notes: form.notes || null,
        });
        if (result.error) {
            setSaveError(result.error);
            setSaving(false);
            return;
        }
        await fetchPerson();
        setSaving(false);
        setEditing(false);
    };

    const handleDelete = async () => {
        if (!person) return;
        const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa thành viên ${person.displayName} (${person.handle})?\nHành động này không thể hoàn tác.`);
        if (!confirmDelete) return;

        setSaving(true);
        const { deletePerson } = await import('@/lib/supabase-data');
        const { error } = await deletePerson(handle, user?.id, person.displayName);
        if (error) {
            setSaveError(error);
            setSaving(false);
            return;
        }

        router.push('/');
    };

    const set = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleAddParent = async () => {
        if (!selectedParentFamily) return;
        setRelLoading(true);
        setRelError('');
        const { error } = await addPersonAsChild(handle, selectedParentFamily);
        if (error) { setRelError(error); } else { setSelectedParentFamily(''); await fetchPerson(); }
        setRelLoading(false);
    };

    const handleRemoveParent = async (fh: string) => {
        setRelLoading(true);
        setRelError('');
        const { error } = await removePersonFromParentFamily(handle, fh);
        if (error) { setRelError(error); }
        await fetchPerson();
        setRelLoading(false);
    };

    const handleAddChildren = async () => {
        if (selectedChildrenHandles.length === 0 || !person) return;
        setRelLoading(true);
        setRelError('');

        let targetFamilyHandle = '';
        if (person.families && person.families.length > 0) {
            targetFamilyHandle = person.families[0];
        } else {
            const { generateFamilyHandle, addFamily } = await import('@/lib/supabase-data');
            targetFamilyHandle = await generateFamilyHandle();
            const role = person.gender === 2 ? 'mother' : 'father';
            const { error: famError } = await addFamily({
                handle: targetFamilyHandle,
                [role === 'mother' ? 'motherHandle' : 'fatherHandle']: handle,
                children: []
            });
            if (famError) {
                setRelError(famError);
                setRelLoading(false);
                return;
            }
        }

        const { addPersonAsChild } = await import('@/lib/supabase-data');
        for (const childHandle of selectedChildrenHandles) {
            const { error } = await addPersonAsChild(childHandle, targetFamilyHandle);
            if (error) {
                setRelError(error);
                break;
            }
        }

        setSelectedChildrenHandles([]);
        await fetchPerson();
        setRelLoading(false);
    };

    const handleRemoveSpouse = async (fh: string) => {
        if (!person) return;
        setRelLoading(true);
        setRelError('');
        const role = person.gender === 2 ? 'mother' : 'father';
        const { error } = await removePersonFromSpouseFamily(handle, fh, role);
        if (error) { setRelError(error); }
        await fetchPerson();
        setRelLoading(false);
    };

    const handleAddSpouse = async () => {
        if (!selectedSpouseHandle || !person) return;
        setRelLoading(true);
        setRelError('');

        const { generateFamilyHandle, addFamily, addPersonAsSpouse } = await import('@/lib/supabase-data');
        const familyHandle = await generateFamilyHandle();
        const role = person.gender === 2 ? 'mother' : 'father';
        const spouseRole = person.gender === 2 ? 'father' : 'mother';

        const { error: famError } = await addFamily({
            handle: familyHandle,
            [role === 'mother' ? 'motherHandle' : 'fatherHandle']: handle,
            [spouseRole === 'mother' ? 'motherHandle' : 'fatherHandle']: selectedSpouseHandle,
            children: []
        });

        if (famError) {
            setRelError(famError);
            setRelLoading(false);
            return;
        }

        await addPersonAsSpouse(handle, familyHandle, role);
        await addPersonAsSpouse(selectedSpouseHandle, familyHandle, spouseRole);

        setSelectedSpouseHandle('');
        await fetchPerson();
        setRelLoading(false);
    };

    const handleMediaUpload = async (file: File) => {
        if (!file || !user) return;
        if (file.size > 5 * 1024 * 1024) { setMediaError('Ảnh quá lớn. Giới hạn 5MB.'); return; }
        setUploadingMedia(true);
        setMediaError('');
        try {
            const token = (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('linked_person', handle);
            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });
            const json = await res.json();
            if (!res.ok) {
                setMediaError(json.error || 'Tải ảnh thất bại');
            } else {
                await Promise.all([fetchMedia(), fetchPerson()]);
            }
        } catch {
            setMediaError('Lỗi khi tải ảnh lên');
        }
        setUploadingMedia(false);
    };

    const handleSetAvatar = async (mediaId: string) => {
        if (!user) return;
        try {
            const token = (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`/api/people/${handle}/set-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ mediaId }),
            });
            const json = await res.json();
            if (res.ok) {
                setPerson(p => p ? { ...p, avatarUrl: json.avatarUrl } : p);
            } else {
                setMediaError(json.error || 'Không đặt được ảnh đại diện');
            }
        } catch {
            setMediaError('Lỗi kết nối');
        }
    };

    const handleClearAvatar = async () => {
        if (!user) return;
        try {
            const token = (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`/api/people/${handle}/set-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ clear: true }),
            });
            if (res.ok) {
                setPerson(p => p ? { ...p, avatarUrl: undefined } : p);
            } else {
                const json = await res.json().catch(() => ({}));
                setMediaError((json as { error?: string }).error || 'Không xóa được ảnh đại diện');
            }
        } catch {
            setMediaError('Lỗi kết nối');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!person) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">Không tìm thấy người này</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Button>
            </div>
        );
    }

    const genderLabel = person.gender === 1 ? 'Nam' : person.gender === 2 ? 'Nữ' : 'Không rõ';

    return (
        <div className="space-y-6">
            {/* Hidden file input for media upload */}
            <input
                ref={mediaInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f); e.target.value = ''; }}
            />

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    {/* Avatar */}
                    <div className="relative group flex-shrink-0">
                        <PersonAvatar
                            avatarUrl={person.avatarUrl}
                            displayName={person.displayName}
                            gender={person.gender}
                            isPatrilineal={person.isPatrilineal}
                            isAffiliatedFamily={person.isAffiliatedFamily}
                            isLiving={person.isLiving}
                            size="xl"
                        />
                        {canEdit && (
                            <button
                                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100
                                    transition-opacity flex items-center justify-center text-white"
                                onClick={() => mediaInputRef.current?.click()}
                                title="Tải ảnh lên"
                            >
                                <Upload className="w-6 h-6" />
                            </button>
                        )}
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            {person.displayName}
                            {person.isPrivacyFiltered && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Thông tin bị giới hạn
                                </Badge>
                            )}
                        </h1>
                        <p className="text-muted-foreground">
                            {genderLabel}
                            {person.generation ? ` • Đời thứ ${person.generation}` : ''}
                            {person.chi ? ` • Chi ${person.chi}` : ''}
                            {person.isLiving && ' • Còn sống'}
                        </p>
                    </div>
                </div>

                {/* Edit / propose buttons */}
                <div className="flex items-center gap-2">
                    {canEdit && !editing && (
                        <>
                            <Button variant="outline" size="sm" onClick={startEdit}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Sửa thông tin
                            </Button>
                            {isAdmin && (
                                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Xóa
                                </Button>
                            )}
                        </>
                    )}
                    {isMember && !person.isPrivacyFiltered && (
                        <ContributeEditPersonDialog person={person} />
                    )}
                </div>
                {canEdit && editing && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditing(false); setSaveError(''); }} disabled={saving}>
                            <X className="h-4 w-4 mr-2" />
                            Hủy
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Privacy notice */}
            {person.isPrivacyFiltered && person._privacyNote && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400">
                    🔒 {person._privacyNote}
                </div>
            )}

            {/* ── EDIT FORM (Admin & Editor only) ── */}
            {editing && (
                <div className="space-y-4">
                    {/* Ảnh đại diện */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Image className="h-4 w-4" /> Ảnh đại diện
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <PersonAvatar
                                    avatarUrl={person.avatarUrl}
                                    displayName={person.displayName}
                                    gender={person.gender}
                                    isPatrilineal={person.isPatrilineal}
                                    isAffiliatedFamily={person.isAffiliatedFamily}
                                    isLiving={person.isLiving}
                                    size="lg"
                                />
                                <div className="space-y-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => mediaInputRef.current?.click()}
                                        disabled={uploadingMedia}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {uploadingMedia ? 'Đang tải...' : 'Tải ảnh lên'}
                                    </Button>
                                    {person.avatarUrl && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={handleClearAvatar}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Xóa ảnh đại diện
                                        </Button>
                                    )}
                                    <p className="text-xs text-muted-foreground">Ảnh tải lên được duyệt tự động và đặt làm đại diện ngay.</p>
                                </div>
                            </div>
                            {mediaError && <p className="mt-2 text-xs text-destructive">{mediaError}</p>}
                        </CardContent>
                    </Card>

                    {/* Thông tin cá nhân */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4" /> Thông tin cá nhân
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium leading-none">Họ tên đầy đủ</label>
                                <Input value={form.displayName} onChange={set('displayName')} placeholder="Nguyễn Văn A" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Họ</label>
                                <Input value={form.surname} onChange={set('surname')} placeholder="Nguyễn" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Tên</label>
                                <Input value={form.firstName} onChange={set('firstName')} placeholder="Văn A" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Tên thường gọi</label>
                                <Input value={form.nickName} onChange={set('nickName')} placeholder="Tên gọi ở nhà" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Giới tính</label>
                                <select
                                    value={form.gender}
                                    onChange={set('gender')}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                    <option value={1}>Nam</option>
                                    <option value={2}>Nữ</option>
                                    <option value={0}>Không rõ</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Đời (số thứ tự)</label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={form.generation}
                                    onChange={e => setForm(p => ({ ...p, generation: parseInt(e.target.value) || 1 }))}
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Ngày sinh</label>
                                <Input type="date" value={form.birthDate} onChange={set('birthDate')} max={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Ngày mất</label>
                                <Input type="date" value={form.deathDate} onChange={set('deathDate')} max={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Trạng thái</label>
                                <div className="flex gap-2 mt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={form.isLiving ? 'default' : 'outline'}
                                        onClick={() => setForm(p => ({ ...p, isLiving: true }))}
                                    >
                                        Còn sống
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={!form.isLiving ? 'default' : 'outline'}
                                        onClick={() => setForm(p => ({ ...p, isLiving: false }))}
                                    >
                                        Đã mất
                                    </Button>
                                </div>
                            </div>
                            {!person?.isPatrilineal && (
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium leading-none">Phân loại tộc</label>
                                    <div className="flex gap-2 mt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={form.isAffiliatedFamily ? 'default' : 'outline'}
                                            className={form.isAffiliatedFamily ? 'bg-teal-500 hover:bg-teal-600 border-teal-500' : ''}
                                            onClick={() => setForm(p => ({ ...p, isAffiliatedFamily: true }))}
                                        >
                                            Thân tộc
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={!form.isAffiliatedFamily ? 'default' : 'outline'}
                                            onClick={() => setForm(p => ({ ...p, isAffiliatedFamily: false }))}
                                        >
                                            Ngoại tộc
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="text-teal-600 font-medium">Thân tộc</span> — có nguồn gốc gần với họ Phạm (vợ/chồng, con cháu qua kết hôn).
                                        <span className="text-slate-500 ml-1">Ngoại tộc</span> — không liên quan trực tiếp.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Liên hệ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Liên hệ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium leading-none">Điện thoại</label>
                                <Input value={form.phone} onChange={set('phone')} placeholder="0912345678" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Email</label>
                                <Input type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Zalo</label>
                                <Input value={form.zalo} onChange={set('zalo')} placeholder="Số Zalo" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Facebook</label>
                                <Input value={form.facebook} onChange={set('facebook')} placeholder="Link Facebook" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Địa chỉ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> Địa chỉ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium leading-none">Quê quán</label>
                                <Input value={form.hometown} onChange={set('hometown')} placeholder="Tỉnh/huyện quê quán" />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Nơi ở hiện tại</label>
                                <Input value={form.currentAddress} onChange={set('currentAddress')} placeholder="Địa chỉ hiện tại" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Nghề nghiệp & Học vấn */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Briefcase className="h-4 w-4" /> Nghề nghiệp & Học vấn
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium leading-none">Nghề nghiệp</label>
                                <Input value={form.occupation} onChange={set('occupation')} placeholder="Kỹ sư, Giáo viên..." />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Nơi công tác</label>
                                <Input value={form.company} onChange={set('company')} placeholder="Tên công ty / cơ quan" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium leading-none">Học vấn</label>
                                <Input value={form.education} onChange={set('education')} placeholder="Đại học, Thạc sĩ..." />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tiểu sử & Ghi chú */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Tiểu sử & Ghi chú
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium leading-none">Tiểu sử</label>
                                <Textarea
                                    value={form.biography}
                                    onChange={set('biography')}
                                    placeholder="Tiểu sử ngắn..."
                                    rows={4}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium leading-none">Ghi chú nội bộ</label>
                                <Textarea
                                    value={form.notes}
                                    onChange={set('notes')}
                                    placeholder="Ghi chú thêm (chỉ admin thấy)..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quan hệ gia đình */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Heart className="h-4 w-4" /> Quan hệ gia đình
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {relError && (
                                <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{relError}</div>
                            )}

                            {/* Gia đình cha/mẹ */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Gia đình cha/mẹ (parentFamilies)</p>
                                <div className="flex flex-wrap gap-2">
                                    {(person?.parentFamilies || []).map(fh => (
                                        <span key={fh} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium" title={fh}>
                                            {familyInfoMap.get(fh) || fh}
                                            <button
                                                type="button"
                                                className="ml-1 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveParent(fh)}
                                                disabled={relLoading}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {(person?.parentFamilies || []).length === 0 && (
                                        <span className="text-xs text-muted-foreground">Chưa có</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedParentFamily}
                                        onChange={e => setSelectedParentFamily(e.target.value)}
                                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="">— Chọn gia đình cha/mẹ —</option>
                                        {allFamilies
                                            .filter(f => !(person?.parentFamilies || []).includes(f.handle))
                                            .map(f => (
                                                <option key={f.handle} value={f.handle}>{f.label}</option>
                                            ))
                                        }
                                    </select>
                                    <Button size="sm" variant="outline" onClick={handleAddParent} disabled={relLoading || !selectedParentFamily}>
                                        Thêm
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            {/* Gia đình vợ/chồng */}
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium mb-2">Danh sách gia đình đã có (Vợ/Chồng/Con)</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(person?.families || []).map(fh => (
                                            <span key={fh} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium" title={fh}>
                                                {familyInfoMap.get(fh) || fh}
                                                <button
                                                    type="button"
                                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleRemoveSpouse(fh)}
                                                    disabled={relLoading}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                        {(person?.families || []).length === 0 && (
                                            <span className="text-xs text-muted-foreground">Chưa có</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t">
                                    <p className="text-sm font-medium">Thêm Vợ/Chồng (Tạo gia đình mới)</p>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedSpouseHandle}
                                            onChange={e => setSelectedSpouseHandle(e.target.value)}
                                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                        >
                                            <option value="">— Chọn Vợ/Chồng —</option>
                                            {allSpouseOptions.map(f => (
                                                <option key={f.handle} value={f.handle}>{f.label}</option>
                                            ))}
                                        </select>
                                        <Button size="sm" variant="outline" onClick={handleAddSpouse} disabled={relLoading || !selectedSpouseHandle}>
                                            Thêm
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t">
                                    <p className="text-sm font-medium">
                                        Thêm con cái vào gia đình (Vai trò {person?.gender === 2 ? 'Mẹ' : 'Ba'})
                                    </p>
                                    <div className="flex gap-2">
                                        <select
                                            multiple
                                            value={selectedChildrenHandles}
                                            onChange={e => setSelectedChildrenHandles(Array.from(e.target.selectedOptions, o => o.value))}
                                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm min-h-[100px]"
                                        >
                                            {allChildrenOptions
                                                .map(f => (
                                                    <option key={f.handle} value={f.handle}>{f.label}</option>
                                                ))
                                            }
                                        </select>
                                        <Button size="sm" variant="outline" onClick={handleAddChildren} disabled={relLoading || selectedChildrenHandles.length === 0}>
                                            Thêm
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {saveError && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                            Lỗi khi lưu: {saveError}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pb-4">
                        <Button variant="outline" onClick={() => { setEditing(false); setSaveError(''); }} disabled={saving}>
                            <X className="h-4 w-4 mr-2" />
                            Hủy
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── READ-ONLY VIEW ── */}
            {!editing && (
                <Tabs defaultValue="overview">
                    <TabsList>
                        <TabsTrigger value="overview" className="gap-1">
                            <User className="h-3.5 w-3.5" /> Tổng quan
                        </TabsTrigger>
                        <TabsTrigger value="relationships" className="gap-1">
                            <Heart className="h-3.5 w-3.5" /> Quan hệ
                        </TabsTrigger>
                        <TabsTrigger value="media" className="gap-1">
                            <Image className="h-3.5 w-3.5" /> Tư liệu
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-1">
                            <History className="h-3.5 w-3.5" /> Lịch sử
                        </TabsTrigger>
                        <TabsTrigger value="comments" className="gap-1">
                            <MessageCircle className="h-3.5 w-3.5" /> Bình luận
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview */}
                    <TabsContent value="overview" className="space-y-4">
                        {/* Thông tin cá nhân */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <User className="h-4 w-4" /> Thông tin cá nhân
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <InfoRow label="Họ" value={person.surname || '—'} />
                                <InfoRow label="Tên" value={person.firstName || '—'} />
                                <InfoRow label="Giới tính" value={genderLabel} />
                                {person.nickName && <InfoRow label="Tên thường gọi" value={person.nickName} />}
                                <InfoRow label="Ngày sinh" value={person.birthDate ? formatDateVN(person.birthDate) : (person.birthYear ? `${person.birthYear}` : '—')} />
                                {(person.birthDate || person.birthYear) && <InfoRow label="Năm âm lịch" value={zodiacYear(person.birthDate ? new Date(person.birthDate).getFullYear() : person.birthYear) || '—'} />}
                                <InfoRow label="Nơi sinh" value={person.birthPlace || '—'} />
                                {!person.isLiving && (
                                    <>
                                        <InfoRow label="Ngày mất" value={person.deathDate ? formatDateVN(person.deathDate) : (person.deathYear ? `${person.deathYear}` : '—')} />
                                        <InfoRow label="Nơi mất" value={person.deathPlace || '—'} />
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Liên hệ */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Phone className="h-4 w-4" /> Liên hệ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <InfoRow label="Điện thoại" value={person.phone || '—'} />
                                <InfoRow label="Email" value={person.email || '—'} />
                                <InfoRow label="Zalo" value={person.zalo || '—'} />
                                {person.facebook ? (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground">Facebook</p>
                                        <a
                                            href={person.facebook.startsWith('http') ? person.facebook : `https://${person.facebook}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline break-all"
                                        >
                                            {person.facebook}
                                        </a>
                                    </div>
                                ) : (
                                    <InfoRow label="Facebook" value="—" />
                                )}
                            </CardContent>
                        </Card>

                        {/* Địa chỉ */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Địa chỉ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <InfoRow label="Quê quán" value={person.hometown || '—'} />
                                <InfoRow label="Nơi ở hiện tại" value={person.currentAddress || '—'} />
                            </CardContent>
                        </Card>

                        {/* Nghề nghiệp & Học vấn */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" /> Nghề nghiệp & Học vấn
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <InfoRow label="Nghề nghiệp" value={person.occupation || '—'} />
                                <InfoRow label="Nơi công tác" value={person.company || '—'} />
                                <div className="flex items-start gap-2">
                                    <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground">Học vấn</p>
                                        <p className="text-sm">{person.education || '—'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tiểu sử & Ghi chú */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Tiểu sử & Ghi chú
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Tiểu sử</p>
                                    <p className="text-sm leading-relaxed">{person.biography || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Ghi chú</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{person.notes || '—'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tags */}
                        {person.tags && person.tags.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Tag className="h-4 w-4" /> Nhãn
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {person.tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Relationships */}
                    <TabsContent value="relationships">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Quan hệ gia đình</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Gia đình (cha/mẹ)</p>
                                        {person.parentFamilies && person.parentFamilies.length > 0 ? (
                                            person.parentFamilies.map((f) => (
                                                <Badge key={f} variant="outline" className="mr-1" title={f}>
                                                    {familyInfoMap.get(f) || f}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                        )}
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Gia đình (vợ/chồng, con)</p>
                                        {person.families && person.families.length > 0 ? (
                                            person.families.map((f) => (
                                                <Badge key={f} variant="outline" className="mr-1" title={f}>
                                                    {familyInfoMap.get(f) || f}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Media */}
                    <TabsContent value="media">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base">Ảnh &amp; Tư liệu</CardTitle>
                                <div className="flex gap-2">
                                    {canEdit && (
                                        <Button size="sm" variant="outline" onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia}>
                                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                                            {uploadingMedia ? 'Đang tải...' : 'Tải ảnh lên'}
                                        </Button>
                                    )}
                                    {isMember && !canEdit && (
                                        <Button size="sm" variant="outline" onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia}>
                                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                                            {uploadingMedia ? 'Đang tải...' : 'Đề xuất ảnh'}
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {mediaError && (
                                    <p className="text-sm text-destructive mb-3">{mediaError}</p>
                                )}
                                {mediaLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                    </div>
                                ) : mediaItems.length === 0 ? (
                                    <p className="text-muted-foreground text-sm py-4 text-center">Chưa có ảnh nào</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {mediaItems.map(m => (
                                            <div key={m.id} className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={m.thumbnail_url || m.storage_url}
                                                    alt={m.title || 'Ảnh'}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                {/* State badge */}
                                                {m.state !== 'PUBLISHED' && (
                                                    <span className={`absolute top-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.state === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                                                        {m.state === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}
                                                    </span>
                                                )}
                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                                                        onClick={() => setLightboxUrl(m.storage_url)}
                                                        title="Xem lớn"
                                                    >
                                                        <ZoomIn className="w-4 h-4 text-white" />
                                                    </button>
                                                    {canEdit && m.state === 'PUBLISHED' && m.storage_url !== person.avatarUrl && (
                                                        <button
                                                            className="p-1.5 bg-white/20 rounded-full hover:bg-amber-400/80 transition-colors"
                                                            onClick={() => handleSetAvatar(m.id)}
                                                            title="Đặt làm ảnh đại diện"
                                                        >
                                                            <Star className="w-4 h-4 text-white" />
                                                        </button>
                                                    )}
                                                    {canEdit && m.storage_url === person.avatarUrl && (
                                                        <button
                                                            className="p-1.5 bg-amber-400/80 rounded-full"
                                                            onClick={handleClearAvatar}
                                                            title="Bỏ ảnh đại diện"
                                                        >
                                                            <Star className="w-4 h-4 text-white fill-white" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {/* Lightbox */}
                        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
                            <DialogContent className="max-w-3xl p-2">
                                {lightboxUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={lightboxUrl} alt="Xem ảnh" className="w-full max-h-[80vh] object-contain rounded" />
                                )}
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    {/* History */}
                    <TabsContent value="history">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Lịch sử thay đổi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm">
                                    Audit log cho entity này sẽ được bổ sung trong Epic 4.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Comments */}
                    <TabsContent value="comments">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4" /> Bình luận
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CommentSection personHandle={handle} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm">{value}</p>
        </div>
    );
}
