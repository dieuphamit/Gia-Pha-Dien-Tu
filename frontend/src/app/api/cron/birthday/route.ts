/**
 * /api/cron/birthday — Vercel Cron Job endpoint
 *
 * Chạy mỗi ngày lúc 8:00 sáng (giờ VN) = 01:00 UTC.
 * Logic:
 *   1. Tìm người có sinh nhật HÔM NAY (is_living=true) → gửi mail cho tất cả member active
 *   2. Tìm người có sinh nhật NGÀY MAI (is_living=true) → gửi mail nhắc admin
 *   3. Ghi vào birthday_notifications để tránh gửi trùng (idempotency)
 *
 * Bảo mật: kiểm tra CRON_SECRET trong Authorization header.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    sendBirthdayNotificationToMembers,
    sendBirthdayReminderToAdmin,
    type BirthdayPerson,
} from '@/lib/email';

// Service role client — chỉ dùng server-side
function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    return createClient(url, key, { auth: { persistSession: false } });
}

/** Trả về ngày dưới dạng { month, day } theo giờ VN (UTC+7) */
export function getVNDate(offsetDays = 0): { month: number; day: number; year: number } {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 7); // UTC → VN
    now.setDate(now.getDate() + offsetDays);
    return {
        month: now.getMonth() + 1, // 1-12
        day: now.getDate(),
        year: now.getFullYear(),
    };
}

/** Lấy danh sách người có sinh nhật trong ngày chỉ định */
export async function getPeopleBornOn(
    supabase: ReturnType<typeof getServiceClient>,
    month: number,
    day: number
): Promise<BirthdayPerson[]> {
    const { data, error } = await supabase
        .from('people')
        .select('handle, display_name, birth_date, generation')
        .eq('is_living', true)
        .not('birth_date', 'is', null)
        .filter('birth_date', 'not.is', null);

    if (error || !data) return [];

    // Filter theo tháng/ngày (Supabase không hỗ trợ EXTRACT trực tiếp qua JS client)
    return data
        .filter(p => {
            if (!p.birth_date) return false;
            const d = new Date(p.birth_date);
            return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
        })
        .map(p => ({
            handle: p.handle as string,
            displayName: p.display_name as string,
            birthDate: p.birth_date as string,
            generation: p.generation as number,
        }));
}

/** Kiểm tra đã gửi mail chưa (idempotency) */
async function wasAlreadySent(
    supabase: ReturnType<typeof getServiceClient>,
    personHandle: string,
    year: number,
    recipientEmail: string
): Promise<boolean> {
    const { data } = await supabase
        .from('birthday_notifications')
        .select('id')
        .eq('person_handle', personHandle)
        .eq('sent_year', year)
        .eq('recipient_email', recipientEmail)
        .maybeSingle();
    return !!data;
}

/** Ghi lại đã gửi */
async function markAsSent(
    supabase: ReturnType<typeof getServiceClient>,
    personHandle: string,
    year: number,
    recipientEmail: string
): Promise<void> {
    await supabase
        .from('birthday_notifications')
        .upsert(
            { person_handle: personHandle, sent_year: year, recipient_email: recipientEmail },
            { onConflict: 'person_handle,sent_year,recipient_email', ignoreDuplicates: true }
        );
}

export async function GET(request: NextRequest) {
    // ── Xác thực CRON_SECRET ──────────────────────────────────
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getServiceClient();
        const today = getVNDate(0);
        const tomorrow = getVNDate(1);

        // ── 1. Lấy email admin ────────────────────────────────
        const { data: admins } = await supabase
            .from('profiles')
            .select('email')
            .eq('role', 'admin')
            .eq('status', 'active');
        const adminEmail = admins?.[0]?.email as string | undefined;

        // ── 2. Lấy email tất cả member active ────────────────
        const { data: members } = await supabase
            .from('profiles')
            .select('email')
            .eq('status', 'active');
        const memberEmails = (members ?? []).map(m => m.email as string).filter(Boolean);

        // ── 3. Sinh nhật HÔM NAY → mail cho tất cả member ────
        const todayBirthdays = await getPeopleBornOn(supabase, today.month, today.day);
        let todaySentCount = 0;

        for (const person of todayBirthdays) {
            // Lọc ra những email chưa gửi
            const pending: string[] = [];
            for (const email of memberEmails) {
                const sent = await wasAlreadySent(supabase, person.handle, today.year, email);
                if (!sent) pending.push(email);
            }

            if (pending.length > 0) {
                await sendBirthdayNotificationToMembers(person, pending);
                for (const email of pending) {
                    await markAsSent(supabase, person.handle, today.year, email);
                }
                todaySentCount++;
            }
        }

        // ── 4. Sinh nhật NGÀY MAI → mail nhắc admin ──────────
        const tomorrowBirthdays = await getPeopleBornOn(supabase, tomorrow.month, tomorrow.day);
        let tomorrowSentCount = 0;

        if (adminEmail) {
            for (const person of tomorrowBirthdays) {
                const reminderKey = `${person.handle}_reminder`;
                const sent = await wasAlreadySent(supabase, reminderKey, today.year, adminEmail);
                if (!sent) {
                    await sendBirthdayReminderToAdmin(person, adminEmail);
                    await markAsSent(supabase, reminderKey, today.year, adminEmail);
                    tomorrowSentCount++;
                }
            }
        }

        return NextResponse.json({
            ok: true,
            date: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
            todayBirthdays: todayBirthdays.map(p => p.handle),
            todayEmailsSent: todaySentCount,
            tomorrowBirthdays: tomorrowBirthdays.map(p => p.handle),
            tomorrowRemindersSent: tomorrowSentCount,
        });
    } catch (err) {
        console.error('[cron/birthday] Error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal error' },
            { status: 500 }
        );
    }
}
