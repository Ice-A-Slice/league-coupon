import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define the expected structure for a single answer in the request body
const answerSchema = z.object({
    question_type: z.string(), // e.g., 'league_winner', 'top_scorer', etc.
    answered_team_id: z.number().nullable().optional(),
    answered_player_id: z.number().nullable().optional(),
    // We might need to add validation to ensure one of the answer IDs is present based on question_type
});

// Define the expected structure for the entire request body (an array of answers)
const requestBodySchema = z.array(answerSchema);

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                // No set/remove needed for Route Handlers read-only access
            },
        },
    );

    // 1. Authenticate User
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('POST /api/season-answers: Auth Error:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and Validate Request Body
    let answersData;
    try {
        const body = await request.json();
        answersData = requestBodySchema.parse(body);
    } catch (error) {
        console.error('POST /api/season-answers: Invalid request body:', error);
        return NextResponse.json({ error: 'Invalid request body', details: (error as Error).message }, { status: 400 });
    }

    // 3. Prepare data for Supabase Upsert
    // TODO: Determine the correct season_id dynamically later. Hardcoding for now.
    const seasonId = 1; // Assuming season ID 1 for Premier League 2024/2025 based on previous context

    const answersToUpsert = answersData.map(answer => ({
        user_id: user.id,
        season_id: seasonId,
        question_type: answer.question_type,
        answered_team_id: answer.answered_team_id ?? null, // Ensure null if undefined/missing
        answered_player_id: answer.answered_player_id ?? null, // Ensure null if undefined/missing
        // created_at and updated_at are handled by the database
    }));

    if (answersToUpsert.length === 0) {
         return NextResponse.json({ error: 'No answers provided' }, { status: 400 });
    }

    // 4. Upsert data into the database
    try {
        const { data, error: dbError } = await supabase
            .from('user_season_answers')
            .upsert(answersToUpsert, {
                onConflict: 'user_id, season_id, question_type', // Specify conflict columns for upsert
            })
            .select(); // Optionally select the upserted data to return or log

        if (dbError) {
            console.error('POST /api/season-answers: Database Upsert Error:', dbError);
            // Provide more specific error based on dbError.code if needed
            return NextResponse.json({ error: 'Database error saving answers', details: dbError.message }, { status: 500 });
        }

        console.log('POST /api/season-answers: Success:', data);
        return NextResponse.json({ message: 'Answers saved successfully', data }, { status: 200 }); // 200 OK as it's an upsert

    } catch (error) {
        console.error('POST /api/season-answers: Unexpected Error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
} 