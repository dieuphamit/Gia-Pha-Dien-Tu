import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendNewContributionNotificationToAdmin, ContributionType } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { authorEmail, fieldName, fieldLabel, personName, summary } = body as {
            authorEmail: string;
            fieldName: ContributionType;
            fieldLabel: string;
            personName?: string;
            summary?: string;
        };

        if (!authorEmail || !fieldName || !fieldLabel) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        const serviceClient = createServiceClient();
        const { data: admins } = await serviceClient
            .from('profiles')
            .select('email')
            .eq('role', 'admin')
            .eq('status', 'active');

        const adminEmails = (admins ?? []).map((a: { email: string }) => a.email).filter(Boolean);

        await sendNewContributionNotificationToAdmin(
            { authorEmail, fieldName, fieldLabel, personName, summary },
            adminEmails
        );

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[notify-contribution] Error:', e);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
