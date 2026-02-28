'use client';

import { useEffect, useState } from 'react';
import { Settings2, Loader2, Image, CheckCircle, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// ── Feature flags (bật/tắt) ─────────────────────────────────
interface FeatureFlag {
    key: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

const FEATURE_FLAGS: FeatureFlag[] = [
    {
        key: 'feature_media_enabled',
        label: 'Thư viện hình ảnh & tài liệu',
        description: 'Cho phép thành viên xem và tải lên ảnh, tài liệu. Khi tắt, mục "Thư viện" ẩn khỏi menu.',
        icon: Image,
    },
];

// ── Số settings (number input) ───────────────────────────────
interface NumberSetting {
    key: string;
    label: string;
    description: string;
    icon: React.ElementType;
    min: number;
    max: number;
    unit: string;
    defaultValue: string;
}

const NUMBER_SETTINGS: NumberSetting[] = [
    {
        key: 'media_upload_limit',
        label: 'Giới hạn upload mỗi thành viên',
        description: 'Số file tối đa (PENDING + PUBLISHED) mỗi thành viên được tải lên. Admin & Editor không bị giới hạn.',
        icon: Upload,
        min: 1,
        max: 100,
        unit: 'file / thành viên',
        defaultValue: '5',
    },
    {
        key: 'media_max_image_size_mb',
        label: 'Kích thước ảnh tối đa',
        description: 'Giới hạn dung lượng mỗi ảnh tải lên. Áp dụng cho tất cả người dùng (kể cả admin & editor).',
        icon: Image,
        min: 1,
        max: 50,
        unit: 'MB',
        defaultValue: '5',
    },
];

type SettingsMap = Record<string, string>;

export default function AdminSettingsPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [settings, setSettings] = useState<SettingsMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    // Local draft cho number inputs
    const [drafts, setDrafts] = useState<SettingsMap>({});

    useEffect(() => {
        if (!isAdmin) router.replace('/');
    }, [isAdmin, router]);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('app_settings').select('key, value');
            if (data) {
                const map: SettingsMap = {};
                data.forEach((r) => { map[r.key] = r.value; });
                setSettings(map);
                setDrafts(map);
            }
            setLoading(false);
        }
        load();
    }, []);

    // Lưu setting vào DB
    const saveSetting = async (key: string, value: string) => {
        setSaving(key);
        setSaved(null);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value, updated_by: user?.id }, { onConflict: 'key' });
        setSaving(null);
        if (!error) {
            setSettings((prev) => ({ ...prev, [key]: value }));
            setSaved(key);
            setTimeout(() => setSaved(null), 2000);
        }
    };

    // Toggle switch
    const handleToggle = async (key: string, checked: boolean) => {
        setSettings((prev) => ({ ...prev, [key]: checked ? 'true' : 'false' }));
        await saveSetting(key, checked ? 'true' : 'false');
    };

    // Lưu number setting
    const handleNumberSave = async (key: string) => {
        const setting = NUMBER_SETTINGS.find((s) => s.key === key)!;
        const val = parseInt(drafts[key] ?? setting.defaultValue, 10);
        const clamped = Math.max(setting.min, Math.min(setting.max, isNaN(val) ? setting.min : val));
        setDrafts((prev) => ({ ...prev, [key]: String(clamped) }));
        await saveSetting(key, String(clamped));
    };

    if (!isAdmin) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Settings2 className="h-6 w-6" />
                    Cài đặt hệ thống
                </h1>
                <p className="text-muted-foreground">
                    Thay đổi có hiệu lực ngay lập tức với tất cả người dùng.
                </p>
            </div>

            {/* Feature toggles */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Tính năng</CardTitle>
                    <CardDescription>
                        Khi tắt, mục menu ẩn ngay với tất cả thành viên (không cần refresh).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                        </div>
                    ) : (
                        FEATURE_FLAGS.map((feature) => {
                            const Icon = feature.icon;
                            const isEnabled = settings[feature.key] !== 'false';
                            const isSaving = saving === feature.key;
                            const isSaved = saved === feature.key;
                            return (
                                <div key={feature.key} className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className={`mt-0.5 rounded-md p-1.5 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{feature.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                        {isSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={(c) => handleToggle(feature.key, c)}
                                            disabled={isSaving}
                                            aria-label={`Bật/tắt ${feature.label}`}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Number settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Giới hạn & Quota</CardTitle>
                    <CardDescription>Cấu hình các ngưỡng cho phép.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                        </div>
                    ) : (
                        NUMBER_SETTINGS.map((setting) => {
                            const Icon = setting.icon;
                            const isSaving = saving === setting.key;
                            const isSaved = saved === setting.key;
                            const isDirty = drafts[setting.key] !== settings[setting.key];
                            return (
                                <div key={setting.key} className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="mt-0.5 rounded-md p-1.5 bg-primary/10 text-primary">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{setting.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{setting.description}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <Input
                                                    type="number"
                                                    min={setting.min}
                                                    max={setting.max}
                                                    value={drafts[setting.key] ?? setting.defaultValue}
                                                    onChange={(e) => setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                                                    className="w-24 h-8 text-sm"
                                                    disabled={isSaving}
                                                />
                                                <span className="text-xs text-muted-foreground">{setting.unit}</span>
                                                {isDirty && (
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => handleNumberSave(setting.key)}
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                        Lưu
                                                    </Button>
                                                )}
                                                {isSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
                * Thay đổi được lưu ngay vào cơ sở dữ liệu. Các thiết bị khác cập nhật tự động qua Realtime.
            </p>
        </div>
    );
}
