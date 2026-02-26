'use client';

import { useEffect, useRef, useState } from 'react';
import { Database, Download, Upload, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import type { BackupData, RestoreTableResult } from '@/app/api/restore/route';

// ── Hằng số bảng cần backup ───────────────────────────────────

const BACKUP_TABLES = [
    'people',
    'families',
    'profiles',
    'posts',
    'post_comments',
    'comments',
    'events',
    'event_rsvps',
    'family_questions',
    'contributions',
    'audit_logs',
] as const;

const STATS_TABLES = [
    'people', 'families', 'profiles', 'posts',
    'comments', 'events', 'contributions', 'audit_logs',
] as const;

type BackupTable = typeof BACKUP_TABLES[number];

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN');
}

function fmtCount(n: number) {
    return n.toLocaleString('vi-VN');
}

// ── Component chính ───────────────────────────────────────────

export default function BackupPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Database className="h-6 w-6" />
                    Sao lưu &amp; Khôi phục
                </h1>
                <p className="text-muted-foreground">Xuất toàn bộ dữ liệu và khôi phục từ file backup</p>
            </div>

            {/* Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Thống kê database</CardTitle>
                </CardHeader>
                <CardContent>
                    <DatabaseStats />
                </CardContent>
            </Card>

            {/* Backup */}
            <BackupSection />

            {/* Restore */}
            <RestoreSection userId={user?.id} accessToken={null} />
        </div>
    );
}

// ── DatabaseStats ─────────────────────────────────────────────

function DatabaseStats() {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const counts: Record<string, number> = {};
            await Promise.all(
                STATS_TABLES.map(async (t) => {
                    const { count } = await supabase
                        .from(t)
                        .select('*', { count: 'exact', head: true });
                    counts[t] = count ?? 0;
                })
            );
            setStats(counts);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return <div className="animate-pulse text-sm text-muted-foreground">Đang tải...</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats).map(([table, count]) => (
                <div key={table} className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{fmtCount(count)}</p>
                    <p className="text-xs text-muted-foreground">{table}</p>
                </div>
            ))}
        </div>
    );
}

// ── BackupSection ─────────────────────────────────────────────

function BackupSection() {
    const [creating, setCreating] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const createBackup = async () => {
        setCreating(true);
        setError(null);
        try {
            const result: Partial<BackupData> = {
                version: 1,
                exported_at: new Date().toISOString(),
            };

            // Fetch tất cả bảng song song
            const fetches = await Promise.all(
                BACKUP_TABLES.map(async (table) => {
                    const { data, error } = await supabase.from(table).select('*');
                    return { table, data: data ?? [], error };
                })
            );

            const errors: string[] = [];
            for (const { table, data, error } of fetches) {
                if (error) {
                    errors.push(`${table}: ${error.message}`);
                } else {
                    (result as unknown as Record<string, unknown>)[table] = data;
                }
            }

            if (errors.length > 0) {
                setError(`Một số bảng không thể export: ${errors.join('; ')}`);
            }

            // Tải file JSON
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `giapha-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setLastBackup(new Date().toISOString());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi không xác định');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Xuất Backup
                </CardTitle>
                <CardDescription>
                    Tải về file JSON chứa toàn bộ dữ liệu ({BACKUP_TABLES.length} bảng)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {BACKUP_TABLES.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                </div>
                {error && (
                    <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}
                {lastBackup && (
                    <p className="text-sm text-muted-foreground">
                        Backup gần nhất: {fmtDate(lastBackup)}
                    </p>
                )}
                <Button onClick={createBackup} disabled={creating} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    {creating ? 'Đang xuất...' : 'Xuất Backup JSON'}
                </Button>
            </CardContent>
        </Card>
    );
}

// ── RestoreSection ────────────────────────────────────────────

interface RestoreState {
    preview: BackupData | null;
    fileName: string;
    restoring: boolean;
    results: RestoreTableResult[] | null;
    error: string | null;
    confirmed: boolean;
}

function RestoreSection({ userId }: { userId?: string; accessToken: string | null }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<RestoreState>({
        preview: null,
        fileName: '',
        restoring: false,
        results: null,
        error: null,
        confirmed: false,
    });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setState(s => ({ ...s, preview: null, results: null, error: null, confirmed: false, fileName: file.name }));

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string) as BackupData;
                if (!data.exported_at) {
                    setState(s => ({ ...s, error: 'File không hợp lệ: thiếu trường exported_at' }));
                    return;
                }
                setState(s => ({ ...s, preview: data }));
            } catch {
                setState(s => ({ ...s, error: 'Không thể đọc file JSON. File có thể bị hỏng.' }));
            }
        };
        reader.readAsText(file);
    };

    const doRestore = async () => {
        if (!state.preview || !userId) return;

        setState(s => ({ ...s, restoring: true, error: null, results: null }));

        try {
            // Lấy access token từ session
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                setState(s => ({ ...s, restoring: false, error: 'Chưa đăng nhập. Vui lòng đăng nhập lại.' }));
                return;
            }

            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(state.preview),
            });

            const json = await res.json() as {
                ok: boolean;
                partial?: boolean;
                results?: RestoreTableResult[];
                totalRecords?: number;
                error?: string;
            };

            if (!res.ok || !json.ok) {
                setState(s => ({
                    ...s,
                    restoring: false,
                    error: json.error ?? 'Lỗi không xác định từ server',
                    results: json.results ?? null,
                }));
                return;
            }

            setState(s => ({
                ...s,
                restoring: false,
                results: json.results ?? null,
            }));
        } catch (err) {
            setState(s => ({
                ...s,
                restoring: false,
                error: err instanceof Error ? err.message : 'Lỗi kết nối',
            }));
        }
    };

    const reset = () => {
        setState({ preview: null, fileName: '', restoring: false, results: null, error: null, confirmed: false });
        if (fileRef.current) fileRef.current.value = '';
    };

    const { preview, fileName, restoring, results, error, confirmed } = state;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Khôi phục từ Backup
                </CardTitle>
                <CardDescription>
                    Upload file JSON đã backup để khôi phục dữ liệu (upsert — không xóa data hiện tại)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* File picker */}
                <div className="flex items-center gap-3">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFile}
                        disabled={restoring}
                        className="block text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:cursor-pointer hover:file:bg-accent"
                    />
                    {fileName && (
                        <Button variant="ghost" size="sm" onClick={reset} disabled={restoring}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Đổi file
                        </Button>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded p-3">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Preview */}
                {preview && !results && (
                    <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Thông tin file backup</p>
                            <Badge variant="outline" className="text-xs">{fileName}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Ngày xuất: <span className="font-medium text-foreground">{fmtDate(preview.exported_at)}</span>
                        </p>

                        {/* Records count per table */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {BACKUP_TABLES.map((t) => {
                                const rows = (preview as unknown as Record<string, unknown>)[t] as unknown[] | undefined;
                                const count = rows?.length ?? 0;
                                return (
                                    <div key={t} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                                        <span className="text-muted-foreground">{t}</span>
                                        <Badge variant={count > 0 ? 'default' : 'secondary'} className="text-xs">
                                            {fmtCount(count)}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Confirmation */}
                        {!confirmed ? (
                            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
                                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1.5">
                                    <AlertTriangle className="h-4 w-4" />
                                    Xác nhận trước khi restore
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Restore sẽ ghi đè (upsert) dữ liệu trùng khớp. Dữ liệu không có trong file backup sẽ được giữ nguyên.
                                </p>
                                <Button
                                    onClick={() => setState(s => ({ ...s, confirmed: true }))}
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                                >
                                    Tôi hiểu, tiến hành restore
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={doRestore}
                                disabled={restoring}
                                className="w-full"
                            >
                                {restoring ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Đang khôi phục...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Bắt đầu Restore
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            {results.every(r => !r.error) ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            )}
                            <p className="font-medium text-sm">
                                {results.every(r => !r.error) ? 'Restore thành công!' : 'Restore hoàn thành (có lỗi)'}
                            </p>
                        </div>

                        <div className="space-y-1">
                            {results.map((r) => (
                                <div
                                    key={r.table}
                                    className={`flex items-center justify-between text-sm rounded px-3 py-1.5 ${r.error
                                        ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                                        : 'bg-muted/50'
                                        }`}
                                >
                                    <span className="font-medium">{r.table}</span>
                                    <div className="flex items-center gap-2">
                                        {r.error ? (
                                            <span className="text-xs">{r.error}</span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                {fmtCount(r.upserted)} / {fmtCount(r.total)} records
                                            </span>
                                        )}
                                        {r.error
                                            ? <XCircle className="h-4 w-4 text-red-500" />
                                            : <CheckCircle className="h-4 w-4 text-green-500" />
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button variant="outline" size="sm" onClick={reset}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Restore lần nữa
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
