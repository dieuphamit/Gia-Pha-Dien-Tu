import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Resend để không throw lỗi "Missing API key" khi chạy test
vi.mock('resend', () => {
    const mockSend = vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
    class MockResend {
        emails = { send: mockSend };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_key: unknown) {}
    }
    return { Resend: MockResend };
});

// Mock @supabase/supabase-js để không cần kết nối DB thật
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockReturnValue({
                        filter: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
                order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
        }),
    }),
}));
