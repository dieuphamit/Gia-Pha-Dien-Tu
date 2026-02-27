/**
 * Tests cho /api/cron/birthday — Vercel Cron endpoint
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVNDate, getPeopleBornOn } from './route';

// ── getVNDate ─────────────────────────────────────────────────
describe('getVNDate', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns correct VN date for UTC time where UTC+7 is still same day', () => {
        // 2026-02-10 01:00 UTC → 2026-02-10 08:00 VN → day=10, month=2
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T01:00:00Z'));
        const { month, day, year } = getVNDate(0);
        expect(month).toBe(2);
        expect(day).toBe(10);
        expect(year).toBe(2026);
    });

    it('advances to next VN day at UTC midnight when UTC+7 crosses midnight', () => {
        // 2026-02-10 17:30 UTC → 2026-02-11 00:30 VN → day=11
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T17:30:00Z'));
        const { month, day } = getVNDate(0);
        expect(month).toBe(2);
        expect(day).toBe(11);
    });

    it('returns tomorrow when offsetDays=1', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T01:00:00Z'));
        const { day } = getVNDate(1);
        expect(day).toBe(11);
    });

    it('wraps month end correctly (Feb 28 + 1 = Mar 1)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-28T01:00:00Z'));
        const { month, day } = getVNDate(1);
        expect(month).toBe(3);
        expect(day).toBe(1);
    });
});

// ── getPeopleBornOn ────────────────────────────────────────────
describe('getPeopleBornOn', () => {
    it('returns only people born on the specified month and day', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        not: vi.fn().mockReturnValue({
                            filter: vi.fn().mockResolvedValue({
                                data: [
                                    { handle: 'pham-van-a', display_name: 'Phạm Văn A', birth_date: '1980-07-15', generation: 4 },
                                    { handle: 'nguyen-thi-b', display_name: 'Nguyễn Thị B', birth_date: '1965-07-20', generation: 3 },
                                    { handle: 'pham-van-c', display_name: 'Phạm Văn C', birth_date: '1992-07-15', generation: 5 },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await getPeopleBornOn(mockSupabase as any, 7, 15);

        expect(result).toHaveLength(2);
        expect(result[0].handle).toBe('pham-van-a');
        expect(result[1].handle).toBe('pham-van-c');
    });

    it('returns empty array when no one has birthday on that day', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        not: vi.fn().mockReturnValue({
                            filter: vi.fn().mockResolvedValue({
                                data: [
                                    { handle: 'pham-van-a', display_name: 'Phạm Văn A', birth_date: '1980-01-01', generation: 4 },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await getPeopleBornOn(mockSupabase as any, 7, 15);
        expect(result).toHaveLength(0);
    });

    it('returns empty array on Supabase error', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        not: vi.fn().mockReturnValue({
                            filter: vi.fn().mockResolvedValue({
                                data: null,
                                error: { message: 'DB error' },
                            }),
                        }),
                    }),
                }),
            }),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await getPeopleBornOn(mockSupabase as any, 7, 15);
        expect(result).toHaveLength(0);
    });

    it('skips records with null birth_date', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        not: vi.fn().mockReturnValue({
                            filter: vi.fn().mockResolvedValue({
                                data: [
                                    { handle: 'pham-van-a', display_name: 'Phạm Văn A', birth_date: null, generation: 4 },
                                    { handle: 'pham-van-b', display_name: 'Phạm Văn B', birth_date: '1980-07-15', generation: 3 },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await getPeopleBornOn(mockSupabase as any, 7, 15);
        expect(result).toHaveLength(1);
        expect(result[0].handle).toBe('pham-van-b');
    });
});

// ── GET endpoint (auth check) ──────────────────────────────────
describe('GET /api/cron/birthday - auth', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv, CRON_SECRET: 'test-secret-123' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns 401 when Authorization header is missing', async () => {
        const { GET } = await import('./route');
        const req = new Request('http://localhost/api/cron/birthday');
        const res = await GET(req as never);
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when Authorization header has wrong secret', async () => {
        const { GET } = await import('./route');
        const req = new Request('http://localhost/api/cron/birthday', {
            headers: { authorization: 'Bearer wrong-secret' },
        });
        const res = await GET(req as never);
        expect(res.status).toBe(401);
    });

    it('returns 401 when CRON_SECRET env var is not set', async () => {
        process.env.CRON_SECRET = '';
        const { GET } = await import('./route');
        const req = new Request('http://localhost/api/cron/birthday', {
            headers: { authorization: 'Bearer test-secret-123' },
        });
        const res = await GET(req as never);
        expect(res.status).toBe(401);
    });
});
