import 'server-only';
import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { calculateStandings } from './standingsService';

type DatabaseClient = SupabaseClient<Database>;

export interface SeasonWinner {
  user_id: string;
  username?: string;
  game_points: number;
  dynamic_points: number;
  total_points: number;
  rank: number;
  is_tied: boolean;
}

export interface WinnerDeterminationResult {
  seasonId: number;
  winners: SeasonWinner[];
  totalPlayers: number;
  isSeasonAlreadyDetermined: boolean;
  errors: Error[];
}

/**
 * Service responsible for determining season winners based on final standings
 * and recording them in the Hall of Fame (season_winners table).
 * 
 * This service:
 * - Uses the existing standings calculation logic
 * - Identifies users with rank 1 (handles ties for first place)
 * - Records winners in the season_winners table with idempotency
 * - Updates the season with winner_determined_at timestamp
 * - Provides detailed winner information including tie status
 */
export class WinnerDeterminationService {
  private client: DatabaseClient;

  constructor(client?: DatabaseClient) {
    this.client = client || getSupabaseServiceRoleClient();
  }

  /**
   * Determines winners for a specific season and records them in the Hall of Fame.
   * 
   * @param seasonId - The ID of the season to determine winners for
   * @returns Promise<WinnerDeterminationResult> - Detailed result including winners and metadata
   */
  async determineSeasonWinners(seasonId: number): Promise<WinnerDeterminationResult> {
    const loggerContext = { service: 'WinnerDeterminationService', function: 'determineSeasonWinners', seasonId };
    logger.info(loggerContext, 'Starting winner determination for season');

    const result: WinnerDeterminationResult = {
      seasonId,
      winners: [],
      totalPlayers: 0,
      isSeasonAlreadyDetermined: false,
      errors: []
    };

    try {
      // 1. Check if winners have already been determined for this season
      try {
        const existingWinners = await this.getExistingWinners(seasonId);
        if (existingWinners.length > 0) {
          logger.info({ ...loggerContext, winnerCount: existingWinners.length }, 'Season winners already determined, returning existing results');
          result.isSeasonAlreadyDetermined = true;
          result.winners = existingWinners;
          return result;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error({ ...loggerContext, error: errorObj.message }, 'Error checking existing winners');
        result.errors.push(errorObj);
        return result;
      }

      // 2. Calculate current standings
      logger.debug(loggerContext, 'Calculating final standings for season');
      const standings = await calculateStandings();
      if (!standings || standings.length === 0) {
        const error = new Error('Failed to calculate standings or no players found');
        logger.error({ ...loggerContext, error: error.message }, 'Cannot determine winners without standings');
        result.errors.push(error);
        return result;
      }

      result.totalPlayers = standings.length;
      logger.debug({ ...loggerContext, totalPlayers: result.totalPlayers }, 'Calculated standings for season');

      // 3. Identify winners (all users with rank 1)
      const topRankUsers = standings.filter(user => user.rank === 1);
      if (topRankUsers.length === 0) {
        const error = new Error('No users with rank 1 found in standings');
        logger.error({ ...loggerContext, error: error.message }, 'Unexpected ranking result');
        result.errors.push(error);
        return result;
      }

      // 4. Transform to winner format
      const isTied = topRankUsers.length > 1;
      const winners: SeasonWinner[] = topRankUsers.map(user => ({
        user_id: user.user_id,
        username: user.username,
        game_points: user.game_points,
        dynamic_points: user.dynamic_points,
        total_points: user.combined_total_score,
        rank: user.rank,
        is_tied: isTied
      }));

      logger.info({ 
        ...loggerContext, 
        winnerCount: winners.length,
        isTied,
        totalPoints: winners[0]?.total_points,
        winnerNames: winners.map(w => w.username).filter(Boolean)
      }, `Identified ${winners.length} season winner${winners.length > 1 ? 's' : ''}${isTied ? ' (tied for first place)' : ''}`);

      // 5. Record winners in the Hall of Fame
      try {
        await this.recordWinnersInHallOfFame(seasonId, winners);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error({ ...loggerContext, error: errorObj.message }, 'Error recording winners');
        result.errors.push(errorObj);
        return result;
      }

      // 6. Update season with winner_determined_at timestamp
      try {
        await this.updateSeasonWinnerTimestamp(seasonId);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error({ ...loggerContext, error: errorObj.message }, 'Error updating season timestamp');
        result.errors.push(errorObj);
        return result;
      }

      result.winners = winners;
      logger.info({ ...loggerContext, winnerCount: winners.length }, 'Successfully determined and recorded season winners');
      
      return result;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error({ ...loggerContext, error: errorObj.message, stack: errorObj.stack }, 'Failed to determine season winners');
      result.errors.push(errorObj);
      return result;
    }
  }

  /**
   * Checks if winners have already been determined for a season.
   * 
   * @param seasonId - The season ID to check
   * @returns Promise<SeasonWinner[]> - Existing winners if already determined
   */
  private async getExistingWinners(seasonId: number): Promise<SeasonWinner[]> {
    const loggerContext = { service: 'WinnerDeterminationService', function: 'getExistingWinners', seasonId };
    logger.debug(loggerContext, 'Checking for existing season winners');

    try {
      const { data, error } = await this.client
        .from('season_winners')
        .select(`
          user_id,
          game_points,
          dynamic_points,
          total_points,
          profiles (
            full_name
          )
        `)
        .eq('season_id', seasonId)
        .order('total_points', { ascending: false });

      if (error) {
        const errorMessage = error.message || String(error);
        logger.error({ ...loggerContext, error: errorMessage }, 'Error checking existing winners');
        throw new Error(errorMessage);
      }

      if (!data || data.length === 0) {
        logger.debug(loggerContext, 'No existing winners found for season');
        return [];
      }

      const winners: SeasonWinner[] = data.map((winner) => ({
        user_id: winner.user_id,
        username: winner.profiles?.full_name || undefined,
        game_points: winner.game_points,
        dynamic_points: winner.dynamic_points,
        total_points: winner.total_points,
        rank: 1, // All existing winners are rank 1
        is_tied: data.length > 1 // Tied if more than one winner
      }));

      logger.debug({ ...loggerContext, winnerCount: winners.length }, 'Found existing season winners');
      return winners;

    } catch (error) {
      logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to check existing winners');
      throw error;
    }
  }

  /**
   * Records season winners in the season_winners table with idempotency.
   * 
   * @param seasonId - The season ID
   * @param winners - Array of season winners to record
   */
  private async recordWinnersInHallOfFame(seasonId: number, winners: SeasonWinner[]): Promise<void> {
    const loggerContext = { service: 'WinnerDeterminationService', function: 'recordWinnersInHallOfFame', seasonId };
    logger.debug({ ...loggerContext, winnerCount: winners.length }, 'Recording winners in Hall of Fame');

    try {
      // Get the league_id from the season
      const { data: seasonData, error: seasonError } = await this.client
        .from('seasons')
        .select('competition_id')
        .eq('id', seasonId)
        .single();

      if (seasonError || !seasonData) {
        throw new Error(`Failed to get league_id for season ${seasonId}: ${seasonError?.message || 'Season not found'}`);
      }

      const winnerRecords = winners.map(winner => ({
        season_id: seasonId,
        league_id: seasonData.competition_id,
        user_id: winner.user_id,
        game_points: winner.game_points,
        dynamic_points: winner.dynamic_points,
        total_points: winner.total_points
      }));

      // Use upsert to handle idempotency
      const { error } = await this.client
        .from('season_winners')
        .upsert(winnerRecords, {
          onConflict: 'season_id,user_id',
          ignoreDuplicates: false // Update existing records with new data
        });

      if (error) {
        const errorMessage = error.message || String(error);
        logger.error({ ...loggerContext, error: errorMessage }, 'Error recording winners in Hall of Fame');
        throw new Error(errorMessage);
      }

      logger.info({ ...loggerContext, winnerCount: winners.length }, 'Successfully recorded winners in Hall of Fame');

    } catch (error) {
      logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to record winners in Hall of Fame');
      throw error;
    }
  }

  /**
   * Updates the season record with winner_determined_at timestamp.
   * 
   * @param seasonId - The season ID to update
   */
  private async updateSeasonWinnerTimestamp(seasonId: number): Promise<void> {
    const loggerContext = { service: 'WinnerDeterminationService', function: 'updateSeasonWinnerTimestamp', seasonId };
    logger.debug(loggerContext, 'Updating season winner timestamp');

    try {
      const { error } = await this.client
        .from('seasons')
        .update({ winner_determined_at: new Date().toISOString() })
        .eq('id', seasonId);

      if (error) {
        const errorMessage = error.message || String(error);
        logger.error({ ...loggerContext, error: errorMessage }, 'Error updating season winner timestamp');
        throw new Error(errorMessage);
      }

      logger.info(loggerContext, 'Successfully updated season winner timestamp');

    } catch (error) {
      logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to update season winner timestamp');
      throw error;
    }
  }

  /**
   * Determines winners for multiple seasons that have been marked as completed
   * but don't have winners determined yet.
   * 
   * @returns Promise<WinnerDeterminationResult[]> - Array of results for each season processed
   */
  async determineWinnersForCompletedSeasons(): Promise<WinnerDeterminationResult[]> {
    const loggerContext = { service: 'WinnerDeterminationService', function: 'determineWinnersForCompletedSeasons' };
    logger.info(loggerContext, 'Starting winner determination for completed seasons');

    const results: WinnerDeterminationResult[] = [];

    try {
      // Find seasons that are completed but don't have winners determined
      const { data: completedSeasons, error } = await this.client
        .from('seasons')
        .select('id, name, completed_at')
        .not('completed_at', 'is', null)
        .is('winner_determined_at', null)
        .order('completed_at', { ascending: true });

      if (error) {
        const errorMessage = error.message || String(error);
        logger.error({ ...loggerContext, error: errorMessage }, 'Error fetching completed seasons');
        throw new Error(errorMessage);
      }

      if (!completedSeasons || completedSeasons.length === 0) {
        logger.info(loggerContext, 'No completed seasons found that need winner determination');
        return results;
      }

      logger.info({ ...loggerContext, seasonCount: completedSeasons.length }, 'Found completed seasons that need winner determination');

      // Process each season
      for (const season of completedSeasons) {
        try {
          logger.info({ ...loggerContext, seasonId: season.id, seasonName: season.name }, 'Processing season winner determination');
          const result = await this.determineSeasonWinners(season.id);
          results.push(result);
          
          if (result.errors.length > 0) {
            logger.warn({ ...loggerContext, seasonId: season.id, errorCount: result.errors.length }, 'Season processed with errors');
          }
        } catch (error) {
          logger.error({ ...loggerContext, seasonId: season.id, error: error instanceof Error ? error.message : String(error) }, 'Failed to process season winner determination');
          results.push({
            seasonId: season.id,
            winners: [],
            totalPlayers: 0,
            isSeasonAlreadyDetermined: false,
            errors: [error instanceof Error ? error : new Error(String(error))]
          });
        }
      }

      const successfulSeasons = results.filter(r => r.errors.length === 0);
      const failedSeasons = results.filter(r => r.errors.length > 0);

      logger.info({ 
        ...loggerContext, 
        totalSeasons: results.length,
        successfulSeasons: successfulSeasons.length,
        failedSeasons: failedSeasons.length
      }, 'Completed winner determination for all seasons');

      return results;

    } catch (error) {
      logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error) }, 'Failed to determine winners for completed seasons');
      throw error;
    }
  }
} 