'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    User, Mail, Save, CheckCircle2, AlertCircle,
    Phone, MapPin, Briefcase, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

// Kiểu mở rộng — bao gồm các cột DB mà auth-provider chưa khai báo
interface ExtendedProfile {
    id: string;
    email: string;
    display_name: string | null;
    role: string | null;
    created_at: string | null;
    phone?: string | null;
    address?: string | null;
    occupation?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    editor: 'Biên tập viên',
    member: 'Thành viên',
    viewer: 'Khách',
};

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    member: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function ProfilePage() {
    const { profile: rawProfile, refreshProfile, loading, isLoggedIn } = useAuth();
    const profile = rawProfile as unknown as ExtendedProfile | null;
    const router = useRouter();

    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [occupation, setOccupation] = useState('');

    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Redirect nếu chưa đăng nhập
    useEffect(() => {
        if (!loading && !isLoggedIn) router.replace('/login');
    }, [loading, isLoggedIn, router]);

    // Điền form từ profile hiện có
    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            // Các trường mở rộng
            setPhone(profile.phone || '');
            setAddress(profile.address || '');
            setOccupation(profile.occupation || '');
        }
    }, [profile]);

    const handleSave = async () => {
        if (!profile) return;
        if (displayName.trim().length < 2) {
            setError('Tên hiển thị phải có ít nhất 2 ký tự');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                display_name: displayName.trim(),
                phone: phone.trim() || null,
                address: address.trim() || null,
                occupation: occupation.trim() || null,
            })
            .eq('id', profile.id);

        if (updateError) {
            setError(`Lỗi cập nhật: ${updateError.message}`);
        } else {
            await refreshProfile();
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!profile) return null;

    const role = profile.role || 'viewer';
    const joinDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('vi-VN', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '—';

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <User className="h-6 w-6" />
                    Hồ sơ cá nhân
                </h1>
                <p className="text-muted-foreground">Cập nhật thông tin của bạn</p>
            </div>

            {/* Account Info Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Thông tin tài khoản</CardTitle>
                    <CardDescription>Thông tin này được quản lý bởi hệ thống</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-24 shrink-0">Email</span>
                        <span className="font-medium">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-24 shrink-0">Quyền</span>
                        <Badge
                            variant="secondary"
                            className={ROLE_COLORS[role] || ROLE_COLORS.viewer}
                        >
                            {ROLE_LABELS[role] || role}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-24 shrink-0">Ngày tham gia</span>
                        <span>{joinDate}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Profile Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
                    <CardDescription>Chỉnh sửa tên và thông tin liên hệ của bạn</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Avatar placeholder */}
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary select-none">
                            {displayName
                                ? displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                                : profile.email.slice(0, 2).toUpperCase()
                            }
                        </div>
                        <div>
                            <p className="font-semibold">{displayName || profile.email.split('@')[0]}</p>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="displayName" className="text-sm font-medium">
                            Tên hiển thị <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="displayName"
                                placeholder="Nguyễn Văn A"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tên này sẽ hiển thị trong bình luận, bài đăng và danh sách thành viên
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="phone" className="text-sm font-medium">Số điện thoại</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="phone"
                                placeholder="0901 234 567"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="occupation" className="text-sm font-medium">Nghề nghiệp</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="occupation"
                                placeholder="Kỹ sư phần mềm, Giáo viên, ..."
                                value={occupation}
                                onChange={e => setOccupation(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="address" className="text-sm font-medium">Địa chỉ hiện tại</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="address"
                                placeholder="TP. Hồ Chí Minh"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Feedback messages */}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Đã lưu thành công!
                        </div>
                    )}

                    <Button
                        className="w-full"
                        onClick={handleSave}
                        disabled={saving || displayName.trim().length < 2}
                    >
                        {saving ? (
                            <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-primary-foreground" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Lưu thay đổi
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Change Password hint */}
            <Card className="border-dashed">
                <CardContent className="py-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Đổi mật khẩu</p>
                        <p className="text-xs text-muted-foreground">Nhận email reset mật khẩu</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/forgot-password')}
                    >
                        Đổi mật khẩu
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
