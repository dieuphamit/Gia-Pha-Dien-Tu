import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendNewUserNotificationToAdmin } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const { userId, email } = await request.json();

        if (!userId || !email) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        const serviceClient = createServiceClient();

        // Verify user exists in auth.users (security check)
        const { data: { user }, error: userError } = await serviceClient.auth.admin.getUserById(userId);
        if (userError || !user || user.email !== email) {
            return NextResponse.json({ ok: false }, { status: 403 });
        }

        // Insert profile only if it doesn't exist yet (trigger may have already created it)
        const { error } = await serviceClient
            .from('profiles')
            .upsert(
                { id: userId, email, role: 'member', status: 'pending' },
                { onConflict: 'id', ignoreDuplicates: true }
            );

        if (!error) {
            // Fire-and-forget: notify admins about the new pending user
            const displayName = user.user_metadata?.display_name ?? email;
            serviceClient
                .from('profiles')
                .select('email')
                .eq('role', 'admin')
                .eq('status', 'active')
                .then(({ data: admins }) => {
                    const adminEmails = (admins ?? []).map((a: { email: string }) => a.email).filter(Boolean);
                    sendNewUserNotificationToAdmin({ email, displayName }, adminEmails).catch(
                        (e) => console.error('[create-profile] sendNewUserNotificationToAdmin failed:', e)
                    );
                });
        }

        return NextResponse.json({ ok: !error });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
