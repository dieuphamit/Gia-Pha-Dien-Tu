'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    UserPlus, ArrowRight, ArrowLeft, Check,
    Users, GitMerge, SkipForward, Loader2, X,
} from 'lucide-react';
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
    birthYear: string;
    deathYear: string;
    isLiving: boolean;
    occupation: string;
    currentAddress: string;
    phone: string;
    email: string;
}

const INITIAL_FORM: FormData = {
    displayName: '',
    gender: 1,
    generation: 3,
    birthYear: '',
    deathYear: '',
    isLiving: true,
    occupation: '',
    currentAddress: '',
    phone: '',
    email: '',
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
}: {
    form: FormData;
    onChange: (f: Partial<FormData>) => void;
    onNext: () => void;
    loading: boolean;
}) {
    const isValid = form.displayName.trim().length >= 2;

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
                    <label className="text-sm font-medium">Đời thứ</label>
                    <Input
                        id="member-generation"
                        type="number"
                        min={1}
                        max={10}
                        value={form.generation}
                        onChange={e => onChange({ generation: parseInt(e.target.value) || 1 })}
                    />
                </div>
            </div>

            {/* Năm sinh / mất */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Năm sinh</label>
                    <Input
                        id="member-birth-year"
                        type="number"
                        placeholder="Vd: 1990"
                        min={1800}
                        max={new Date().getFullYear()}
                        value={form.birthYear}
                        onChange={e => onChange({ birthYear: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Năm mất</label>
                    <Input
                        id="member-death-year"
                        type="number"
                        placeholder="Để trống nếu còn sống"
                        min={1800}
                        max={new Date().getFullYear()}
                        value={form.deathYear}
                        onChange={e => {
                            const val = e.target.value;
                            onChange({ deathYear: val, isLiving: !val });
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
    onDone,
    onBack,
}: {
    personHandle: string;
    personName: string;
    personGeneration: number;
    families: FamilyOption[];
    people: PersonOption[];
    onDone: (message: string) => void;
    onBack: () => void;
}) {
    const [mode, setMode] = useState<RelationMode>(null);
    const [selectedFamily, setSelectedFamily] = useState('');
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
                const r = await addPersonAsChild(personHandle, selectedFamily);
                if (r.error) { setError(r.error); setLoading(false); return; }
                onDone(`✅ Đã thêm ${personName} làm con trong gia đình ${selectedFamily}`);

            } else if (mode === 'spouse') {
                if (!selectedFamily) { setError('Vui lòng chọn gia đình'); setLoading(false); return; }
                const r = await addPersonAsSpouse(personHandle, selectedFamily, spouseRole);
                if (r.error) { setError(r.error); setLoading(false); return; }
                onDone(`✅ Đã thêm ${personName} làm ${spouseRole === 'father' ? 'cha' : 'mẹ'} trong gia đình ${selectedFamily}`);

            } else if (mode === 'new-family') {
                const newFH = await generateFamilyHandle();
                const r = await addFamily({
                    handle: newFH,
                    fatherHandle: newFatherHandle || undefined,
                    motherHandle: newMotherHandle || undefined,
                });
                if (r.error) { setError(r.error); setLoading(false); return; }

                // Nếu personHandle là cha hoặc mẹ trong gia đình mới
                const isParent = newFatherHandle === personHandle || newMotherHandle === personHandle;
                if (isParent) {
                    const role = newFatherHandle === personHandle ? 'father' : 'mother';
                    await addPersonAsSpouse(personHandle, newFH, role);
                }
                onDone(`✅ Đã tạo gia đình mới ${newFH} và liên kết ${personName}`);

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
            title: 'Cha / Mẹ trong gia đình',
            desc: 'Thêm người này làm cha hoặc mẹ trong gia đình đã có',
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
                <span className="text-xs text-muted-foreground ml-auto">đã được tạo ✓</span>
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
                        <label className="text-sm font-medium">Chọn gia đình:</label>
                        <select
                            id="relation-family-spouse"
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
                </div>
            )}

            {mode === 'new-family' && (
                <div className="space-y-3 p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <p className="text-xs text-muted-foreground">
                        Người vừa tạo (<strong>{personHandle}</strong>) sẽ được tự động gán vào gia đình mới này.
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
    }, []);

    const handleClose = useCallback(() => {
        onOpenChange(false);
        setTimeout(resetAll, 300); // reset sau khi dialog đóng animation xong
    }, [onOpenChange, resetAll]);

    const handleFormChange = useCallback((partial: Partial<FormData>) => {
        setForm(prev => ({ ...prev, ...partial }));
    }, []);

    // Step 1 → 2: tạo person trước
    const handleNext = useCallback(async () => {
        setCreating(true);
        setCreateError(null);
        try {
            const handle = await generatePersonHandle();
            const result = await addPerson({
                handle,
                displayName: form.displayName.trim(),
                gender: form.gender,
                generation: form.generation,
                birthYear: form.birthYear ? parseInt(form.birthYear) : null,
                deathYear: form.deathYear ? parseInt(form.deathYear) : null,
                isLiving: form.isLiving,
                families: [],
                parentFamilies: [],
            });
            if (result.error) {
                setCreateError(result.error);
                return;
            }
            setCreatedHandle(handle);
            setStep('relation');
            // Refresh people list
            fetchPeopleForSelect().then(setPeople);
        } catch (e: unknown) {
            setCreateError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setCreating(false);
        }
    }, [form]);

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
                    />
                )}

                {step === 'relation' && (
                    <StepRelation
                        personHandle={createdHandle}
                        personName={form.displayName}
                        personGeneration={form.generation}
                        families={families}
                        people={people}
                        onDone={handleDone}
                        onBack={() => setStep('info')}
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
