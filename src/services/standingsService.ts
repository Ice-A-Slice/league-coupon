import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

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
  logger.info('Aggregating total points per user via RPC...');
  const serviceRoleClient = getSupabaseServiceRoleClient();

  try {
    // Call the PostgreSQL function 'get_user_total_points' via RPC
    const { data, error } = await serviceRoleClient.rpc('get_user_total_points');

    if (error) {
      logger.error({ error }, 'Error calling get_user_total_points RPC.');
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

    logger.info({ userCount: userPointsResult.length }, 'Successfully aggregated points via RPC.');
    return userPointsResult;

  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to aggregate user points.');
    return null; // Indicate failure
  }
}

// Placeholder for the main standings calculation function that will use aggregateUserPoints
// and then implement sorting, ranking, etc.
export async function calculateStandings() {
  logger.info('Calculating standings...');
  const userPoints = await aggregateUserPoints();

  if (!userPoints) {
    logger.error('Standings calculation failed because user points could not be aggregated.');
    return null; 
  }

  // TODO: Implement Subtask 13.2 (Sort Users by Total Points)
  // TODO: Implement Subtask 13.3 (Assign Ranks with Tie Handling)
  // TODO: Implement Subtask 13.4 (Package and Return Standings Data)

  logger.info('Standings calculation logic (sorting, ranking) not yet implemented.');
  return userPoints; // For now, just return the aggregated points
} 