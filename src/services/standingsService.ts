import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

// Define the structure for the aggregated points data
export interface UserPoints {
  user_id: string;
  total_points: number; // This is game_points from the RPC
  full_name?: string;   // Added for profile information
}

/**
 * Aggregates total points for each user from the user_bets table.
 * This function will be the first step in calculating overall standings.
 * 
 * @returns {Promise<UserPoints[] | null>} A promise resolving to an array of users 
 *          with their total points, or null on error.
 */
export async function aggregateUserPoints(): Promise<UserPoints[] | null> {
  logger.info('Aggregating total points per user via RPC and joining with profiles...');
  const serviceRoleClient = createSupabaseServiceRoleClient();

  try {
    // 1. Fetch game points from the RPC (only users with scored points)
    const { data: rpcPointsData, error: rpcError } = await serviceRoleClient.rpc(
      'get_user_total_points'
    );

    if (rpcError) {
      logger.error({ error: rpcError }, 'Error calling get_user_total_points RPC.');
      throw rpcError;
    }

    const gamePointsMap = new Map<string, number>();
    if (rpcPointsData) {
      for (const entry of rpcPointsData) {
        if (entry.user_id && typeof entry.total_points === 'number') {
          gamePointsMap.set(entry.user_id, entry.total_points);
        }
      }
    }
    logger.debug({ count: gamePointsMap.size }, 'Fetched game points from RPC.');

    // 2. Fetch all users who have placed bets (including those with unscored bets)
    const { data: bettorsData, error: bettorsError } = await serviceRoleClient
      .from('user_bets')
      .select('user_id');

    if (bettorsError) {
      logger.error({ error: bettorsError }, 'Error fetching users who have placed bets.');
      throw bettorsError;
    }

    const allUserIds = new Set<string>();
    
    // Add users with points
    gamePointsMap.forEach((points, userId) => {
      allUserIds.add(userId);
    });
    
    // Add users who have placed bets (even without points)
    if (bettorsData) {
      bettorsData.forEach(bettor => {
        if (bettor.user_id) {
          allUserIds.add(bettor.user_id);
        }
      });
    }

    logger.debug({ count: allUserIds.size }, 'Found total unique users (with points or bets).');

    // 3. Fetch profiles for all these users
    const { data: profilesData, error: profilesError } = await serviceRoleClient
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(allUserIds));

    if (profilesError) {
      logger.error({ error: profilesError }, 'Error fetching profiles.');
      throw profilesError;
    }

    // Create a profile map for quick lookup
    const profilesMap = new Map<string, string | null>();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile.full_name);
      });
    }

    // 4. Combine all data
    const aggregatedData: UserPoints[] = Array.from(allUserIds).map(userId => ({
      user_id: userId,
      full_name: profilesMap.get(userId) || undefined,
      total_points: gamePointsMap.get(userId) || 0, // Default to 0 if no points yet
    }));
    
    logger.info({ count: aggregatedData.length }, 'Successfully aggregated user points with profiles.');
    return aggregatedData;

  } catch (error) {
    logger.error({ error }, 'An unexpected error occurred in aggregateUserPoints.');
    return null;
  }
}

// Define the structure for a single entry in the standings
export interface UserStandingEntry {
  user_id: string;
  username?: string;    // For display, maps from full_name
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
  rank: number;
}

// Function to calculate overall standings by combining game points and dynamic points
export async function calculateStandings(): Promise<UserStandingEntry[] | null> {
  const loggerContext = { function: 'calculateStandings' };
  logger.info(loggerContext, 'Calculating overall standings...');

  try {
    // 1. Get aggregated game points (which now include profile data like full_name)
    const gamePointsData = await aggregateUserPoints();
    if (!gamePointsData) {
      logger.error(loggerContext, 'Failed to aggregate game points (which include profile data). Cannot calculate standings.');
      return null;
    }
    logger.debug({ ...loggerContext, count: gamePointsData.length }, 'Retrieved aggregated game points with profile data.');

    // 2. Get dynamic points for the latest scored round
    const dynamicPointsMap = await getUserDynamicQuestionnairePoints();
    // Note: getUserDynamicQuestionnairePoints handles its own logging for success/failure/empty states
    // It returns null on error, or an empty Map if no data/no scored rounds.

    const combinedScores: Array<Omit<UserStandingEntry, 'rank'> & { preliminary_rank?: number }> = [];
    const allUserIds = new Set<string>();

    // Add all users from profiles (via gamePointsData) to ensure everyone is listed
    gamePointsData.forEach(user => allUserIds.add(user.user_id));
    // Add all users who might only have dynamic points (though less likely with current logic)
    dynamicPointsMap?.forEach((_points, userId) => allUserIds.add(userId));

    allUserIds.forEach(userId => {
      const userProfileAndGamePoints = gamePointsData.find(gp => gp.user_id === userId);
      const gameP = userProfileAndGamePoints?.total_points || 0;
      const userFullName = userProfileAndGamePoints?.full_name;
      const dynamicP = dynamicPointsMap?.get(userId) || 0;

      combinedScores.push({
        user_id: userId,
        username: userFullName,          // Use full_name from profiles
        game_points: gameP,
        dynamic_points: dynamicP,
        combined_total_score: gameP + dynamicP,
      });
    });
    
    logger.debug({ ...loggerContext, count: combinedScores.length }, 'Successfully combined scores for all users.');

    // Sort by combined_total_score descending, then by game_points, then by user_id as a tie-breaker
    combinedScores.sort((a, b) => {
      if (b.combined_total_score !== a.combined_total_score) {
        return b.combined_total_score - a.combined_total_score;
      }
      if (b.game_points !== a.game_points) {
        return b.game_points - a.game_points;
      }
      // Fallback tie-breaker, e.g., by user_id or username if available
      return a.user_id.localeCompare(b.user_id); 
    });

    // Assign ranks
    const finalStandings: UserStandingEntry[] = [];
    if (combinedScores.length > 0) {
      finalStandings.push({ ...combinedScores[0], rank: 1 }); // First user always rank 1
      for (let i = 1; i < combinedScores.length; i++) {
        let rank = i + 1;
        const currentUser = combinedScores[i];
        const previousUserInCombined = combinedScores[i-1]; // For score comparison
        // Correctly refer to the rank of the previously processed user in finalStandings
        const previousUserInFinal = finalStandings[i-1]; 

        if (currentUser.combined_total_score === previousUserInCombined.combined_total_score &&
            currentUser.game_points === previousUserInCombined.game_points) {
          rank = previousUserInFinal.rank; 
        }
        finalStandings.push({ ...currentUser, rank });
      }
    }

    logger.info({ ...loggerContext, count: finalStandings.length }, 'Successfully calculated and ranked standings.');
    return finalStandings;

  } catch (error) {
    logger.error({ ...loggerContext, error }, 'An unexpected error occurred in calculateStandings.');
    return null;
  }
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
  logger.info(loggerContext, 'Attempting to fetch dynamic questionnaire points...');
  // console.log('[INFO]', loggerContext, 'Attempting to fetch dynamic questionnaire points...');
  const client = createSupabaseServiceRoleClient();

  try {
    // Step 1: Find the most recently scored round_id
    logger.debug(loggerContext, "Fetching most recently scored round...");
    // console.debug('[DEBUG]', loggerContext, "Fetching most recently scored round...");
    const { data: roundData, error: roundError } = await client
      .from('betting_rounds')
      .select('id, scored_at') // Select scored_at for ordering
      .eq('status', 'scored')
      .order('scored_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (roundError) {
      if (roundError.code === 'PGRST116') { // No rows found
        logger.info(loggerContext, 'No betting rounds with status "scored" found. Returning empty map for dynamic points.');
        // console.log('[INFO]', loggerContext, 'No betting rounds with status "scored" found. Returning empty map for dynamic points.');
        return new Map<string, number>();
      }
      logger.error({ ...loggerContext, error: roundError }, 'Error fetching most recently scored round.');
      // console.error('[ERROR]', { ...loggerContext, error: roundError }, 'Error fetching most recently scored round.');
      throw roundError; 
    }

    if (!roundData || !roundData.id) {
      // This case should ideally be caught by PGRST116, but as a safeguard:
      logger.info(loggerContext, 'No scored betting round data found (roundData or roundData.id is null/undefined). Returning empty map.');
      // console.log('[INFO]', loggerContext, 'No scored betting round data found (roundData or roundData.id is null/undefined). Returning empty map.');
      return new Map<string, number>();
    }

    const mostRecentScoredRoundId = roundData.id;
    logger.info({ ...loggerContext, roundId: mostRecentScoredRoundId, scoredAt: roundData.scored_at }, 'Found most recent scored round.');
    // console.log('[INFO]', { ...loggerContext, roundId: mostRecentScoredRoundId, scoredAt: roundData.scored_at }, 'Found most recent scored round.');

    // Step 2: Retrieve dynamic points for that round
    logger.debug({ ...loggerContext, roundId: mostRecentScoredRoundId }, "Fetching dynamic points for round...");
    // console.debug('[DEBUG]', { ...loggerContext, roundId: mostRecentScoredRoundId }, "Fetching dynamic points for round...");
    const { data: dynamicPointsData, error: dynamicPointsError } = await client
      .from('user_round_dynamic_points')
      .select('user_id, dynamic_points')
      .eq('betting_round_id', mostRecentScoredRoundId)

    if (dynamicPointsError) {
      logger.error({ ...loggerContext, error: dynamicPointsError, roundId: mostRecentScoredRoundId }, 'Error fetching dynamic points for round.');
      // console.error('[ERROR]', { ...loggerContext, error: dynamicPointsError, roundId: mostRecentScoredRoundId }, 'Error fetching dynamic points for round.');
      throw dynamicPointsError;
    }

    // Step 3: Convert to Map
    const dynamicPointsMap = new Map<string, number>();
    if (dynamicPointsData) {
      for (const entry of dynamicPointsData as unknown as UserRoundDynamicPointsRow[]) { 
        if (entry.user_id && typeof entry.dynamic_points === 'number') {
          dynamicPointsMap.set(entry.user_id, entry.dynamic_points);
        } else {
          logger.warn({ ...loggerContext, entry }, "Skipping dynamic points entry with missing user_id or non-numeric dynamic_points.");
          // console.warn('[WARN]', { ...loggerContext, entry }, "Skipping dynamic points entry with missing user_id or non-numeric dynamic_points."); // Updated message slightly
        }
      }
    }
    
    logger.info({ ...loggerContext, count: dynamicPointsMap.size, roundId: mostRecentScoredRoundId }, 'Successfully fetched and mapped dynamic points.');
    // console.log('[INFO]', { ...loggerContext, count: dynamicPointsMap.size, roundId: mostRecentScoredRoundId }, 'Successfully fetched and mapped dynamic points.');
    return dynamicPointsMap;

  } catch (error) {
    logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to get user dynamic questionnaire points.');
    // console.error('[ERROR]', { ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to get user dynamic questionnaire points.');
    return null; // Indicate critical failure
  }
}
// --- END NEW FUNCTION --- 