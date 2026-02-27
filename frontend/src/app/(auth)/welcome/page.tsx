'use client';

import { useRouter } from 'next/navigation';
import {
    TreePine,
    Users,
    BookOpen,
    Image,
    CalendarDays,
    Shield,
    LogIn,
    UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const benefits = [
    { icon: TreePine, title: 'Cây gia phả trực quan', desc: 'Xem toàn bộ cây phả hệ qua nhiều thế hệ một cách sinh động' },
    { icon: BookOpen, title: 'Sách gia phả điện tử', desc: 'Tra cứu và lưu giữ thông tin từng thành viên trong dòng họ' },
    { icon: Users, title: 'Thư mục liên lạc', desc: 'Kết nối và liên hệ với anh chị em trong gia tộc dễ dàng' },
    { icon: Image, title: 'Thư viện ảnh & tư liệu', desc: 'Lưu trữ hình ảnh, tài liệu lịch sử của dòng họ' },
    { icon: CalendarDays, title: 'Sự kiện dòng họ', desc: 'Theo dõi giỗ chạp, họp mặt và các sự kiện quan trọng' },
    { icon: Shield, title: 'Bảo mật & riêng tư', desc: 'Thông tin chỉ được chia sẻ trong nội bộ thành viên gia tộc' },
];

export default function WelcomePage() {
    const router = useRouter();

    return (
        <div className="space-y-6 py-4">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-4">
                        <TreePine className="h-10 w-10 text-primary" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gia phả họ Phạm</h1>
                    <p className="text-muted-foreground mt-1">Kết nối - Lưu giữ - Truyền thừa</p>
                </div>
            </div>

            {/* Intro Card */}
            <Card className="border-0 shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">Chào mừng đến với Gia phả Điện tử</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                        Nền tảng số giúp dòng họ Phạm ghi chép, lưu giữ và kết nối các thế hệ
                        qua nhiều đời. Mọi thông tin được bảo mật, chỉ dành cho thành viên trong gia tộc.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Benefits Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {benefits.map((b) => (
                            <div key={b.title} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                                <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                                    <b.icon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{b.title}</p>
                                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <div className="space-y-3 pt-2">
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={() => router.push('/register')}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Đăng ký tham gia dòng họ
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => router.push('/login')}
                        >
                            <LogIn className="h-4 w-4 mr-2" />
                            Đã có tài khoản? Đăng nhập
                        </Button>
                    </div>

                    <p className="text-center text-xs text-muted-foreground">
                        Đăng ký tài khoản để truy cập gia phả họ Phạm.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
