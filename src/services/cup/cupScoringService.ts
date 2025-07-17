import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { cupActivationStatusChecker } from './cupActivationStatusChecker';

/**
 * Cup Scoring Service
 * Handles scoring logic specific to the "Last Round Special" cup competition
 */

export interface CupPointsResult {
  success: boolean;
  message: string;
  details?: {
    pointsCalculated?: number;
    usersProcessed?: number;
    errors?: string[];
  };
}

export interface CupPointsOptions {
  onlyAfterActivation?: boolean;
}

export interface CupStandingsRow {
  user_id: string;
  total_points: number;
  rounds_participated: number;
  position: number;
  last_updated: string;
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
  const { onlyAfterActivation = true } = options;
  
  logger.info({ bettingRoundId, options }, 'Cup scoring service: calculateRoundCupPoints called');
  
  try {
    const supabase = getSupabaseServiceRoleClient();
    
    // 1. Check if Last Round Special is activated for current season
    const cupStatus = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();
    
    if (!cupStatus.isActivated) {
      if (onlyAfterActivation) {
        logger.info({ bettingRoundId }, 'Cup not activated - skipping cup points calculation');
        return {
          success: true,
          message: 'Cup not activated - skipping cup points calculation',
          details: { pointsCalculated: 0, usersProcessed: 0 }
        };
      } else {
        logger.warn({ bettingRoundId }, 'Cup not activated but proceeding with cup points calculation');
      }
    }

    if (!cupStatus.seasonId) {
      logger.warn({ bettingRoundId }, 'No current season found - cannot calculate cup points');
      return {
        success: false,
        message: 'No current season found',
        details: { errors: ['No current season found'] }
      };
    }

    // 2. Get current season's competition_id
    const { data: currentSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('competition_id')
      .eq('id', cupStatus.seasonId)
      .single();

    if (seasonError || !currentSeason) {
      logger.error({ bettingRoundId, seasonId: cupStatus.seasonId, error: seasonError }, 'Failed to fetch current season competition_id');
      return {
        success: false,
        message: 'Failed to fetch current season competition_id',
        details: { errors: [seasonError?.message || 'Season not found'] }
      };
    }

    // 3. Get betting round info to check if it belongs to current season's competition
    const { data: bettingRound, error: roundError } = await supabase
      .from('betting_rounds')
      .select('id, competition_id, status, name')
      .eq('id', bettingRoundId)
      .single();

    if (roundError || !bettingRound) {
      logger.error({ bettingRoundId, error: roundError }, 'Failed to fetch betting round');
      return {
        success: false,
        message: 'Failed to fetch betting round',
        details: { errors: [roundError?.message || 'Betting round not found'] }
      };
    }

    // 4. Verify this round belongs to the current season's competition
    if (bettingRound.competition_id !== currentSeason.competition_id) {
      logger.info({ 
        bettingRoundId, 
        roundCompetitionId: bettingRound.competition_id, 
        currentCompetitionId: currentSeason.competition_id 
      }, 'Betting round is not from current season competition - skipping cup points');
      return {
        success: true,
        message: 'Betting round is not from current season competition',
        details: { pointsCalculated: 0, usersProcessed: 0 }
      };
    }

    // 5. Check if round is scored (has points to copy)
    if (bettingRound.status !== 'scored') {
      logger.info({ bettingRoundId, status: bettingRound.status }, 'Betting round not scored yet - cannot calculate cup points');
      return {
        success: true,
        message: 'Betting round not scored yet',
        details: { pointsCalculated: 0, usersProcessed: 0 }
      };
    }

    // 6. Get all user bets with awarded points for this round
    const { data: userBets, error: betsError } = await supabase
      .from('user_bets')
      .select('user_id, points_awarded')
      .eq('betting_round_id', bettingRoundId)
      .not('points_awarded', 'is', null);

    if (betsError) {
      logger.error({ bettingRoundId, error: betsError }, 'Failed to fetch user bets');
      return {
        success: false,
        message: 'Failed to fetch user bets',
        details: { errors: [betsError.message] }
      };
    }

    if (!userBets || userBets.length === 0) {
      logger.info({ bettingRoundId }, 'No scored user bets found for this round');
      return {
        success: true,
        message: 'No scored user bets found',
        details: { pointsCalculated: 0, usersProcessed: 0 }
      };
    }

    // 7. Aggregate points per user (sum all points for this round)
    const userPointsMap = new Map<string, number>();
    userBets.forEach(bet => {
      const userId = bet.user_id;
      const points = bet.points_awarded || 0;
      userPointsMap.set(userId, (userPointsMap.get(userId) || 0) + points);
    });

    // 8. Prepare cup points records
    const cupPointsRecords = Array.from(userPointsMap.entries()).map(([userId, points]) => ({
      user_id: userId,
      betting_round_id: bettingRoundId,
      season_id: cupStatus.seasonId!,
      points
    }));

    // 9. Insert/upsert cup points (handle idempotency)
    const { error: insertError } = await supabase
      .from('user_last_round_special_points')
      .upsert(cupPointsRecords, {
        onConflict: 'user_id,betting_round_id,season_id',
        ignoreDuplicates: false
      });

    if (insertError) {
      logger.error({ bettingRoundId, error: insertError }, 'Failed to insert cup points');
      return {
        success: false,
        message: 'Failed to insert cup points',
        details: { errors: [insertError.message] }
      };
    }

    const totalPoints = Array.from(userPointsMap.values()).reduce((sum, points) => sum + points, 0);
    const usersProcessed = userPointsMap.size;

    logger.info({ 
      bettingRoundId, 
      usersProcessed, 
      totalPoints,
      roundName: bettingRound.name,
      seasonId: cupStatus.seasonId,
      competitionId: currentSeason.competition_id
    }, 'Cup points calculation completed successfully');

    return {
      success: true,
      message: `Cup points calculated successfully for ${usersProcessed} users`,
      details: { 
        pointsCalculated: totalPoints, 
        usersProcessed 
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ bettingRoundId, error: errorMessage }, 'Cup points calculation failed');
    
    return {
      success: false,
      message: 'Cup points calculation failed',
      details: { errors: [errorMessage] }
    };
  }
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