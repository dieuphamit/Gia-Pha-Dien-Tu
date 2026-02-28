'use client';

import { useState, useRef } from 'react';
import { X, Send, MessageSquarePlus, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

const CONTRIBUTION_FIELDS = [
    { key: 'birth_date', label: 'Ngày sinh', type: 'date', placeholder: '' },
    { key: 'death_date', label: 'Ngày mất', type: 'date', placeholder: '' },
    { key: 'display_name', label: 'Họ tên', type: 'text', placeholder: 'VD: Lê Văn A' },
    { key: 'biography', label: 'Tiểu sử', type: 'textarea', placeholder: 'Thông tin tiểu sử...' },
    { key: 'occupation', label: 'Nghề nghiệp', type: 'text', placeholder: 'VD: Giáo viên' },
    { key: 'address', label: 'Địa chỉ', type: 'text', placeholder: 'VD: Hà Nội' },
    { key: 'phone', label: 'Số điện thoại', type: 'text', placeholder: 'VD: 0901234567' },
    { key: 'other', label: 'Thông tin khác', type: 'textarea', placeholder: 'Bổ sung thông tin...' },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface ContributeDialogProps {
    personHandle: string;
    personName: string;
    onClose: () => void;
}

// Which tab is active: 'info' for text fields, 'photo' for image upload
type ActiveTab = 'info' | 'photo';

export function ContributeDialog({ personHandle, personName, onClose }: ContributeDialogProps) {
    const { user, profile, isLoggedIn } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('info');

    // Info contribution state
    const [selectedField, setSelectedField] = useState(CONTRIBUTION_FIELDS[0].key);
    const [newValue, setNewValue] = useState('');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    // Photo upload state
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoSent, setPhotoSent] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const photoInputRef = useRef<HTMLInputElement>(null);

    const fieldInfo = CONTRIBUTION_FIELDS.find(f => f.key === selectedField)!;

    const handleSubmit = async () => {
        if (!newValue.trim()) { setError('Vui lòng nhập thông tin'); return; }
        if (!isLoggedIn || !user) { setError('Bạn cần đăng nhập để đóng góp'); return; }

        setSending(true);
        setError('');

        const { error: insertError } = await supabase.from('contributions').insert({
            author_id: user.id,
            author_email: profile?.email || user.email || '',
            person_handle: personHandle,
            person_name: personName,
            field_name: selectedField,
            field_label: fieldInfo.label,
            old_value: null,
            new_value: newValue.trim(),
            note: note.trim() || null,
            status: 'pending',
        });

        setSending(false);

        if (insertError) {
            setError(insertError.message);
        } else {
            setSent(true);
        }
    };

    const handlePhotoSelect = (file: File) => {
        if (!file.type.startsWith('image/')) { setPhotoError('Chỉ chấp nhận file ảnh.'); return; }
        if (file.size > MAX_IMAGE_SIZE) { setPhotoError('Ảnh quá lớn. Giới hạn 5MB.'); return; }
        setPhotoError('');
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = e => setPhotoPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handlePhotoUpload = async () => {
        if (!photoFile || !isLoggedIn || !user) return;

        setPhotoUploading(true);
        setPhotoError('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setPhotoError('Phiên đăng nhập hết hạn.'); return; }

            const fd = new FormData();
            fd.append('file', photoFile);
            fd.append('linked_person', personHandle);
            fd.append('title', `Ảnh - ${personName}`);

            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: fd,
            });
            const json = await res.json();

            if (!res.ok) {
                setPhotoError(json.error || 'Tải ảnh thất bại.');
            } else {
                setPhotoSent(true);
            }
        } catch {
            setPhotoError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setPhotoUploading(false);
        }
    };

    const isSuccessState = (activeTab === 'info' && sent) || (activeTab === 'photo' && photoSent);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[420px] max-w-[95vw] animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <MessageSquarePlus className="w-5 h-5 text-blue-500" />
                        <div>
                            <h3 className="font-semibold text-sm">Đóng góp thông tin</h3>
                            <p className="text-xs text-muted-foreground">{personName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>

                {isSuccessState ? (
                    /* Success state */
                    <div className="p-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-green-700">
                            {activeTab === 'photo' ? 'Đã gửi ảnh!' : 'Đã gửi đóng góp!'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            {activeTab === 'photo'
                                ? 'Ảnh sẽ hiển thị sau khi admin duyệt.'
                                : 'Quản trị viên sẽ xem xét và phê duyệt.'}
                        </p>
                        <Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>
                    </div>
                ) : (
                    <div className="p-5 space-y-4">
                        {!isLoggedIn && (
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                                ⚠️ Bạn cần <a href="/login" className="underline font-medium">đăng nhập</a> để đóng góp thông tin.
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 rounded-lg bg-muted p-1">
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === 'info' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Thông tin
                            </button>
                            <button
                                onClick={() => setActiveTab('photo')}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'photo' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Camera className="w-3.5 h-3.5" />
                                Đề xuất ảnh
                            </button>
                        </div>

                        {/* Info tab */}
                        {activeTab === 'info' && (
                            <>
                                {error && (
                                    <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Loại thông tin</label>
                                    <select
                                        value={selectedField}
                                        onChange={e => setSelectedField(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
                                    >
                                        {CONTRIBUTION_FIELDS.map(f => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">{fieldInfo.label}</label>
                                    {fieldInfo.type === 'textarea' ? (
                                        <textarea
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            placeholder={fieldInfo.placeholder}
                                            className="w-full rounded-lg border px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
                                            rows={3}
                                        />
                                    ) : fieldInfo.type === 'date' ? (
                                        <DateInput
                                            value={newValue}
                                            onChange={setNewValue}
                                            className="w-full"
                                        />
                                    ) : (
                                        <Input
                                            type={fieldInfo.type}
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            placeholder={fieldInfo.placeholder}
                                        />
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Ghi chú (tuỳ chọn)</label>
                                    <Input
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="VD: Theo lời kể của bác Hai..."
                                    />
                                </div>

                                <Button className="w-full" disabled={sending || !isLoggedIn} onClick={handleSubmit}>
                                    {sending ? 'Đang gửi...' : <><Send className="w-4 h-4 mr-2" /> Gửi đóng góp</>}
                                </Button>
                            </>
                        )}

                        {/* Photo tab */}
                        {activeTab === 'photo' && (
                            <>
                                {photoError && (
                                    <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{photoError}</div>
                                )}

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

                                {photoPreview ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={photoPreview}
                                                alt="Preview"
                                                className="w-28 h-28 object-cover rounded-full border-4 border-muted shadow"
                                            />
                                            <button
                                                type="button"
                                                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                                                onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoError(''); }}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{photoFile?.name}</p>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        className="w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-xl py-8 text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors"
                                    >
                                        <Camera className="w-8 h-8" />
                                        <span className="text-sm font-medium">Chọn ảnh</span>
                                        <span className="text-xs">JPG, PNG, WebP, GIF — tối đa 5MB</span>
                                    </button>
                                )}

                                <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                                    Ảnh sẽ hiển thị trên cây gia phả sau khi được admin phê duyệt.
                                </p>

                                <Button
                                    className="w-full"
                                    disabled={!photoFile || photoUploading || !isLoggedIn}
                                    onClick={handlePhotoUpload}
                                >
                                    {photoUploading
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang tải ảnh...</>
                                        : <><Send className="w-4 h-4 mr-2" />Gửi đề xuất ảnh</>
                                    }
                                </Button>
                            </>
                        )}

                        <p className="text-[10px] text-center text-muted-foreground">
                            Đóng góp sẽ được quản trị viên xem xét trước khi áp dụng.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
