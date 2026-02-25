import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
    try {
        const serviceClient = createServiceClient();
        const { data, error } = await serviceClient
            .from('family_questions')
            .select('id, question, hint')
            .eq('is_active', true);

        if (error || !data || data.length === 0) {
            return NextResponse.json({ questions: [] });
        }

        // Pick 3 random questions server-side (correct_answer never sent to client)
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        const questions = shuffled.slice(0, Math.min(3, shuffled.length));

        return NextResponse.json({ questions });
    } catch {
        return NextResponse.json({ questions: [] }, { status: 500 });
    }
}
