'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    UserPlus, ArrowRight, ArrowLeft, Check,
    Users, GitMerge, SkipForward, Loader2, X, Camera,
} from 'lucide-react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    addPerson,
    addPersonAsChild,
    addPersonAsSpouse,
    addFamily,
    generatePersonHandle,
    generateFamilyHandle,
    fetchFamiliesForSelect,
    fetchPeopleForSelect,
} from '@/lib/supabase-data';

// ── Types ─────────────────────────────────────────────────────

type Step = 'info' | 'relation' | 'done';
type RelationMode = 'child' | 'spouse' | 'new-family' | 'skip' | null;

interface FamilyOption {
    handle: string;
    label: string;
    fatherName?: string;
    motherName?: string;
    parentGeneration?: number;
}

interface PersonOption {
    handle: string;
    displayName: string;
    generation: number;
    gender: number;
}

interface FormData {
    displayName: string;
    gender: number;
    generation: number;
    birthDate: string; // ISO DATE: "YYYY-MM-DD"
    deathDate: string; // ISO DATE: "YYYY-MM-DD"
    isLiving: boolean;
    occupation: string;
    currentAddress: string;
    phone: string;
    email: string;
    zalo: string;
    facebook: string;
}

const INITIAL_FORM: FormData = {
    displayName: '',
    gender: 1,
    generation: 3,
    birthDate: '',
    deathDate: '',
    isLiving: true,
    occupation: '',
    currentAddress: '',
    phone: '',
    email: '',
    zalo: '',
    facebook: '',
};

// ── Sub components ─────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
    const steps = [
        { key: 'info', label: 'Thông tin' },
        { key: 'relation', label: 'Quan hệ' },
        { key: 'done', label: 'Hoàn tất' },
    ];
    const idx = steps.findIndex(s => s.key === step);
    return (
        <div className="flex items-center gap-1 mb-6">
            {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                    <div className={`
                        flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
                        ${i < idx ? 'bg-green-500 text-white' : i === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                        {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs hidden sm:inline ${i === idx ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {s.label}
                    </span>
                    {i < steps.length - 1 && (
                        <div className={`h-px w-6 mx-1 ${i < idx ? 'bg-green-500' : 'bg-border'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Step 1: Member Info ────────────────────────────────────────

function StepInfo({
    form,
    onChange,
    onNext,
    loading,
    avatarPreview,
    onPhotoChange,
    familyOptions,
    preselectedParentFamily,
    onPreselectedFamilyChange,
}: {
    form: FormData;
    onChange: (f: Partial<FormData>) => void;
    onNext: () => void;
    loading: boolean;
    avatarPreview: string | null;
    onPhotoChange: (file: File | null) => void;
    familyOptions: FamilyOption[];
    preselectedParentFamily: string;
    onPreselectedFamilyChange: (handle: string) => void;
}) {
    const photoInputRef = useRef<HTMLInputElement>(null);
    const isValid = form.displayName.trim().length >= 2;

    const handlePhotoSelect = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > MAX_IMAGE_SIZE) { onPhotoChange(null); return; }
        onPhotoChange(file);
    };

    return (
        <div className="space-y-4">
            {/* Họ tên */}
            <div className="space-y-1.5">
                <label className="text-sm font-medium">
                    Họ và tên <span className="text-destructive">*</span>
                </label>
                <Input
                    id="member-name"
                    placeholder="Vd: Nguyễn Văn An"
                    value={form.displayName}
                    onChange={e => onChange({ displayName: e.target.value })}
                    autoFocus
                />
            </div>

            {/* Gia đình cha/mẹ — chọn trước để tự động tính đời */}
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Gia đình cha/mẹ (tùy chọn — tự động tính đời)</label>
                <select
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                    value={preselectedParentFamily}
                    onChange={e => {
                        const handle = e.target.value;
                        onPreselectedFamilyChange(handle);
                        if (handle) {
                            const fam = familyOptions.find(f => f.handle === handle);
                            if (fam?.parentGeneration != null) {
                                onChange({ generation: fam.parentGeneration + 1 });
                            }
                        }
                    }}
                >
                    <option value="">-- Không chọn / Tự nhập đời --</option>
                    {familyOptions.map(f => (
                        <option key={f.handle} value={f.handle}>{f.label}</option>
                    ))}
                </select>
            </div>

            {/* Giới tính + Đời */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Giới tính <span className="text-destructive">*</span></label>
                    <div className="flex gap-2">
                        {[{ v: 1, l: '👨 Nam' }, { v: 2, l: '👩 Nữ' }].map(g => (
                            <button
                                key={g.v}
                                type="button"
                                onClick={() => onChange({ gender: g.v })}
                                className={`flex-1 py-2 rounded-md border text-sm font-medium transition-all ${form.gender === g.v
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted'
                                    }`}
                            >
                                {g.l}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Đời thứ{preselectedParentFamily ? <span className="text-xs text-teal-600 ml-1">(tự động)</span> : ''}
                    </label>
                    <Input
                        id="member-generation"
                        type="number"
                        min={1}
                        max={10}
                        value={form.generation}
                        onChange={e => onChange({ generation: parseInt(e.target.value) || 1 })}
                        readOnly={!!preselectedParentFamily}
                        className={preselectedParentFamily ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                    />
                </div>
            </div>

            {/* Ngày sinh / mất */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ngày sinh</label>
                    <Input
                        id="member-birth-date"
                        type="date"
                        value={form.birthDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => onChange({ birthDate: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ngày mất</label>
                    <Input
                        id="member-death-date"
                        type="date"
                        value={form.deathDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => {
                            const val = e.target.value;
                            onChange({ deathDate: val, isLiving: !val });
                        }}
                    />
                </div>
            </div>

            {/* Nghề nghiệp + Địa chỉ */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nghề nghiệp</label>
                    <Input
                        id="member-occupation"
                        placeholder="Vd: Kỹ sư, Giáo viên..."
                        value={form.occupation}
                        onChange={e => onChange({ occupation: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Địa chỉ hiện tại</label>
                    <Input
                        id="member-address"
                        placeholder="Vd: TP HCM"
                        value={form.currentAddress}
                        onChange={e => onChange({ currentAddress: e.target.value })}
                    />
                </div>
            </div>

            {/* Điện thoại + Email */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Điện thoại</label>
                    <Input
                        id="member-phone"
                        type="tel"
                        placeholder="0901234567"
                        value={form.phone}
                        onChange={e => onChange({ phone: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                        id="member-email"
                        type="email"
                        placeholder="example@email.com"
                        value={form.email}
                        onChange={e => onChange({ email: e.target.value })}
                    />
                </div>
            </div>

            {/* Zalo + Facebook */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Zalo</label>
                    <Input
                        id="member-zalo"
                        type="tel"
                        placeholder="Số Zalo"
                        value={form.zalo}
                        onChange={e => onChange({ zalo: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Facebook</label>
                    <Input
                        id="member-facebook"
                        placeholder="Link Facebook / Username"
                        value={form.facebook}
                        onChange={e => onChange({ facebook: e.target.value })}
                    />
                </div>
            </div>

            {/* Ảnh đại diện */}
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ảnh đại diện (tuỳ chọn)</label>
                <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoSelect(f);
                        e.target.value = '';
                    }}
                />
                {avatarPreview ? (
                    <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={avatarPreview}
                            alt="Preview"
                            className="w-16 h-16 rounded-full object-cover border-2 border-muted shadow-sm"
                        />
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Ảnh đã chọn</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="text-xs text-primary underline"
                                    onClick={() => photoInputRef.current?.click()}
                                >
                                    Đổi ảnh
                                </button>
                                <button
                                    type="button"
                                    className="text-xs text-destructive underline"
                                    onClick={() => onPhotoChange(null)}
                                >
                                    Xoá
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed rounded-lg px-4 py-2.5 hover:bg-muted/50 hover:border-primary/50 transition-colors w-full"
                    >
                        <Camera className="w-4 h-4 shrink-0" />
                        Chọn ảnh (JPG, PNG, WebP — tối đa 5MB)
                    </button>
                )}
            </div>

            <Button
                id="member-next-btn"
                className="w-full mt-2"
                onClick={onNext}
                disabled={!isValid || loading}
            >
                {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tạo...</>
                ) : (
                    <>Tiếp theo — Thiết lập quan hệ <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
            </Button>
        </div>
    );
}

// ── Step 2: Relationship ───────────────────────────────────────

function StepRelation({
    personHandle,
    personName,
    personGeneration,
    families,
    people,
    onCreatePerson,
    onDone,
    onBack,
    preselectedFamily,
}: {
    personHandle: string;
    personName: string;
    personGeneration: number;
    families: FamilyOption[];
    people: PersonOption[];
    onCreatePerson: () => Promise<{ handle?: string, error?: string }>;
    onDone: (message: string) => void;
    onBack: () => void;
    preselectedFamily?: string;
}) {
    const [mode, setMode] = useState<RelationMode>(preselectedFamily ? 'child' : null);
    const [selectedFamily, setSelectedFamily] = useState(preselectedFamily ?? '');
    const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
    const [spouseRole, setSpouseRole] = useState<'father' | 'mother'>('father');
    const [newFatherHandle, setNewFatherHandle] = useState('');
    const [newMotherHandle, setNewMotherHandle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            if (mode === 'child') {
                if (!selectedFamily) { setError('Vui lòng chọn gia đình'); setLoading(false); return; }
            } else if (mode === 'spouse') {
                if (selectedChildren.length === 0) { setError('Vui lòng chọn ít nhất 1 người con'); setLoading(false); return; }
            }

            // Tạo người trong DB FIRST
            const createRes = await onCreatePerson();
            if (createRes.error || !createRes.handle) {
                setError(createRes.error || 'Lỗi khi tạo thành viên');
                setLoading(false);
                return;
            }
            const finalPersonHandle = createRes.handle;

            if (mode === 'child') {
                const r = await addPersonAsChild(finalPersonHandle, selectedFamily);
                if (r.error) { setError(r.error); setLoading(false); return; }
                onDone(`✅ Đã thêm ${personName} làm con trong gia đình ${selectedFamily}`);

            } else if (mode === 'spouse') {
                const { fetchFamilies } = await import('@/lib/supabase-data');
                const allFams = await fetchFamilies();

                // Find a family that contains the first selected child and is missing this role
                // Or just the first family of the first child.
                const existingFam = allFams.find(f => f.children.includes(selectedChildren[0]) && !f[spouseRole === 'father' ? 'fatherHandle' : 'motherHandle']);

                let targetFamilyHandle = existingFam?.handle;

                if (!targetFamilyHandle) {
                    // Create a new family
                    targetFamilyHandle = await generateFamilyHandle();
                    const r = await addFamily({
                        handle: targetFamilyHandle,
                        fatherHandle: spouseRole === 'father' ? finalPersonHandle : undefined,
                        motherHandle: spouseRole === 'mother' ? finalPersonHandle : undefined,
                    });
                    if (r.error) { setError(r.error); setLoading(false); return; }

                    for (const childHandle of selectedChildren) {
                        await addPersonAsChild(childHandle, targetFamilyHandle);
                    }
                    const s = await addPersonAsSpouse(finalPersonHandle, targetFamilyHandle, spouseRole);
                    if (s.error) { setError(s.error); setLoading(false); return; }
                } else {
                    const r = await addPersonAsSpouse(finalPersonHandle, targetFamilyHandle, spouseRole);
                    if (r.error) { setError(r.error); setLoading(false); return; }

                    for (const childHandle of selectedChildren) {
                        if (existingFam && !existingFam.children.includes(childHandle)) {
                            await addPersonAsChild(childHandle, targetFamilyHandle);
                        }
                    }
                }

                onDone(`✅ Đã thêm ${personName} làm ${spouseRole === 'father' ? 'cha' : 'mẹ'} của ${selectedChildren.length} người con`);

            } else if (mode === 'new-family') {
                const { fetchFamilies: fetchAllFamilies } = await import('@/lib/supabase-data');
                const allFamilies = await fetchAllFamilies();

                // Nếu cha hoặc mẹ đã có gia đình mà còn thiếu 1 vị trí vợ/chồng
                // → dùng lại gia đình đó thay vì tạo mới (tránh tạo duplicate)
                const existingFamily = allFamilies.find(f => {
                    const fatherMatch = newFatherHandle && f.fatherHandle === newFatherHandle && !f.motherHandle;
                    const motherMatch = newMotherHandle && f.motherHandle === newMotherHandle && !f.fatherHandle;
                    return fatherMatch || motherMatch;
                });

                if (existingFamily) {
                    // Thêm vị trí còn thiếu vào gia đình đã có
                    const missingRole = existingFamily.fatherHandle ? 'mother' : 'father';
                    const missingHandle = missingRole === 'father'
                        ? (newFatherHandle || finalPersonHandle)
                        : (newMotherHandle || finalPersonHandle);
                    const s = await addPersonAsSpouse(missingHandle, existingFamily.handle, missingRole);
                    if (s.error) { setError(s.error); setLoading(false); return; }
                    onDone(`✅ Đã liên kết ${personName} vào gia đình ${existingFamily.handle}`);
                } else {
                    const newFH = await generateFamilyHandle();
                    const r = await addFamily({
                        handle: newFH,
                        fatherHandle: newFatherHandle || undefined,
                        motherHandle: newMotherHandle || undefined,
                    });
                    if (r.error) { setError(r.error); setLoading(false); return; }

                    // Nếu personHandle là cha hoặc mẹ trong gia đình mới
                    const isParent = newFatherHandle === finalPersonHandle || newMotherHandle === finalPersonHandle;
                    if (isParent) {
                        const role = newFatherHandle === finalPersonHandle ? 'father' : 'mother';
                        await addPersonAsSpouse(finalPersonHandle, newFH, role);
                    }
                    onDone(`✅ Đã tạo gia đình mới ${newFH} và liên kết ${personName}`);
                }

            } else if (mode === 'skip') {
                onDone(`✅ Đã thêm ${personName} vào gia phả (chưa có quan hệ)`);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setLoading(false);
        }
    };

    const modeCards = [
        {
            key: 'child' as RelationMode,
            icon: <Users className="h-5 w-5" />,
            title: 'Con của gia đình',
            desc: 'Chọn gia đình (cha mẹ) mà người này là con',
            color: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30',
            activeColor: 'border-blue-500 ring-2 ring-blue-300',
        },
        {
            key: 'spouse' as RelationMode,
            icon: <GitMerge className="h-5 w-5" />,
            title: 'Cha / Mẹ của (Chọn con cái)',
            desc: 'Thêm người này làm cha hoặc mẹ của những người con đã chọn',
            color: 'border-purple-300 bg-purple-50 dark:bg-purple-950/30',
            activeColor: 'border-purple-500 ring-2 ring-purple-300',
        },
        {
            key: 'new-family' as RelationMode,
            icon: <ArrowRight className="h-5 w-5" />,
            title: 'Tạo gia đình mới',
            desc: 'Tạo cặp vợ chồng mới với người này',
            color: 'border-green-300 bg-green-50 dark:bg-green-950/30',
            activeColor: 'border-green-500 ring-2 ring-green-300',
        },
        {
            key: 'skip' as RelationMode,
            icon: <SkipForward className="h-5 w-5" />,
            title: 'Bỏ qua',
            desc: 'Thêm vào gia phả, thiết lập quan hệ sau',
            color: 'border-gray-300 bg-gray-50 dark:bg-gray-900/30',
            activeColor: 'border-gray-500 ring-2 ring-gray-300',
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className="font-mono">{personHandle}</Badge>
                <span className="text-sm font-medium">{personName}</span>
                <span className="text-xs text-muted-foreground ml-auto">đang chờ hoàn tất...</span>
            </div>

            {/* Mode selection */}
            <p className="text-sm font-medium text-muted-foreground">Chọn kiểu quan hệ:</p>
            <div className="grid grid-cols-2 gap-2">
                {modeCards.map(card => (
                    <button
                        key={card.key}
                        type="button"
                        onClick={() => { setMode(card.key); setError(null); }}
                        className={`
                            text-left p-3 rounded-lg border transition-all
                            ${mode === card.key ? card.activeColor : card.color}
                            hover:opacity-90
                        `}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            {card.icon}
                            <span className="text-sm font-semibold">{card.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                    </button>
                ))}
            </div>

            {/* Mode detail */}
            {mode === 'child' && (
                <div className="space-y-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <label className="text-sm font-medium">Chọn gia đình (cha mẹ):</label>
                    <select
                        id="relation-family-child"
                        className="w-full rounded-md border px-3 py-2 text-sm bg-background dark:bg-background"
                        value={selectedFamily}
                        onChange={e => setSelectedFamily(e.target.value)}
                    >
                        <option value="">-- Chọn gia đình --</option>
                        {families.map(f => (
                            <option key={f.handle} value={f.handle}>{f.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {mode === 'spouse' && (
                <div className="space-y-3 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Vai trò:</label>
                        <div className="flex gap-2">
                            {[{ v: 'father' as const, l: '👨 Cha' }, { v: 'mother' as const, l: '👩 Mẹ' }].map(r => (
                                <button
                                    key={r.v}
                                    type="button"
                                    onClick={() => setSpouseRole(r.v)}
                                    className={`flex-1 py-1.5 rounded border text-sm font-medium transition-all ${spouseRole === r.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                                        }`}
                                >
                                    {r.l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Chọn con cái (Nhấn Ctrl/Cmd để chọn nhiều):</label>
                        <select
                            multiple
                            id="relation-children-spouse"
                            className="w-full rounded-md border px-3 py-2 text-sm bg-background dark:bg-background h-32"
                            value={selectedChildren}
                            onChange={e => {
                                const selected = Array.from(e.target.selectedOptions, option => option.value);
                                setSelectedChildren(selected);
                            }}
                        >
                            {people.filter(p => !personGeneration || p.generation > personGeneration).map(p => (
                                <option key={p.handle} value={p.handle}>
                                    {p.displayName} (Đời {p.generation}) - {p.handle}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {mode === 'new-family' && (
                <div className="space-y-3 p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <p className="text-xs text-muted-foreground">
                        Thành viên vừa tạo (<strong>{personHandle}</strong>) sẽ được tự động gán vào gia đình mới này khi bạn bấm hoàn tất.
                    </p>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Chọn Cha (tùy chọn):</label>
                        <select
                            id="relation-new-father"
                            className="w-full rounded-md border px-3 py-2 text-sm bg-background dark:bg-background"
                            value={newFatherHandle}
                            onChange={e => setNewFatherHandle(e.target.value)}
                        >
                            <option value="">-- Chưa có cha --</option>
                            {people.filter(p => p.gender === 1 && p.generation <= personGeneration).map(p => (
                                <option key={p.handle} value={p.handle}>
                                    {p.displayName} ({p.handle}, Đ{p.generation})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Chọn Mẹ (tùy chọn):</label>
                        <select
                            id="relation-new-mother"
                            className="w-full rounded-md border px-3 py-2 text-sm bg-background dark:bg-background"
                            value={newMotherHandle}
                            onChange={e => setNewMotherHandle(e.target.value)}
                        >
                            <option value="">-- Chưa có mẹ --</option>
                            {people.filter(p => p.gender === 2 && p.generation <= personGeneration).map(p => (
                                <option key={p.handle} value={p.handle}>
                                    {p.displayName} ({p.handle}, Đ{p.generation})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {mode === 'skip' && (
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50 dark:bg-gray-900/20">
                    <p className="text-sm text-muted-foreground">
                        {personName} sẽ được thêm vào danh sách nhưng chưa gắn vào cây gia phả.
                        Bạn có thể thiết lập quan hệ sau từ trang chi tiết của người này.
                    </p>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <X className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Quay lại
                </Button>
                <Button
                    id="relation-submit-btn"
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={!mode || loading}
                >
                    {loading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
                        : <><Check className="mr-2 h-4 w-4" /> Hoàn tất</>
                    }
                </Button>
            </div>
        </div>
    );
}

// ── Step 3: Done ───────────────────────────────────────────────

function StepDone({
    message,
    personHandle,
    onAddAnother,
    onClose,
}: {
    message: string;
    personHandle: string;
    onAddAnother: () => void;
    onClose: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-1">
                <h3 className="font-semibold text-lg">Thành công!</h3>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Badge variant="outline" className="font-mono mt-2">{personHandle}</Badge>
            </div>
            <div className="flex gap-3 w-full">
                <Button id="add-another-btn" variant="outline" className="flex-1" onClick={onAddAnother}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Thêm người khác
                </Button>
                <Button id="done-close-btn" className="flex-1" onClick={onClose}>
                    Đóng
                </Button>
            </div>
        </div>
    );
}

// ── Main Dialog ────────────────────────────────────────────────

interface AddMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function AddMemberDialog({ open, onOpenChange, onSuccess }: AddMemberDialogProps) {
    const [step, setStep] = useState<Step>('info');
    const [form, setForm] = useState<FormData>(INITIAL_FORM);
    const [createdHandle, setCreatedHandle] = useState('');
    const [doneMessage, setDoneMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [families, setFamilies] = useState<FamilyOption[]>([]);
    const [people, setPeople] = useState<PersonOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [preselectedParentFamily, setPreselectedParentFamily] = useState('');

    // Load families + people for dropdowns when dialog opens
    useEffect(() => {
        if (!open) return;
        setLoadingOptions(true);
        Promise.all([fetchFamiliesForSelect(), fetchPeopleForSelect()])
            .then(([fams, persons]) => {
                setFamilies(fams);
                setPeople(persons);
            })
            .finally(() => setLoadingOptions(false));
    }, [open]);

    const resetAll = useCallback(() => {
        setStep('info');
        setForm(INITIAL_FORM);
        setCreatedHandle('');
        setDoneMessage('');
        setCreateError(null);
        setAvatarFile(null);
        setAvatarPreview(null);
        setPreselectedParentFamily('');
    }, []);

    const handlePhotoChange = useCallback((file: File | null) => {
        setAvatarFile(file);
        if (!file) {
            setAvatarPreview(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = e => setAvatarPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    }, []);

    const handleClose = useCallback(() => {
        onOpenChange(false);
        setTimeout(resetAll, 300); // reset sau khi dialog đóng animation xong
    }, [onOpenChange, resetAll]);

    const handleFormChange = useCallback((partial: Partial<FormData>) => {
        setForm(prev => ({ ...prev, ...partial }));
    }, []);

    // Step 1 → 2: tạo person handle trước, nhưng CHƯA LƯU DB
    const handleNext = useCallback(async () => {
        setCreating(true);
        setCreateError(null);
        try {
            const handle = await generatePersonHandle();
            setCreatedHandle(handle);
            setStep('relation');

            // Thêm người ảo vào danh sách people để có thể chọn trong dropdown
            setPeople(prev => {
                const newPerson = {
                    handle,
                    displayName: form.displayName.trim() + ' (Mới)',
                    generation: form.generation,
                    gender: form.gender,
                };
                return [newPerson, ...prev.filter(p => p.handle !== handle)];
            });
        } catch (e: unknown) {
            setCreateError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setCreating(false);
        }
    }, [form]);

    const handleCreatePerson = useCallback(async () => {
        let handle = createdHandle;
        if (!handle) {
            handle = await generatePersonHandle();
            setCreatedHandle(handle);
        }
        const result = await addPerson({
            handle,
            displayName: form.displayName.trim(),
            gender: form.gender,
            generation: form.generation,
            birthDate: form.birthDate || null,
            deathDate: form.deathDate || null,
            isLiving: form.isLiving,
            families: [],
            parentFamilies: [],
            zalo: form.zalo || null,
            facebook: form.facebook || null,
        });

        // Upload ảnh sau khi tạo người (editor/admin → auto-published)
        if (!result.error && avatarFile) {
            try {
                const { supabase } = await import('@/lib/supabase');
                const session = (await supabase.auth.getSession()).data.session;
                if (session) {
                    const fd = new FormData();
                    fd.append('file', avatarFile);
                    fd.append('linked_person', handle);
                    fd.append('title', `Ảnh - ${form.displayName.trim()}`);
                    await fetch('/api/media/upload', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session.access_token}` },
                        body: fd,
                    });
                }
            } catch {
                // Không block việc tạo thành viên nếu upload ảnh thất bại
            }
        }

        return { error: result.error || undefined, handle };
    }, [form, createdHandle, avatarFile]);

    const handleDone = useCallback((message: string) => {
        setDoneMessage(message);
        setStep('done');
        onSuccess?.();
        // Refresh families list for next use
        fetchFamiliesForSelect().then(setFamilies);
    }, [onSuccess]);

    const handleAddAnother = useCallback(() => {
        resetAll();
    }, [resetAll]);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Thêm thành viên mới
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'info' && 'Nhập thông tin cơ bản của thành viên mới'}
                        {step === 'relation' && 'Thiết lập mối quan hệ trong cây gia phả'}
                        {step === 'done' && 'Thành viên đã được thêm vào gia phả'}
                    </DialogDescription>
                </DialogHeader>

                {loadingOptions && step === 'relation' && (
                    <div className="flex justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}

                <StepIndicator step={step} />

                {createError && (
                    <div className="flex items-center gap-2 p-3 mb-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <X className="h-4 w-4 shrink-0" />
                        {createError}
                    </div>
                )}

                {step === 'info' && (
                    <StepInfo
                        form={form}
                        onChange={handleFormChange}
                        onNext={handleNext}
                        loading={creating}
                        avatarPreview={avatarPreview}
                        onPhotoChange={handlePhotoChange}
                        familyOptions={families}
                        preselectedParentFamily={preselectedParentFamily}
                        onPreselectedFamilyChange={setPreselectedParentFamily}
                    />
                )}

                {step === 'relation' && (
                    <StepRelation
                        personHandle={createdHandle}
                        personName={form.displayName}
                        personGeneration={form.generation}
                        families={families}
                        people={people}
                        onCreatePerson={handleCreatePerson}
                        onDone={handleDone}
                        onBack={() => setStep('info')}
                        preselectedFamily={preselectedParentFamily || undefined}
                    />
                )}

                {step === 'done' && (
                    <StepDone
                        message={doneMessage}
                        personHandle={createdHandle}
                        onAddAnother={handleAddAnother}
                        onClose={handleClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
