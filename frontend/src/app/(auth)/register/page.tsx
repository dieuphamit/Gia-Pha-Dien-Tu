'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TreePine, Eye, EyeOff, Camera, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

const registerSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    displayName: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(100),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterContent() {
    const searchParams = useSearchParams();
    const inviteCode = searchParams.get('code') || '';
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarSelect = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) { setError('Ảnh quá lớn. Giới hạn 5MB.'); return; }
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onload = e => setAvatarPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

    const onSubmit = async (data: RegisterForm) => {
        try {
            setError('');
            setLoading(true);

            let role = 'member';

            // Validate invite code if provided
            if (inviteCode) {
                const { data: invite, error: inviteErr } = await supabase
                    .from('invite_links')
                    .select('*')
                    .eq('code', inviteCode)
                    .single();

                if (inviteErr || !invite) {
                    setError('Mã mời không hợp lệ hoặc đã hết hạn');
                    return;
                }

                if (invite.max_uses && invite.used_count >= invite.max_uses) {
                    setError('Mã mời đã hết lượt sử dụng');
                    return;
                }

                role = invite.role || 'member';

                await supabase
                    .from('invite_links')
                    .update({ used_count: (invite.used_count || 0) + 1 })
                    .eq('id', invite.id);
            }

            // Sign up via Supabase Auth
            const { data: authData, error: authErr } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        display_name: data.displayName,
                        invite_code: inviteCode,
                    },
                },
            });

            if (authErr) {
                setError(authErr.message);
                return;
            }

            // Create profile
            if (authData.user) {
                await supabase.from('profiles').upsert({
                    id: authData.user.id,
                    email: data.email,
                    display_name: data.displayName,
                    role,
                    status: 'pending',
                });

                // Upload avatar if provided (graceful — does not block registration)
                if (avatarFile) {
                    try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (token) {
                            // Upload to Supabase Storage directly as profile avatar
                            const ext = avatarFile.name.split('.').pop() || 'jpg';
                            const filePath = `avatars/${authData.user.id}/avatar.${ext}`;
                            const { data: storageData } = await supabase.storage
                                .from('media')
                                .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });
                            if (storageData) {
                                const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);
                                if (urlData.publicUrl) {
                                    await supabase.from('profiles')
                                        .update({ avatar_url: urlData.publicUrl })
                                        .eq('id', authData.user.id);
                                }
                            }
                        }
                    } catch {
                        // Avatar upload failure should not block registration
                    }
                }
            }

            // Sign out immediately — user must wait for admin approval
            await supabase.auth.signOut();
            setSuccess(true);
        } catch (err: unknown) {
            setError('Đăng ký thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Card className="border-0 shadow-2xl">
                <CardContent className="pt-8 pb-8 text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-green-100 p-4">
                            <TreePine className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-xl font-bold text-green-700">Đăng ký thành công!</CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Tài khoản của bạn đã được tạo và đang <strong>chờ quản trị viên xét duyệt</strong>.
                        <br />
                        Bạn sẽ nhận được thông báo khi tài khoản được phê duyệt.
                    </p>
                    <a href="/login" className="inline-block text-sm text-primary hover:underline">
                        Quay về đăng nhập
                    </a>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                        <TreePine className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Tham gia Gia phả họ Phạm</CardTitle>
                <CardDescription>Đăng ký tham gia nền tảng gia phả dòng họ</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                    {error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                    )}

                    {/* Avatar upload */}
                    <div className="flex flex-col items-center gap-2">
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarSelect(f); e.target.value = ''; }}
                        />
                        <div className="relative group">
                            {avatarPreview ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={avatarPreview}
                                        alt="Avatar preview"
                                        className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 cursor-pointer"
                                        onClick={() => avatarInputRef.current?.click()}
                                    />
                                    <button
                                        type="button"
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                                        onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:bg-muted/80 transition-colors cursor-pointer"
                                >
                                    <Camera className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">Ảnh đại diện</span>
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Tuỳ chọn</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="displayName">Tên hiển thị</label>
                        <Input id="displayName" placeholder="Nguyễn Văn A" {...register('displayName')} />
                        {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <Input id="email" type="email" placeholder="email@example.com" {...register('email')} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Tối thiểu 8 ký tự"
                                {...register('password')}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Nhập lại mật khẩu"
                            {...register('confirmPassword')}
                        />
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <RegisterContent />
        </Suspense>
    );
}
