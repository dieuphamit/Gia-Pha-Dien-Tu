'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    User, Mail, Save, CheckCircle2, AlertCircle,
    Phone, MapPin, Briefcase, Shield,
    Camera, Loader2, Clock, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { PersonAvatar } from '@/components/person-avatar';

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
    person_handle?: string | null;
}

interface PersonData {
    display_name: string;
    avatar_url: string | null;
    gender: number;
    is_living: boolean;
    is_patrilineal: boolean;
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    editor: 'Biên tập viên',
    member: 'Thành viên',
};

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    member: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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

    // Family tree photo section
    const [personData, setPersonData] = useState<PersonData | null>(null);
    const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [photoSuccess, setPhotoSuccess] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Redirect nếu chưa đăng nhập
    useEffect(() => {
        if (!loading && !isLoggedIn) router.replace('/login');
    }, [loading, isLoggedIn, router]);

    // Điền form từ profile hiện có
    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setPhone(profile.phone || '');
            setAddress(profile.address || '');
            setOccupation(profile.occupation || '');
        }
    }, [profile]);

    // Fetch dữ liệu người trong cây gia phả khi profile.person_handle được set
    useEffect(() => {
        if (!profile?.person_handle) return;

        const handle = profile.person_handle;

        async function fetchPersonData() {
            const { data } = await supabase
                .from('people')
                .select('display_name, avatar_url, gender, is_living, is_patrilineal')
                .eq('handle', handle)
                .maybeSingle();
            if (data) setPersonData(data as PersonData);
        }

        async function fetchPendingCount() {
            if (!profile?.id) return;
            const { count } = await supabase
                .from('media')
                .select('id', { count: 'exact', head: true })
                .eq('linked_person', handle)
                .eq('uploader_id', profile.id)
                .eq('state', 'PENDING');
            setPendingPhotoCount(count ?? 0);
        }

        fetchPersonData();
        fetchPendingCount();
    }, [profile?.person_handle, profile?.id]);

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

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.person_handle || !profile?.id) return;

        // Reset input để cho phép chọn lại cùng file
        e.target.value = '';

        if (file.size > MAX_IMAGE_SIZE) {
            setPhotoError('Ảnh quá lớn. Giới hạn 5MB.');
            return;
        }

        setUploadingPhoto(true);
        setPhotoError(null);
        setPhotoSuccess(false);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setPhotoError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('linked_person', profile.person_handle);

            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });

            const result = await res.json();
            if (!res.ok) {
                setPhotoError(result.error || 'Upload thất bại.');
                return;
            }

            // Cập nhật số ảnh đang chờ
            setPendingPhotoCount(prev => prev + 1);
            setPhotoSuccess(true);
            setTimeout(() => setPhotoSuccess(false), 4000);
        } catch {
            setPhotoError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setUploadingPhoto(false);
        }
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

            {/* Family Tree Photo Card — chỉ hiển thị khi person_handle được link */}
            {profile.person_handle && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Ảnh gia phả</CardTitle>
                        <CardDescription>
                            Đề xuất ảnh cho hồ sơ của bạn trong cây gia phả. Ảnh sẽ hiển thị sau khi được admin duyệt.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            {personData ? (
                                <PersonAvatar
                                    avatarUrl={personData.avatar_url}
                                    displayName={personData.display_name}
                                    gender={personData.gender}
                                    isPatrilineal={personData.is_patrilineal}
                                    isLiving={personData.is_living}
                                    size="lg"
                                />
                            ) : (
                                <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
                            )}

                            <div className="flex-1 min-w-0 space-y-2">
                                {personData && (
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm">{personData.display_name}</p>
                                        <Link
                                            href={`/people/${profile.person_handle}`}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                            title="Xem hồ sơ"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Link>
                                    </div>
                                )}

                                {pendingPhotoCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                        {pendingPhotoCount === 1
                                            ? 'Có 1 ảnh đang chờ admin duyệt'
                                            : `Có ${pendingPhotoCount} ảnh đang chờ admin duyệt`
                                        }
                                    </div>
                                )}

                                {photoError && (
                                    <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        {photoError}
                                    </div>
                                )}

                                {photoSuccess && (
                                    <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-md px-2.5 py-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                        Đã gửi ảnh! Admin sẽ duyệt sớm.
                                    </div>
                                )}

                                <input
                                    ref={photoInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    onChange={handlePhotoSelect}
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={uploadingPhoto}
                                >
                                    {uploadingPhoto ? (
                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Camera className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Đề xuất ảnh mới
                                </Button>
                            </div>
                        </div>

                        <p className="mt-3 text-xs text-muted-foreground">
                            * Ảnh sẽ hiển thị trên cây gia phả, sách gia phả và trang thành viên sau khi được admin phê duyệt. Tối đa 5MB mỗi ảnh.
                        </p>
                    </CardContent>
                </Card>
            )}

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
