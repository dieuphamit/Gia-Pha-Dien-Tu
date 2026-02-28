/**
 * E2E tests cho /api/cron/birthday
 *
 * Các test này dùng Playwright request context (không cần browser).
 * Chúng kiểm tra:
 *   1. Auth guard (CRON_SECRET)
 *   2. Response structure khi endpoint chạy thành công
 *   3. Idempotency — gọi 2 lần trong cùng ngày không gửi mail trùng
 *
 * Yêu cầu:
 *   - Dev server đang chạy (npm run dev)
 *   - .env.local có CRON_SECRET được set
 *
 * Note: Để test email thực sự được gửi, cần RESEND_API_KEY hợp lệ.
 * Trong test environment, Resend sẽ fail silently nếu không có key
 * (route vẫn trả về 200 vì lỗi Resend được log chứ không throw).
 */
import { test, expect } from '@playwright/test';

const ENDPOINT = '/api/cron/birthday';

// Lấy CRON_SECRET từ env (phải khớp với .env.local)
// Fallback về giá trị test nếu chạy isolated
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-for-e2e';

// ── 1. Auth Guard ─────────────────────────────────────────────────────────────

test.describe('Auth guard', () => {
    test('trả về 401 khi thiếu Authorization header', async ({ request }) => {
        const res = await request.get(ENDPOINT);

        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body).toMatchObject({ error: 'Unauthorized' });
    });

    test('trả về 401 khi Authorization header sai format', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: 'wrong-format' },
        });

        expect(res.status()).toBe(401);
    });

    test('trả về 401 khi secret sai', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: 'Bearer wrong-secret-12345' },
        });

        expect(res.status()).toBe(401);
    });

    test('không trả về 401 khi secret đúng', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });

        // 200 hoặc 500 (nếu Supabase không connect được trong test env) — nhưng không phải 401
        expect(res.status()).not.toBe(401);
    });
});

// ── 2. Response Structure ─────────────────────────────────────────────────────

test.describe('Response structure', () => {
    test('trả về đúng JSON schema khi chạy thành công', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });

        // Chỉ chạy nếu server có đủ env vars
        if (res.status() === 500) {
            test.skip(); // Supabase/env không khả dụng trong môi trường này
            return;
        }

        expect(res.status()).toBe(200);

        const body = await res.json();

        // Kiểm tra shape của response
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('date');
        expect(body).toHaveProperty('todayBirthdays');
        expect(body).toHaveProperty('todayEmailsSent');
        expect(body).toHaveProperty('tomorrowBirthdays');
        expect(body).toHaveProperty('tomorrowRemindersSent');

        // date phải có format YYYY-MM-DD
        expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // arrays
        expect(Array.isArray(body.todayBirthdays)).toBe(true);
        expect(Array.isArray(body.tomorrowBirthdays)).toBe(true);

        // numbers
        expect(typeof body.todayEmailsSent).toBe('number');
        expect(typeof body.tomorrowRemindersSent).toBe('number');
    });

    test('date trong response là ngày hôm nay theo giờ VN', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });

        if (res.status() !== 200) {
            test.skip();
            return;
        }

        const body = await res.json();

        // Tính ngày hôm nay theo giờ VN (UTC+7)
        const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const expectedDate = vnNow.toISOString().split('T')[0];

        expect(body.date).toBe(expectedDate);
    });
});

// ── 3. Idempotency ────────────────────────────────────────────────────────────

test.describe('Idempotency', () => {
    test('gọi 2 lần không tăng số email đã gửi', async ({ request }) => {
        const headers = { Authorization: `Bearer ${CRON_SECRET}` };

        const res1 = await request.get(ENDPOINT, { headers });
        if (res1.status() !== 200) {
            test.skip();
            return;
        }
        const body1 = await res1.json();

        // Gọi lần 2 ngay sau
        const res2 = await request.get(ENDPOINT, { headers });
        expect(res2.status()).toBe(200);
        const body2 = await res2.json();

        // Lần 2 không gửi thêm email nào (idempotency)
        expect(body2.todayEmailsSent).toBe(0);
        expect(body2.tomorrowRemindersSent).toBe(0);

        // Danh sách sinh nhật vẫn như cũ
        expect(body2.todayBirthdays).toEqual(body1.todayBirthdays);
        expect(body2.tomorrowBirthdays).toEqual(body1.tomorrowBirthdays);
    });
});

// ── 4. Content-Type ───────────────────────────────────────────────────────────

test.describe('HTTP headers', () => {
    test('response có Content-Type: application/json', async ({ request }) => {
        const res = await request.get(ENDPOINT, {
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });

        const contentType = res.headers()['content-type'] ?? '';
        expect(contentType).toContain('application/json');
    });
});
