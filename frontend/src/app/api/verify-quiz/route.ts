import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

interface AnswerItem {
    questionId: string;
    answer: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const answers: AnswerItem[] = body?.answers;

        if (!Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({ passed: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        const questionIds = answers.map((a) => a.questionId);

        // Use service client to access correct_answer (not exposed to browser)
        const serviceClient = createServiceClient();
        const { data: questions, error } = await serviceClient
            .from('family_questions')
            .select('id, correct_answer')
            .in('id', questionIds)
            .eq('is_active', true);

        if (error || !questions) {
            return NextResponse.json({ passed: false, error: 'Lỗi hệ thống' }, { status: 500 });
        }

        // Build a map for quick lookup
        const correctMap = new Map(questions.map((q) => [q.id, q.correct_answer]));

        // Check all answers
        const allCorrect = answers.every((a) => {
            const correct = correctMap.get(a.questionId);
            if (!correct) return false;
            return correct.trim().toLowerCase() === a.answer.trim().toLowerCase();
        });

        return NextResponse.json({ passed: allCorrect });
    } catch {
        return NextResponse.json({ passed: false, error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
