import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config cho Gia Phả Điện Tử.
 *
 * Chạy tests:
 *   npx playwright test                  # tất cả
 *   npx playwright test tests/e2e/cron   # chỉ cron tests
 *   npx playwright test --ui             # UI mode
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,           // API tests cần chạy tuần tự để tránh race condition trên DB
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
    ],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'api',
            testMatch: '**/cron-birthday.spec.ts',
            use: {},    // không cần browser — dùng request context
        },
        {
            name: 'chromium',
            testMatch: '**/add-member-birthday.spec.ts',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
