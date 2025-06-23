import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for validating a single answer object in the request body.
const answerSchema = z.object({
    /** The type identifier for the questionnaire question (e.g., 'league_winner'). */
    question_type: z.string(), // e.g., 'league_winner', 'top_scorer', etc.
    /** The ID of the team selected as the answer (nullable). */
    answered_team_id: z.number().nullable().optional(),
    /** The ID of the player selected as the answer (nullable). */
    answered_player_id: z.number().nullable().optional(),
    // TODO: Add refinement to ensure either answered_team_id or answered_player_id is present depending on question_type.
    // .refine(...) 
});

// Zod schema for validating the entire request body, which should be an array of answer objects.
const requestBodySchema = z.array(answerSchema);

/**
 * Handles POST requests to /api/season-answers for submitting user answers to season prediction questions.
 * 
 * This handler performs the following steps:
 * 1. **Authentication:** Verifies the user is logged in using Supabase auth.
 * 2. **Request Parsing & Validation:** Parses the JSON request body and validates it against the `requestBodySchema` (array of answers).
 * 3. **Data Preparation:** Maps the validated answers into the structure required for the `user_season_answers` table, including `user_id` and a hardcoded `season_id` (TODO: make dynamic).
 * 4. **Database Upsert:** Upserts the answers into the `user_season_answers` table using Supabase, 
 *    handling conflicts based on `user_id`, `season_id`, and `question_type`.
 * 5. **Response:** Returns a success message and the upserted data (200) or an appropriate error response (400, 401, 500).
 *
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a Next.js response object.
 */
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
    // Get the current season dynamically instead of hardcoding
    const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();

    if (seasonError || !currentSeason) {
        console.error('POST /api/season-answers: Failed to fetch current season:', seasonError);
        return NextResponse.json({ error: 'Failed to determine current season' }, { status: 500 });
    }

    const seasonId = currentSeason.id; // Use the current season ID dynamically

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