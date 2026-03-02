/**
 * Email sending utility using Resend.
 * Server-side only — never import in client components.
 */
import { Resend } from 'resend';

/** Địa chỉ gửi mail (phải verify domain trên Resend) */
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'noreply@giaphadientu.vn';

/**
 * Khi chưa có domain riêng, set EMAIL_TEST_RECIPIENT để chuyển hướng
 * tất cả email về một địa chỉ duy nhất (email đăng ký Resend).
 */
function resolveRecipients(actual: string | string[]): string | string[] {
    const override = process.env.EMAIL_TEST_RECIPIENT;
    if (override) return override;
    return actual;
}

/** Lazy initialization — trả về null nếu chưa cấu hình RESEND_API_KEY */
function getResend(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

/** Format ngày theo kiểu Việt Nam */
export function formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Tính tuổi từ ngày sinh ISO */
export function calcAge(isoDate: string): number {
    const birth = new Date(isoDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export interface BirthdayPerson {
    handle: string;
    displayName: string;
    birthDate: string; // ISO DATE: "YYYY-MM-DD"
    generation: number;
}

/**
 * Gửi email thông báo sinh nhật hôm nay cho tất cả thành viên active.
 */
export async function sendBirthdayNotificationToMembers(
    person: BirthdayPerson,
    recipientEmails: string[]
): Promise<void> {
    if (recipientEmails.length === 0) return;

    const age = calcAge(person.birthDate);
    const dateStr = formatDate(person.birthDate);

    const resend = getResend();
    if (!resend) { console.warn('[sendBirthdayNotificationToMembers] RESEND_API_KEY not set, skipping'); return; }

    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: resolveRecipients(recipientEmails),
        subject: `🎂 Hôm nay là sinh nhật của ${person.displayName}!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #b45309; font-size: 24px; margin: 0;">🎂 Chúc Mừng Sinh Nhật!</h1>
                </div>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <p style="font-size: 18px; color: #1f2937; margin: 0 0 8px 0;">
                        Hôm nay là sinh nhật của
                        <strong style="color: #b45309;">${person.displayName}</strong>
                    </p>
                    <p style="color: #6b7280; margin: 4px 0;">
                        📅 Ngày sinh: ${dateStr} &nbsp;|&nbsp; 🎈 Tròn ${age} tuổi
                    </p>
                    <p style="color: #6b7280; margin: 4px 0;">
                        🌳 Đời thứ ${person.generation} trong gia phả họ Phạm
                    </p>
                </div>
                <p style="color: #374151; line-height: 1.6;">
                    Hãy dành chút thời gian gửi lời chúc tốt đẹp đến thành viên của gia đình chúng ta nhé! 💝
                </p>
                <div style="margin-top: 24px; text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/people/${person.handle}"
                       style="background: #b45309; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                        Xem hồ sơ thành viên
                    </a>
                </div>
                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center;">
                    Email này được gửi tự động từ hệ thống Gia Phả Điện Tử họ Phạm.
                </p>
            </div>
        `,
    });

    if (error) {
        console.error(`[sendBirthdayNotificationToMembers] Failed for ${person.handle}:`, error);
    }
}

/**
 * Gửi email nhắc admin NGÀY MAI có sinh nhật.
 */
export async function sendBirthdayReminderToAdmin(
    person: BirthdayPerson,
    adminEmail: string
): Promise<void> {
    const age = calcAge(person.birthDate) + 1; // ngày mai tròn
    const dateStr = formatDate(person.birthDate);

    const resend = getResend();
    if (!resend) { console.warn('[sendBirthdayReminderToAdmin] RESEND_API_KEY not set, skipping'); return; }

    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: resolveRecipients(adminEmail),
        subject: `🔔 Nhắc nhở: Ngày mai là sinh nhật của ${person.displayName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1e40af;">🔔 Nhắc nhở sinh nhật — Ngày mai</h2>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px;">
                    <p style="font-size: 16px; color: #1f2937; margin: 0 0 8px 0;">
                        <strong>${person.displayName}</strong> sẽ tròn <strong>${age} tuổi</strong> vào ngày mai.
                    </p>
                    <p style="color: #6b7280; margin: 4px 0;">
                        📅 Ngày sinh: ${dateStr}
                    </p>
                    <p style="color: #6b7280; margin: 4px 0;">
                        🌳 Đời thứ ${person.generation} &nbsp;|&nbsp; 🔑 Handle: <code>${person.handle}</code>
                    </p>
                </div>
                <p style="color: #374151; margin-top: 16px; line-height: 1.6;">
                    Bạn có thể chuẩn bị lời chúc hoặc thông báo trước cho thành viên gia đình.
                </p>
                <div style="margin-top: 20px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/people/${person.handle}"
                       style="background: #1e40af; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                        Xem hồ sơ
                    </a>
                </div>
                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center;">
                    Email tự động — Gia Phả Điện Tử họ Phạm
                </p>
            </div>
        `,
    });

    if (error) {
        console.error(`[sendBirthdayReminderToAdmin] Failed for ${person.handle}:`, error);
    }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * Gửi email thông báo cho admin khi có user đăng ký mới (chờ duyệt).
 */
export async function sendNewUserNotificationToAdmin(
    user: { email: string; displayName: string },
    adminEmails: string[]
): Promise<void> {
    if (adminEmails.length === 0) return;
    const resend = getResend();
    if (!resend) { console.warn('[sendNewUserNotificationToAdmin] RESEND_API_KEY not set, skipping'); return; }

    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: resolveRecipients(adminEmails),
        subject: `[Gia Phả] Tài khoản mới chờ duyệt: ${user.displayName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1e40af; margin-bottom: 4px;">👤 Tài khoản mới chờ xét duyệt</h2>
                <p style="color: #6b7280; margin-top: 0;">Một người dùng vừa đăng ký và đang chờ bạn phê duyệt.</p>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 16px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>Tên:</strong> ${user.displayName}</p>
                    <p style="margin: 0;"><strong>Email:</strong> ${user.email}</p>
                </div>
                <div style="margin-top: 24px;">
                    <a href="${APP_URL}/admin/users"
                       style="background: #1e40af; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                        Xét duyệt ngay
                    </a>
                </div>
                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center;">
                    Email tự động — Gia Phả Điện Tử họ Phạm
                </p>
            </div>
        `,
    });

    if (error) {
        console.error('[sendNewUserNotificationToAdmin] Failed:', error);
    }
}

export type ContributionType = 'add_person' | 'edit_person_field' | 'add_event' | 'add_post' | 'add_quiz_question';

const CONTRIBUTION_LABEL: Record<ContributionType, string> = {
    add_person: 'Thêm thành viên mới',
    edit_person_field: 'Chỉnh sửa thông tin thành viên',
    add_event: 'Thêm sự kiện',
    add_post: 'Thêm bài viết',
    add_quiz_question: 'Thêm câu hỏi',
};

/**
 * Gửi email thông báo cho admin khi có contribution mới (chờ duyệt).
 */
export async function sendNewContributionNotificationToAdmin(
    contribution: {
        authorEmail: string;
        fieldName: ContributionType;
        fieldLabel: string;
        personName?: string;
        summary?: string;
    },
    adminEmails: string[]
): Promise<void> {
    if (adminEmails.length === 0) return;
    const resend = getResend();
    if (!resend) { console.warn('[sendNewContributionNotificationToAdmin] RESEND_API_KEY not set, skipping'); return; }

    const typeLabel = CONTRIBUTION_LABEL[contribution.fieldName] ?? contribution.fieldLabel;
    const subject = contribution.personName
        ? `[Gia Phả] Đóng góp mới: ${typeLabel} — ${contribution.personName}`
        : `[Gia Phả] Đóng góp mới: ${typeLabel}`;

    const personRow = contribution.personName
        ? `<p style="margin: 0 0 8px 0;"><strong>Thành viên liên quan:</strong> ${contribution.personName}</p>`
        : '';
    const summaryRow = contribution.summary
        ? `<p style="margin: 0 0 8px 0;"><strong>Nội dung:</strong> ${contribution.summary}</p>`
        : '';

    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: resolveRecipients(adminEmails),
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #7c3aed; margin-bottom: 4px;">📝 Đóng góp mới chờ xét duyệt</h2>
                <p style="color: #6b7280; margin-top: 0;">Một thành viên vừa gửi đóng góp và đang chờ bạn phê duyệt.</p>
                <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 20px; margin: 16px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>Loại đóng góp:</strong> ${typeLabel}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Người gửi:</strong> ${contribution.authorEmail}</p>
                    ${personRow}
                    ${summaryRow}
                </div>
                <div style="margin-top: 24px;">
                    <a href="${APP_URL}/admin/edits"
                       style="background: #7c3aed; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                        Xét duyệt ngay
                    </a>
                </div>
                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center;">
                    Email tự động — Gia Phả Điện Tử họ Phạm
                </p>
            </div>
        `,
    });

    if (error) {
        console.error('[sendNewContributionNotificationToAdmin] Failed:', error);
    }
}
