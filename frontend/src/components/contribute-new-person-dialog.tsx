'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Send, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { submitContribution, fetchPeopleForSelect, fetchFamiliesForSelect } from '@/lib/supabase-data';

interface NewPersonPayload {
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    occupation?: string;
    currentAddress?: string;
    phone?: string;
    email?: string;
    relationHint?: string;
    parentFamilyHandle?: string;
    childrenHandles?: string[];
    spouseHandle?: string;
}

export function ContributeNewPersonDialog() {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const [displayName, setDisplayName] = useState('');
    const [gender, setGender] = useState(1);
    const [generation, setGeneration] = useState<number | ''>('');
    const [birthYear, setBirthYear] = useState('');
    const [deathYear, setDeathYear] = useState('');
    const [isLiving, setIsLiving] = useState(true);
    const [occupation, setOccupation] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [relationHint, setRelationHint] = useState('');
    const [peopleOptions, setPeopleOptions] = useState<Array<{ handle: string; displayName: string; generation: number; gender: number; }>>([]);
    const [familyOptions, setFamilyOptions] = useState<Array<{ handle: string; fatherName?: string; motherName?: string; label: string; }>>([]);
    const [parentFamilyHandle, setParentFamilyHandle] = useState('');
    const [childrenHandles, setChildrenHandles] = useState<string[]>([]);
    const [spouseHandle, setSpouseHandle] = useState('');

    useEffect(() => {
        if (open) {
            fetchPeopleForSelect().then(setPeopleOptions);
            fetchFamiliesForSelect().then(setFamilyOptions);
        }
    }, [open]);

    const reset = () => {
        setDisplayName(''); setGender(1); setGeneration('');
        setBirthYear(''); setDeathYear(''); setIsLiving(true);
        setOccupation(''); setAddress(''); setPhone('');
        setEmail(''); setRelationHint(''); setError(''); setSent(false);
        setParentFamilyHandle(''); setChildrenHandles([]); setSpouseHandle('');
    };

    const handleSubmit = async () => {
        if (!displayName.trim()) { setError('Vui lòng nhập họ tên'); return; }
        if (!generation) { setError('Vui lòng nhập đời thứ'); return; }
        if (!parentFamilyHandle) { setError('Vui lòng chọn gia đình cha/mẹ'); return; }
        if (!user) { setError('Bạn cần đăng nhập'); return; }

        setSubmitting(true);
        setError('');

        const payload: NewPersonPayload = {
            displayName: displayName.trim(),
            gender,
            generation: Number(generation),
            birthYear: birthYear ? Number(birthYear) : undefined,
            deathYear: deathYear ? Number(deathYear) : undefined,
            isLiving,
            occupation: occupation.trim() || undefined,
            currentAddress: address.trim() || undefined,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            relationHint: relationHint.trim() || undefined,
            parentFamilyHandle,
            childrenHandles: childrenHandles.length > 0 ? childrenHandles : undefined,
            spouseHandle: spouseHandle || undefined,
        };

        const parentFamilyLabel = familyOptions.find(f => f.handle === parentFamilyHandle)?.label || '';
        const spouseName = spouseHandle ? peopleOptions.find(p => p.handle === spouseHandle)?.displayName : '';
        const childrenNames = childrenHandles.map(h => peopleOptions.find(p => p.handle === h)?.displayName).filter(Boolean).join(', ');
        const autoRelationHint = `Gia đình cha/mẹ: ${parentFamilyLabel}` +
            (spouseName ? `\nVợ/Chồng: ${spouseName}` : '') +
            (childrenNames ? `\nCon cái: ${childrenNames}` : '');
        const finalNote = relationHint.trim() ? `${autoRelationHint}\nChú thích thêm: ${relationHint.trim()}` : autoRelationHint;

        const { error: submitError } = await submitContribution({
            authorId: user.id,
            authorEmail: profile?.email || user.email || '',
            fieldName: 'add_person',
            fieldLabel: 'Thêm thành viên mới',
            newValue: JSON.stringify(payload),
            personName: displayName.trim(),
            note: finalNote,
        });

        setSubmitting(false);
        if (submitError) { setError(submitError); } else { setSent(true); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Đề xuất thêm thành viên
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-blue-500" />
                        Đề xuất thêm thành viên
                    </DialogTitle>
                </DialogHeader>

                {sent ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Đã gửi đề xuất!</p>
                        <p className="text-xs text-muted-foreground">
                            Quản trị viên / biên tập viên sẽ xem xét và thêm vào gia phả.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }}>Đóng</Button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Họ và tên *</label>
                            <Input
                                placeholder="VD: Phạm Văn A"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Giới tính</label>
                                <select
                                    value={gender}
                                    onChange={e => setGender(Number(e.target.value))}
                                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                                >
                                    <option value={1}>Nam</option>
                                    <option value={2}>Nữ</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Đời thứ *</label>
                                <Input
                                    type="number"
                                    placeholder="VD: 5"
                                    value={generation}
                                    onChange={e => setGeneration(e.target.value ? Number(e.target.value) : '')}
                                    min={1}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Năm sinh</label>
                                <Input
                                    type="number"
                                    placeholder="VD: 1980"
                                    value={birthYear}
                                    onChange={e => setBirthYear(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Năm mất</label>
                                <Input
                                    type="number"
                                    placeholder="(nếu đã mất)"
                                    value={deathYear}
                                    onChange={e => setDeathYear(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isLiving"
                                checked={isLiving}
                                onChange={e => setIsLiving(e.target.checked)}
                                className="rounded"
                            />
                            <label htmlFor="isLiving" className="text-sm">Còn sống</label>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nghề nghiệp</label>
                            <Input placeholder="VD: Giáo viên" value={occupation} onChange={e => setOccupation(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Địa chỉ</label>
                            <Input placeholder="VD: Hà Nội" value={address} onChange={e => setAddress(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Số điện thoại</label>
                                <Input placeholder="0901234567" value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Email</label>
                                <Input type="email" placeholder="email@..." value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Gia đình cha/mẹ (Bắt buộc) *</label>
                            <select
                                value={parentFamilyHandle}
                                onChange={e => setParentFamilyHandle(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                            >
                                <option value="">-- Chọn gia đình cha/mẹ --</option>
                                {familyOptions.map(f => (
                                    <option key={f.handle} value={f.handle}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Con cái (Tùy chọn - Nhấn Ctrl/Cmd để chọn nhiều)</label>
                            <select
                                multiple
                                value={childrenHandles}
                                onChange={e => {
                                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                                    setChildrenHandles(selected);
                                }}
                                className="w-full rounded-md border px-3 py-2 text-sm bg-background h-24"
                            >
                                {peopleOptions.map(p => (
                                    <option key={p.handle} value={p.handle}>
                                        {p.displayName} (Đời {p.generation}) - {p.handle}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Vợ/Chồng (Tùy chọn)</label>
                            <select
                                value={spouseHandle}
                                onChange={e => setSpouseHandle(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                            >
                                <option value="">-- Chưa có / Không chọn --</option>
                                {peopleOptions
                                    .filter(p => generation && p.generation <= Number(generation) && p.gender !== gender && p.gender !== 0 && gender !== 0)
                                    .map(p => (
                                        <option key={p.handle} value={p.handle}>
                                            {p.displayName} (Đời {p.generation}) - {p.handle}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Quan hệ trong gia phả (chú thích thêm cho reviewer)
                            </label>
                            <Input
                                placeholder="VD: Là con thứ 2, đã chuyển vào Nam năm 2000"
                                value={relationHint}
                                onChange={e => setRelationHint(e.target.value)}
                            />
                        </div>

                        <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                            📋 Đề xuất này sẽ được quản trị viên xem xét. Sau khi duyệt, thành viên sẽ được thêm vào gia phả.
                        </p>

                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || !displayName.trim() || !generation || !parentFamilyHandle}
                            >
                                {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4 mr-2" />Gửi đề xuất</>}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
