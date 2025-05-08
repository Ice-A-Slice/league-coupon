import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
// import { logger } from '@/utils/logger';

// Define the structure for the aggregated points data
export interface UserPoints {
  user_id: string; 
  total_points: number;
}

/**
 * Aggregates total points for each user from the user_bets table.
 * This function will be the first step in calculating overall standings.
 * 
 * @returns {Promise<UserPoints[] | null>} A promise resolving to an array of users 
 *          with their total points, or null on error.
 */
export async function aggregateUserPoints(): Promise<UserPoints[] | null> {
  // logger.info('Aggregating total points per user via RPC...');
  console.log('[INFO] Aggregating total points per user via RPC...');
  const serviceRoleClient = getSupabaseServiceRoleClient();

  try {
    // Call the PostgreSQL function 'get_user_total_points' via RPC
    const { data, error } = await serviceRoleClient.rpc('get_user_total_points');

    if (error) {
      // logger.error({ error }, 'Error calling get_user_total_points RPC.');
      console.error('[ERROR]', { error }, 'Error calling get_user_total_points RPC.');
      throw error;
    }
    
    // The data from the RPC call should directly match the UserPoints[] structure
    // if the SQL function is defined correctly (RETURNS TABLE(user_id UUID, total_points BIGINT))
    // Supabase client should handle the mapping.
    // Ensure UserPoints interface matches the SQL function's output columns and types.
    const userPointsResult: UserPoints[] = (data || []).map(item => ({
      user_id: item.user_id, // Assuming item.user_id is string (UUID comes as string)
      total_points: Number(item.total_points ?? 0) // Ensure total_points is a number
    }));

    // logger.info({ userCount: userPointsResult.length }, 'Successfully aggregated points via RPC.');
    console.log('[INFO]', { userCount: userPointsResult.length }, 'Successfully aggregated points via RPC.');
    return userPointsResult;

  } catch (err) {
    // logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to aggregate user points.');
    console.error('[ERROR]', { error: err instanceof Error ? err.message : String(err) }, 'Failed to aggregate user points.');
    return null; // Indicate failure
  }
}

// Define the new structure for the final standings entry
export interface UserStandingEntry {
  user_id: string;
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
  rank: number;
}

// Updated function to calculate standings including dynamic points
// Export this function to allow for dependency injection in tests
export async function calculateStandingsWithDynamicPoints(
  userPoints: UserPoints[],
  dynamicPointsMap: Map<string, number> | null
): Promise<UserStandingEntry[] | null> {
  if (dynamicPointsMap === null) {
    // logger.error('Standings calculation failed because dynamic points could not be fetched.');
    console.error('[ERROR] Standings calculation failed because dynamic points could not be fetched.');
    // Returning null as dynamic points are considered essential for standings
    return null;
  }
  // logger.info({ dynamicMapSize: dynamicPointsMap.size }, 'Successfully fetched dynamic points map.');
  console.log('[INFO]', { dynamicMapSize: dynamicPointsMap.size }, 'Successfully fetched dynamic points map.');

  // === Merge points ===
  const combinedUserScores = userPoints.map(user => {
    const game_points = user.total_points; // Original game points
    const dynamic_points = dynamicPointsMap.get(user.user_id) || 0; // Default to 0 if user not in map
    const combined_total_score = game_points + dynamic_points;
    return {
      user_id: user.user_id,
      game_points: game_points,
      dynamic_points: dynamic_points,
      combined_total_score: combined_total_score
    };
  });
  // logger.info({ userCount: combinedUserScores.length }, 'Successfully merged game and dynamic points.');
  console.log('[INFO]', { userCount: combinedUserScores.length }, 'Successfully merged game and dynamic points.');

  // Update Sorting: Sort by Combined Total Points
  const sortedUserScores = [...combinedUserScores].sort((a, b) => b.combined_total_score - a.combined_total_score);
  // logger.info({ userCount: sortedUserScores.length }, 'Successfully sorted users by combined score.');
  console.log('[INFO]', { userCount: sortedUserScores.length }, 'Successfully sorted users by combined score.');

  // Update Ranking Logic: Assign Ranks based on Combined Score
  const rankedUsers: UserStandingEntry[] = []; // Use new return type
  if (sortedUserScores.length > 0) {
    let currentRank = 1;
    // Add the first user with rank 1
    rankedUsers.push({ ...sortedUserScores[0], rank: currentRank });

    for (let i = 1; i < sortedUserScores.length; i++) {
      // Compare combined_total_score for tie handling
      if (sortedUserScores[i].combined_total_score < sortedUserScores[i - 1].combined_total_score) {
        currentRank = i + 1;
      }
      // Add user with potentially updated rank
      rankedUsers.push({ ...sortedUserScores[i], rank: currentRank });
    }
  }
  // logger.info({ rankedUserCount: rankedUsers.length }, 'Successfully assigned ranks to users based on combined score.');
  console.log('[INFO]', { rankedUserCount: rankedUsers.length }, 'Successfully assigned ranks to users based on combined score.');

  // logger.info('Standings calculation complete.');
  console.log('[INFO] Standings calculation complete.');
  return rankedUsers; // Return the new structure
}

export async function calculateStandings(): Promise<UserStandingEntry[] | null> { // Updated return type
  // logger.info('Calculating standings...');
  console.log('[INFO] Calculating standings...');
  const userPoints = await aggregateUserPoints(); // Gets { user_id, total_points (game) }[] | null

  if (!userPoints) {
    // logger.error('Standings calculation failed because user game points could not be aggregated.');
    console.error('[ERROR] Standings calculation failed because user game points could not be aggregated.');
    return null;
  }

  // Get dynamic points
  const dynamicPointsMap = await getUserDynamicQuestionnairePoints(); // Gets Map<string, number> | null
  
  // Use the extracted function for the rest of the logic
  return calculateStandingsWithDynamicPoints(userPoints, dynamicPointsMap);

// No replacement needed, this section was moved to calculateStandingsWithDynamicPoints
}

// Helper interface for the shape of data from user_round_dynamic_points
interface UserRoundDynamicPointsRow {
  user_id: string;
  dynamic_points: number;
}

// --- NEW FUNCTION ---
/**
 * Fetches the most recent dynamic questionnaire points for all users.
 * It identifies the latest betting round marked as 'scored', then retrieves
 * the stored dynamic points for all users from that round.
 *
 * @returns {Promise<Map<string, number> | null>} A promise resolving to a Map of user_id to total_points,
 *          an empty Map if no scored rounds are found, or null on critical error.
 */
export async function getUserDynamicQuestionnairePoints(): Promise<Map<string, number> | null> {
  const loggerContext = { service: 'StandingsService', function: 'getUserDynamicQuestionnairePoints' };
  // logger.info(loggerContext, 'Attempting to fetch dynamic questionnaire points...');
  console.log('[INFO]', loggerContext, 'Attempting to fetch dynamic questionnaire points...');
  const client = getSupabaseServiceRoleClient();

  try {
    // Step 1: Find the most recently scored round_id
    // logger.debug(loggerContext, "Fetching most recently scored round...");
    console.debug('[DEBUG]', loggerContext, "Fetching most recently scored round...");
    const { data: roundData, error: roundError } = await client
      .from('betting_rounds')
      .select('id, scored_at') // Select scored_at for ordering
      .eq('status', 'scored')
      .order('scored_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (roundError) {
      if (roundError.code === 'PGRST116') { // No rows found
        // logger.info(loggerContext, 'No betting rounds with status "scored" found. Returning empty map for dynamic points.');
        console.log('[INFO]', loggerContext, 'No betting rounds with status "scored" found. Returning empty map for dynamic points.');
        return new Map<string, number>();
      }
      // logger.error({ ...loggerContext, error: roundError }, 'Error fetching most recently scored round.');
      console.error('[ERROR]', { ...loggerContext, error: roundError }, 'Error fetching most recently scored round.');
      throw roundError; 
    }

    if (!roundData || !roundData.id) {
      // This case should ideally be caught by PGRST116, but as a safeguard:
      // logger.info(loggerContext, 'No scored betting round data found (roundData or roundData.id is null/undefined). Returning empty map.');
      console.log('[INFO]', loggerContext, 'No scored betting round data found (roundData or roundData.id is null/undefined). Returning empty map.');
      return new Map<string, number>();
    }

    const mostRecentScoredRoundId = roundData.id;
    // logger.info({ ...loggerContext, roundId: mostRecentScoredRoundId, scoredAt: roundData.scored_at }, 'Found most recent scored round.');
    console.log('[INFO]', { ...loggerContext, roundId: mostRecentScoredRoundId, scoredAt: roundData.scored_at }, 'Found most recent scored round.');

    // Step 2: Retrieve dynamic points for that round
    // logger.debug({ ...loggerContext, roundId: mostRecentScoredRoundId }, "Fetching dynamic points for round...");
    console.debug('[DEBUG]', { ...loggerContext, roundId: mostRecentScoredRoundId }, "Fetching dynamic points for round...");
    const { data: dynamicPointsData, error: dynamicPointsError } = await client
      .from('user_round_dynamic_points')
      .select('user_id, dynamic_points')
      .eq('betting_round_id', mostRecentScoredRoundId)

    if (dynamicPointsError) {
      // logger.error({ ...loggerContext, error: dynamicPointsError, roundId: mostRecentScoredRoundId }, 'Error fetching dynamic points for round.');
      console.error('[ERROR]', { ...loggerContext, error: dynamicPointsError, roundId: mostRecentScoredRoundId }, 'Error fetching dynamic points for round.');
      throw dynamicPointsError;
    }

    // Step 3: Convert to Map
    const dynamicPointsMap = new Map<string, number>();
    if (dynamicPointsData) {
      for (const entry of dynamicPointsData as unknown as UserRoundDynamicPointsRow[]) { 
        if (entry.user_id && typeof entry.dynamic_points === 'number') {
          dynamicPointsMap.set(entry.user_id, entry.dynamic_points);
        } else {
          // logger.warn({ ...loggerContext, entry }, "Skipping dynamic points entry with missing user_id or non-numeric total_points.");
          console.warn('[WARN]', { ...loggerContext, entry }, "Skipping dynamic points entry with missing user_id or non-numeric dynamic_points.");
        }
      }
    }
    
    // logger.info({ ...loggerContext, count: dynamicPointsMap.size, roundId: mostRecentScoredRoundId }, 'Successfully fetched and mapped dynamic points.');
    console.log('[INFO]', { ...loggerContext, count: dynamicPointsMap.size, roundId: mostRecentScoredRoundId }, 'Successfully fetched and mapped dynamic points.');
    return dynamicPointsMap;

  } catch (error) {
    // logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to get user dynamic questionnaire points.');
    console.error('[ERROR]', { ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to get user dynamic questionnaire points.');
    return null; // Indicate critical failure
  }
}
// --- END NEW FUNCTION --- 