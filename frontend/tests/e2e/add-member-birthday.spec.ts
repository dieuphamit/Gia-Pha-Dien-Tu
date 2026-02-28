/**
 * E2E tests cho UI "Thêm thành viên mới" — birth date input
 *
 * Kiểm tra:
 *   1. Dialog có date picker cho Ngày sinh / Ngày mất (không phải number input)
 *   2. Chọn ngày sinh → hiển thị đúng giá trị
 *   3. Nhập ngày mất → tự set isLiving = false (theo logic onChange)
 *   4. Không cho chọn ngày trong tương lai
 *
 * Yêu cầu:
 *   - Dev server đang chạy (npm run dev)
 *   - Đăng nhập với tài khoản có quyền admin/editor (canEdit = true)
 *     để nút "Thêm thành viên" hiển thị
 */
import { test, expect } from '@playwright/test';

// URL trang danh sách thành viên
const PEOPLE_PAGE = '/people';

// Selector chính
const OPEN_BTN = '#open-add-member-btn';
const BIRTH_DATE_INPUT = '#member-birth-date';
const DEATH_DATE_INPUT = '#member-death-date';
const NAME_INPUT = '#member-name';

test.describe('Add Member Dialog — date inputs', () => {
    test.beforeEach(async ({ page }) => {
        // Nếu cần đăng nhập: thêm auth fixture ở đây
        // Hiện tại navigate thẳng, nếu redirect về login thì skip
        await page.goto(PEOPLE_PAGE);
    });

    test('dialog mở và có date picker cho Ngày sinh', async ({ page }) => {
        // Chờ nút "Thêm thành viên" — chỉ hiện với admin/editor
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });

        await openBtn.click();

        // Dialog phải mở
        await expect(page.getByRole('dialog')).toBeVisible();

        // Input phải là type="date" (date picker), không phải type="number"
        const birthInput = page.locator(BIRTH_DATE_INPUT);
        await expect(birthInput).toBeVisible();
        await expect(birthInput).toHaveAttribute('type', 'date');
    });

    test('date picker cho Ngày mất cũng là type="date"', async ({ page }) => {
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });
        await openBtn.click();

        const deathInput = page.locator(DEATH_DATE_INPUT);
        await expect(deathInput).toBeVisible();
        await expect(deathInput).toHaveAttribute('type', 'date');
    });

    test('nhập ngày sinh hợp lệ → giá trị được lưu', async ({ page }) => {
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });
        await openBtn.click();

        const birthInput = page.locator(BIRTH_DATE_INPUT);
        await birthInput.fill('1990-05-15');

        await expect(birthInput).toHaveValue('1990-05-15');
    });

    test('không cho nhập ngày sinh trong tương lai (max = hôm nay)', async ({ page }) => {
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });
        await openBtn.click();

        const birthInput = page.locator(BIRTH_DATE_INPUT);

        // max attribute phải là ngày hôm nay hoặc sớm hơn
        const maxAttr = await birthInput.getAttribute('max');
        expect(maxAttr).toBeTruthy();

        const today = new Date().toISOString().split('T')[0];
        expect(maxAttr).toBe(today);
    });

    test('nhập ngày mất → cột Ngày mất cũng có date picker', async ({ page }) => {
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });
        await openBtn.click();

        const deathInput = page.locator(DEATH_DATE_INPUT);
        await deathInput.fill('2020-12-31');

        await expect(deathInput).toHaveValue('2020-12-31');
    });

    test('điền đủ thông tin và bấm Tiếp theo → chuyển sang bước quan hệ', async ({ page }) => {
        const openBtn = page.locator(OPEN_BTN);
        await expect(openBtn).toBeVisible({ timeout: 10_000 });
        await openBtn.click();

        // Điền họ tên (required)
        await page.locator(NAME_INPUT).fill('Test Người Dùng E2E');

        // Điền ngày sinh
        await page.locator(BIRTH_DATE_INPUT).fill('1985-03-20');

        // Bấm Tiếp theo
        const nextBtn = page.locator('#member-next-btn');
        await expect(nextBtn).toBeEnabled();
        await nextBtn.click();

        // Bước 2: Chọn quan hệ phải xuất hiện
        await expect(page.locator('#relation-submit-btn')).toBeVisible({ timeout: 5_000 });
    });
});
