'use client';

import { useState } from 'react';
import { Pencil, Send } from 'lucide-react';
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
import type { PersonDetail } from '@/lib/genealogy-types';

interface FieldDef {
    label: string;
    dbColumn: string;
    type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'boolean';
    getValue: (p: PersonDetail) => string;
}

const EDITABLE_FIELDS: FieldDef[] = [
    { label: 'Họ và tên',       dbColumn: 'display_name',    type: 'text',     getValue: p => p.displayName || '' },
    { label: 'Họ',              dbColumn: 'surname',         type: 'text',     getValue: p => p.surname || '' },
    { label: 'Tên',             dbColumn: 'first_name',      type: 'text',     getValue: p => p.firstName || '' },
    { label: 'Biệt danh',       dbColumn: 'nick_name',       type: 'text',     getValue: p => p.nickName || '' },
    { label: 'Ngày sinh',        dbColumn: 'birth_date',      type: 'date',     getValue: p => p.birthDate || '' },
    { label: 'Ngày mất',         dbColumn: 'death_date',      type: 'date',     getValue: p => p.deathDate || '' },
    { label: 'Còn sống',        dbColumn: 'is_living',       type: 'boolean',  getValue: p => p.isLiving ? 'true' : 'false' },
    { label: 'Nghề nghiệp',     dbColumn: 'occupation',      type: 'text',     getValue: p => p.occupation || '' },
    { label: 'Công ty',         dbColumn: 'company',         type: 'text',     getValue: p => p.company || '' },
    { label: 'Học vấn',         dbColumn: 'education',       type: 'text',     getValue: p => p.education || '' },
    { label: 'Số điện thoại',   dbColumn: 'phone',           type: 'text',     getValue: p => p.phone || '' },
    { label: 'Email',           dbColumn: 'email',           type: 'email',    getValue: p => p.email || '' },
    { label: 'Zalo',            dbColumn: 'zalo',            type: 'text',     getValue: p => p.zalo || '' },
    { label: 'Facebook',        dbColumn: 'facebook',        type: 'text',     getValue: p => p.facebook || '' },
    { label: 'Quê quán',        dbColumn: 'hometown',        type: 'text',     getValue: p => p.hometown || '' },
    { label: 'Địa chỉ hiện tại',dbColumn: 'current_address', type: 'text',    getValue: p => p.currentAddress || '' },
    { label: 'Tiểu sử',         dbColumn: 'biography',       type: 'textarea', getValue: p => p.biography || '' },
    { label: 'Ghi chú',         dbColumn: 'notes',           type: 'textarea', getValue: p => p.notes || '' },
];

interface Props {
    person: PersonDetail;
}

export function ContributeEditPersonDialog({ person }: Props) {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const [selectedColumn, setSelectedColumn] = useState(EDITABLE_FIELDS[0].dbColumn);
    const [newValue, setNewValue] = useState('');
    const [note, setNote] = useState('');

    const selectedField = EDITABLE_FIELDS.find(f => f.dbColumn === selectedColumn) ?? EDITABLE_FIELDS[0];
    const currentValue = selectedField.getValue(person);

    const reset = () => {
        setSelectedColumn(EDITABLE_FIELDS[0].dbColumn);
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
        if (!newValue.trim() && selectedField.type !== 'boolean') {
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
                    <Pencil className="mr-2 h-4 w-4" />
                    Đề xuất chỉnh sửa
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-blue-500" />
                        Đề xuất chỉnh sửa thông tin
                    </DialogTitle>
                </DialogHeader>

                {sent ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Đã gửi đề xuất!</p>
                        <p className="text-xs text-muted-foreground">
                            Quản trị viên / biên tập viên sẽ xem xét và cập nhật thông tin.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }}>Đóng</Button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            <span className="text-xs text-muted-foreground">Thành viên:</span>{' '}
                            <strong>{person.displayName}</strong>
                        </div>

                        {/* Field selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Trường cần sửa *</label>
                            <select
                                value={selectedColumn}
                                onChange={e => handleFieldChange(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                            >
                                {EDITABLE_FIELDS.map(f => (
                                    <option key={f.dbColumn} value={f.dbColumn}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Current value (read-only) */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Giá trị hiện tại</label>
                            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground min-h-[36px]">
                                {selectedField.type === 'boolean'
                                    ? (currentValue === 'true' ? 'Còn sống' : 'Đã mất')
                                    : (currentValue || <span className="italic">(chưa có)</span>)
                                }
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
                            ) : selectedField.type === 'boolean' ? (
                                <select
                                    value={newValue || currentValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                                >
                                    <option value="true">Còn sống</option>
                                    <option value="false">Đã mất</option>
                                </select>
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
                            <label className="text-xs font-medium text-muted-foreground">Ghi chú / lý do (tuỳ chọn)</label>
                            <Input
                                placeholder="VD: Cập nhật địa chỉ mới nhất"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                        <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                            📋 Đề xuất này sẽ được xem xét. Sau khi duyệt, thông tin sẽ được cập nhật tự động.
                        </p>

                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || (selectedField.type !== 'boolean' && !newValue.trim())}
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
