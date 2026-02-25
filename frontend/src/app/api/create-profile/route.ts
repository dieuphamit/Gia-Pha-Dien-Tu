import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

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

        return NextResponse.json({ ok: !error });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
