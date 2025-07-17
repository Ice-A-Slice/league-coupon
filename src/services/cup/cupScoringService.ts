import { logger } from '@/utils/logger';

/**
 * Cup Scoring Service
 * Handles scoring logic specific to the "Last Round Special" cup competition
 */

export interface CupPointsResult {
  success: boolean;
  message: string;
  details?: {
    pointsCalculated?: number;
    errors?: string[];
  };
}

export interface CupStandingsRow {
  user_id: string;
  total_points: number;
  rounds_participated: number;
  position: number;
  last_updated: string;
}

export interface CupPointsOptions {
  onlyAfterActivation?: boolean;
}

/**
 * Calculate and store cup points for a specific betting round
 * @param bettingRoundId The ID of the betting round to process
 * @param options Configuration options for cup points calculation
 * @returns Promise<CupPointsResult>
 */
export async function calculateRoundCupPoints(
  bettingRoundId: number,
  options: CupPointsOptions = {}
): Promise<CupPointsResult> {
  logger.info({ bettingRoundId, options }, 'Cup scoring service: calculateRoundCupPoints called (stub implementation)');
  
  // TODO: Implement actual cup points calculation logic
  // For now, return success to avoid breaking the main scoring flow
  return {
    success: true,
    message: `Cup points calculation for round ${bettingRoundId} completed (stub implementation)`,
    details: {
      pointsCalculated: 0
    }
  };
}

/**
 * Get cup standings for a specific season
 * @param seasonId The ID of the season to get standings for (uses current season if not provided)
 * @returns Promise<CupStandingsRow[]>
 */
export async function getCupStandings(seasonId?: number): Promise<CupStandingsRow[]> {
  logger.info({ seasonId }, 'Cup scoring service: getCupStandings called');
  
  try {
    // Import here to avoid circular dependencies
    const { CupWinnerDeterminationService } = await import('./cupWinnerDeterminationService');
    const { getSupabaseServiceRoleClient } = await import('@/utils/supabase/service');
    
    // Get current season if not provided
    let targetSeasonId = seasonId;
    if (!targetSeasonId) {
      const client = getSupabaseServiceRoleClient();
      const { data: currentSeason, error } = await client
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();
        
      if (error || !currentSeason) {
        logger.warn('No current season found, returning empty standings');
        return [];
      }
      targetSeasonId = currentSeason.id;
    }
    
    // Use the existing CupWinnerDeterminationService to get standings
    const service = new CupWinnerDeterminationService();
    const standingsResult = await service.calculateCupStandings(targetSeasonId);
    
    if (standingsResult.errors.length > 0) {
      logger.error({ 
        seasonId: targetSeasonId, 
        errors: standingsResult.errors.map(e => e.message) 
      }, 'Errors calculating cup standings');
      return [];
    }
    
    // Convert to the expected format for the API
    const standings: CupStandingsRow[] = standingsResult.standings.map((entry, index) => ({
      user_id: entry.user_id,
      total_points: entry.total_points,
      rounds_participated: entry.rounds_participated,
      position: entry.rank,
      last_updated: new Date().toISOString()
    }));
    
    logger.info({ 
      seasonId: targetSeasonId,
      standingsCount: standings.length,
      totalParticipants: standingsResult.totalParticipants
    }, 'Cup standings retrieved successfully');
    
    return standings;
    
  } catch (error) {
    logger.error({ 
      seasonId,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to get cup standings');
    return [];
  }
} 