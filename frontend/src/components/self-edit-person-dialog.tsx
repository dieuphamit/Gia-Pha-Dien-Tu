'use client';

import { useState } from 'react';
import { UserPen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { submitContribution } from '@/lib/supabase-data';
import { MEMBER_SELF_EDITABLE_COLUMNS } from '@/lib/apply-contribution';
import type { PersonDetail } from '@/lib/genealogy-types';

interface FieldDef {
    label: string;
    dbColumn: string;
    type: 'text' | 'email' | 'textarea';
    getValue: (p: PersonDetail) => string;
}

const ALL_FIELDS: FieldDef[] = [
    { label: 'Biệt danh',           dbColumn: 'nick_name',       type: 'text',     getValue: p => p.nickName || '' },
    { label: 'Nghề nghiệp',         dbColumn: 'occupation',      type: 'text',     getValue: p => p.occupation || '' },
    { label: 'Công ty',             dbColumn: 'company',         type: 'text',     getValue: p => p.company || '' },
    { label: 'Học vấn',             dbColumn: 'education',       type: 'text',     getValue: p => p.education || '' },
    { label: 'Số điện thoại',       dbColumn: 'phone',           type: 'text',     getValue: p => p.phone || '' },
    { label: 'Email',               dbColumn: 'email',           type: 'email',    getValue: p => p.email || '' },
    { label: 'Zalo',                dbColumn: 'zalo',            type: 'text',     getValue: p => p.zalo || '' },
    { label: 'Facebook',            dbColumn: 'facebook',        type: 'text',     getValue: p => p.facebook || '' },
    { label: 'Quê quán',            dbColumn: 'hometown',        type: 'text',     getValue: p => p.hometown || '' },
    { label: 'Địa chỉ hiện tại',   dbColumn: 'current_address', type: 'text',     getValue: p => p.currentAddress || '' },
    { label: 'Tiểu sử',             dbColumn: 'biography',       type: 'textarea', getValue: p => p.biography || '' },
    { label: 'Ghi chú',             dbColumn: 'notes',           type: 'textarea', getValue: p => p.notes || '' },
];

// Only show fields that are in MEMBER_SELF_EDITABLE_COLUMNS
const SELF_EDIT_FIELDS = ALL_FIELDS.filter(f => MEMBER_SELF_EDITABLE_COLUMNS.has(f.dbColumn));

interface Props {
    person: PersonDetail;
}

export function SelfEditPersonDialog({ person }: Props) {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const [selectedColumn, setSelectedColumn] = useState(SELF_EDIT_FIELDS[0].dbColumn);
    const [newValue, setNewValue] = useState('');
    const [note, setNote] = useState('');

    const selectedField = SELF_EDIT_FIELDS.find(f => f.dbColumn === selectedColumn) ?? SELF_EDIT_FIELDS[0];
    const currentValue = selectedField.getValue(person);

    const reset = () => {
        setSelectedColumn(SELF_EDIT_FIELDS[0].dbColumn);
        setNewValue('');
        setNote('');
        setError('');
        setSent(false);
    };

    const handleFieldChange = (dbColumn: string) => {
        setSelectedColumn(dbColumn);
        setNewValue('');
        setError('');
    };

    const handleSubmit = async () => {
        if (!newValue.trim()) {
            setError('Vui lòng nhập giá trị mới');
            return;
        }
        if (newValue.trim() === currentValue.trim()) {
            setError('Giá trị mới giống với giá trị hiện tại');
            return;
        }
        if (!user) { setError('Bạn cần đăng nhập'); return; }

        setSubmitting(true);
        setError('');

        const payload = {
            dbColumn: selectedField.dbColumn,
            label: selectedField.label,
            value: newValue.trim(),
        };

        const { error: submitError } = await submitContribution({
            authorId: user.id,
            authorEmail: profile?.email || user.email || '',
            fieldName: 'edit_person_field',
            fieldLabel: selectedField.label,
            personHandle: person.handle,
            personName: person.displayName,
            oldValue: currentValue || '(trống)',
            newValue: JSON.stringify(payload),
            note: note.trim() || undefined,
        });

        setSubmitting(false);
        if (submitError) { setError(submitError); } else { setSent(true); }
    };

    return (
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <UserPen className="mr-2 h-4 w-4" />
                    Cập nhật thông tin
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPen className="h-5 w-5 text-green-600" />
                        Cập nhật thông tin cá nhân
                    </DialogTitle>
                </DialogHeader>

                {sent ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Đã gửi yêu cầu!</p>
                        <p className="text-xs text-muted-foreground">
                            Thông tin sẽ được cập nhật sau khi quản trị viên xét duyệt.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }}>Đóng</Button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                            ℹ️ Thay đổi sẽ được quản trị viên xem xét trước khi áp dụng.
                        </div>

                        {/* Field selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Thông tin cần cập nhật *</label>
                            <select
                                value={selectedColumn}
                                onChange={e => handleFieldChange(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                            >
                                {SELF_EDIT_FIELDS.map(f => (
                                    <option key={f.dbColumn} value={f.dbColumn}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Current value (read-only) */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Giá trị hiện tại</label>
                            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground min-h-[36px]">
                                {currentValue || <span className="italic">(chưa có)</span>}
                            </div>
                        </div>

                        {/* New value input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Giá trị mới *</label>
                            {selectedField.type === 'textarea' ? (
                                <Textarea
                                    placeholder={`Nhập ${selectedField.label.toLowerCase()} mới...`}
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    rows={3}
                                />
                            ) : (
                                <Input
                                    type={selectedField.type}
                                    placeholder={`Nhập ${selectedField.label.toLowerCase()} mới...`}
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                />
                            )}
                        </div>

                        {/* Note */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Ghi chú (tuỳ chọn)</label>
                            <Input
                                placeholder="VD: Đã chuyển địa chỉ mới từ tháng 5"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || !newValue.trim()}
                            >
                                {submitting ? 'Đang gửi...' : <><Send className="w-4 h-4 mr-2" />Gửi yêu cầu</>}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
