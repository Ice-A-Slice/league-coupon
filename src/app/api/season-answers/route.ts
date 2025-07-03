import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import LeagueDataService from '@/lib/leagueDataService';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Types for transparency data
interface UserPrediction {
  user_id: string;
  username?: string;
  league_winner?: string | null;
  best_goal_difference?: string | null;
  top_scorer?: string | null;
  last_place?: string | null;
}

interface _CurrentAnswer {
  question_type: string;
  question_label: string;
  current_answer: string;
  points_value: number;
  row_index: number;
}

// Type for raw user answer data from Supabase
interface RawUserAnswer {
    user_id: string;
    question_type: string;
    answered_team_id: number | null;
    answered_player_id: number | null;
}

interface TeamData {
    id: number;
    name: string | null;
}

interface PlayerData {
    id: number;
    name: string | null;
}

// Type for Supabase service role client
type ServiceRoleClient = ReturnType<typeof getSupabaseServiceRoleClient>;

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

/**
 * Handles GET requests to /api/season-answers for fetching transparency data.
 * 
 * Returns both user predictions and current correct answers for the transparency page.
 * 
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A promise that resolves to transparency data or error response.
 */
export async function GET(_request: NextRequest) {
    try {
        // Use service role client for all database queries (bypasses RLS)
        const serviceRoleClient = getSupabaseServiceRoleClient();
        
        // 1. Get current season
        const { data: currentSeason, error: seasonError } = await serviceRoleClient
            .from('seasons')
            .select('id, api_season_year, competition:competitions!inner(api_league_id)')
            .eq('is_current', true)
            .single();

        if (seasonError || !currentSeason) {
            console.error('GET /api/season-answers: Failed to fetch current season:', seasonError);
            return NextResponse.json({ error: 'Failed to determine current season' }, { status: 500 });
        }

        const seasonId = currentSeason.id;
        const leagueId = currentSeason.competition.api_league_id;
        const seasonYear = currentSeason.api_season_year;

        console.log(`GET /api/season-answers: Using current season ${seasonId} - League ${leagueId}, Year ${seasonYear}`);

        // 2. Fetch ALL user profiles first (to show all users, even those who haven't answered)
        // Use service role client to bypass RLS and read all profiles
        const { data: profiles, error: profilesError } = await serviceRoleClient
            .from('profiles')
            .select('id, full_name');

        if (profilesError) {
            console.error('GET /api/season-answers: Failed to fetch user profiles:', profilesError);
            return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 });
        }

        console.log(`GET /api/season-answers: Found ${profiles?.length || 0} total profiles in database`);

        // 2b. Fetch user predictions without joins first to see what IDs we have
        // Use service role client to bypass RLS and read all user answers
        const { data: userAnswers, error: userAnswersError } = await serviceRoleClient
            .from('user_season_answers')
            .select(`
                user_id,
                question_type,
                answered_team_id,
                answered_player_id
            `)
            .eq('season_id', seasonId);

        if (userAnswersError) {
            console.error('GET /api/season-answers: Failed to fetch user answers:', userAnswersError);
            return NextResponse.json({ error: 'Failed to fetch user predictions' }, { status: 500 });
        }

        console.log(`GET /api/season-answers: Found ${userAnswers?.length || 0} user answers for season ${seasonId}`);

        // Create profile lookup map (handle null full_name values)
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || `User ${p.id}`]) || []);

        // 3. Get current correct answers using our multiple answers logic
        // Use the dynamic league/season from the database
        
        // Get current league data (including current standings)
        const [topScorers, bestGoalDifferenceTeams, currentLeagueTable, lastPlaceTeam] = await Promise.all([
            LeagueDataService.getTopScorers(leagueId, seasonYear), // Dynamic from database
            LeagueDataService.getBestGoalDifferenceTeams(leagueId, seasonYear), // Dynamic from database
            LeagueDataService.getCurrentLeagueTable(leagueId, seasonYear), // Dynamic from database
            LeagueDataService.getLastPlaceTeam(leagueId, seasonYear) // Dynamic from database
        ]);

        // Get current league winner (first place team) and team names for display
        const currentLeagueWinner = currentLeagueTable?.standings?.[0];
        const currentLeagueWinnerTeamId = currentLeagueWinner?.team_id;
        
        // Get names for display - use api_player_id and api_team_id to match external API IDs
        // Use service role client for consistency
        const [topScorerNames, bestGoalDifferenceNames, leagueWinnerName, lastPlaceName] = await Promise.all([
            Promise.all(topScorers.map(async (playerId) => {
                const { data } = await serviceRoleClient
                    .from('players')
                    .select('name')
                    .eq('api_player_id', playerId)
                    .single();
                return data?.name || `Player ${playerId}`;
            })),
            Promise.all(bestGoalDifferenceTeams.map(async (teamId) => {
                const { data } = await serviceRoleClient
                    .from('teams')
                    .select('name')
                    .eq('api_team_id', teamId)
                    .single();
                return data?.name || `Team ${teamId}`;
            })),
            // Get current league winner name
            currentLeagueWinnerTeamId ? (async () => {
                const { data } = await serviceRoleClient
                    .from('teams')
                    .select('name')
                    .eq('api_team_id', currentLeagueWinnerTeamId)
                    .single();
                return data?.name || `Team ${currentLeagueWinnerTeamId}`;
            })() : Promise.resolve('TBD'),
            // Get current last place team name
            lastPlaceTeam?.team_id ? (async () => {
                const { data } = await serviceRoleClient
                    .from('teams')
                    .select('name')
                    .eq('api_team_id', lastPlaceTeam.team_id)
                    .single();
                return data?.name || `Team ${lastPlaceTeam.team_id}`;
            })() : Promise.resolve('TBD')
        ]);

        // 4. Manually fetch team and player names for user answers
        const userPredictionsWithNames = await transformUserPredictionsWithNames(userAnswers, profileMap, profiles, serviceRoleClient);

        // 5. Create current answers data with support for multiple rows when tied
        const currentAnswers = [];
        
        // Find the maximum number of tied answers to determine how many rows we need
        const maxTiedAnswers = Math.max(
            1, // Always at least 1 row
            topScorerNames.length,
            bestGoalDifferenceNames.length
            // League winner and last place are typically single answers, but could be extended
        );
        
        // Create rows for each tied position
        for (let rowIndex = 0; rowIndex < maxTiedAnswers; rowIndex++) {
            currentAnswers.push({
                question_type: 'league_winner',
                question_label: 'League Winner', 
                current_answer: rowIndex === 0 ? (leagueWinnerName || 'TBD') : '', // Only show in first row
                points_value: 3,
                row_index: rowIndex
            });
            
            currentAnswers.push({
                question_type: 'best_goal_difference',
                question_label: 'Best Goal Difference',
                current_answer: bestGoalDifferenceNames[rowIndex] || (rowIndex === 0 ? 'TBD' : ''), // Show tied teams in separate rows
                points_value: 3,
                row_index: rowIndex
            });
            
            currentAnswers.push({
                question_type: 'top_scorer', 
                question_label: 'Top Scorer',
                current_answer: topScorerNames[rowIndex] || (rowIndex === 0 ? 'TBD' : ''), // Show tied players in separate rows
                points_value: 3,
                row_index: rowIndex
            });
            
            currentAnswers.push({
                question_type: 'last_place',
                question_label: 'Last Place',
                current_answer: rowIndex === 0 ? (lastPlaceName || 'TBD') : '', // Only show in first row
                points_value: 3,
                row_index: rowIndex
            });
        }

        console.log(`GET /api/season-answers: Success - ${userPredictionsWithNames.length} user predictions, ${currentAnswers.length} current answers`);
        
        return NextResponse.json({
            userPredictions: userPredictionsWithNames,
            currentAnswers,
            season_id: seasonId
        }, { status: 200 });

    } catch (error) {
        console.error('GET /api/season-answers: Unexpected Error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}

/**
 * Transform raw user answers data into the format expected by the UI
 * Shows ALL users from profiles, with answers where they exist and null where they don't
 * Manually fetches team and player names for user answers
 */
async function transformUserPredictionsWithNames(
    userAnswers: RawUserAnswer[], 
    profileMap: Map<string, string>,
    allProfiles: { id: string; full_name: string | null }[],
    serviceRoleClient: ServiceRoleClient
): Promise<UserPrediction[]> {
    const userMap = new Map<string, UserPrediction>();

    // First, create entries for ALL users (even those who haven't answered)
    allProfiles.forEach(profile => {
        userMap.set(profile.id, {
            user_id: profile.id,
            username: profile.full_name || `User ${profile.id}`,
            league_winner: null,
            best_goal_difference: null,
            top_scorer: null,
            last_place: null
        });
    });

    // Then, populate answers for users who have them
    // First get all unique team and player IDs to fetch names efficiently
    const teamIds: number[] = [];
    const playerIds: number[] = [];
    
    userAnswers.forEach(answer => {
        if (answer.answered_team_id) teamIds.push(answer.answered_team_id);
        if (answer.answered_player_id) playerIds.push(answer.answered_player_id);
    });

    // Fetch team and player names in batches
    const [teamsData, playersData] = await Promise.all([
        teamIds.length > 0 ? serviceRoleClient
            .from('teams')
            .select('id, name')
            .in('id', [...new Set(teamIds)]) : Promise.resolve({ data: [] }),
        playerIds.length > 0 ? serviceRoleClient
            .from('players')
            .select('id, name')
            .in('id', [...new Set(playerIds)]) : Promise.resolve({ data: [] })
    ]);

    // Create lookup maps with proper typing (handle null names)
    const teamNameMap = new Map(teamsData.data?.map((team: TeamData) => [team.id, team.name || `Team ${team.id}`]) || []);
    const playerNameMap = new Map(playersData.data?.map((player: PlayerData) => [player.id, player.name || `Player ${player.id}`]) || []);

    // Populate user answers with resolved names
    userAnswers.forEach(answer => {
        const userId = answer.user_id;
        const user = userMap.get(userId);
        
        if (user) {
            let answerName = 'Unknown';
            
            if (answer.answered_team_id) {
                answerName = teamNameMap.get(answer.answered_team_id) || `Team ${answer.answered_team_id}`;
            } else if (answer.answered_player_id) {
                answerName = playerNameMap.get(answer.answered_player_id) || `Player ${answer.answered_player_id}`;
            }
            
            // Map question types to user object properties
            switch (answer.question_type) {
                case 'league_winner':
                    user.league_winner = answerName;
                    break;
                case 'best_goal_difference':
                    user.best_goal_difference = answerName;
                    break;
                case 'top_scorer':
                    user.top_scorer = answerName;
                    break;
                case 'last_place':
                    user.last_place = answerName;
                    break;
            }
        }
    });

    // Sort by username for consistent ordering
    return Array.from(userMap.values()).sort((a, b) => {
        const nameA = a.username || '';
        const nameB = b.username || '';
        return nameA.localeCompare(nameB);
    });
} 