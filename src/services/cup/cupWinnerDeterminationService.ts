import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

/**
 * Cup Winner Determination Service
 * 
 * This service determines winners for the Last Round Special cup competition.
 * It calculates final cup standings, identifies winners (handling ties), and
 * records them in the season_winners table with competition_type='last_round_special'.
 * 
 * Key Features:
 * - Calculates cup standings from user_last_round_special_points table
 * - Handles tie scenarios for cup winners
 * - Implements idempotency to prevent duplicate winner entries
 * - Comprehensive error handling and logging
 * - Follows the same pattern as the main league winner determination
 */

// --- Types and Interfaces ---

export interface CupStandingsEntry {
  user_id: string;
  username?: string;
  total_points: number;
  rounds_participated: number;
  rank: number;
  is_tied: boolean;
}

export interface CupWinner {
  user_id: string;
  username?: string;
  total_points: number;
  rounds_participated: number;
  rank: number;
  is_tied: boolean;
}

export interface CupWinnerDeterminationResult {
  seasonId: number;
  winners: CupWinner[];
  totalParticipants: number;
  isAlreadyDetermined: boolean;
  errors: Error[];
  metadata: {
    maxPoints: number;
    averagePoints: number;
    participationRate: number;
  };
}

export interface CupStandingsCalculationResult {
  standings: CupStandingsEntry[];
  totalParticipants: number;
  maxPoints: number;
  averagePoints: number;
  errors: Error[];
}

type DatabaseClient = SupabaseClient<Database>;

// --- Main Service Class ---

/**
 * Service responsible for determining Last Round Special cup winners
 * and recording them in the Hall of Fame (season_winners table).
 */
export class CupWinnerDeterminationService {
  private client: DatabaseClient;

  constructor(client?: DatabaseClient) {
    this.client = client || createSupabaseServiceRoleClient();
  }

  // --- Subtask 1: Cup Standings Calculator ---

  /**
   * Calculates final standings for the Last Round Special cup for a specific season.
   * Aggregates points from user_last_round_special_points table and ranks users.
   * 
   * @param seasonId - The ID of the season to calculate standings for
   * @returns Promise<CupStandingsCalculationResult> - Standings with metadata
   */
  async calculateCupStandings(seasonId: number): Promise<CupStandingsCalculationResult> {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'calculateCupStandings', 
      seasonId 
    };
    logger.info(loggerContext, 'Starting cup standings calculation');

    const result: CupStandingsCalculationResult = {
      standings: [],
      totalParticipants: 0,
      maxPoints: 0,
      averagePoints: 0,
      errors: []
    };

    try {
      // Query cup points with user profile information
      const { data: cupPointsData, error: cupError } = await this.client
        .from('user_last_round_special_points')
        .select(`
          user_id,
          points,
          betting_round_id,
          profiles (
            full_name
          )
        `)
        .eq('season_id', seasonId);

      if (cupError) {
        const errorMessage = `Failed to fetch cup points data: ${cupError.message}`;
        logger.error({ ...loggerContext, error: errorMessage }, 'Database error fetching cup points');
        result.errors.push(new Error(errorMessage));
        return result;
      }

      if (!cupPointsData || cupPointsData.length === 0) {
        logger.info({ ...loggerContext }, 'No cup participants found for season');
        return result;
      }

      // Aggregate points per user
      const userPointsMap = new Map<string, {
        user_id: string;
        username?: string;
        total_points: number;
        rounds_participated: number;
      }>();

      cupPointsData.forEach(entry => {
        const userId = entry.user_id;
        const points = entry.points || 0;
        const username = entry.profiles?.full_name || undefined;

        if (!userPointsMap.has(userId)) {
          userPointsMap.set(userId, {
            user_id: userId,
            username,
            total_points: 0,
            rounds_participated: 0
          });
        }

        const userEntry = userPointsMap.get(userId)!;
        userEntry.total_points += points;
        userEntry.rounds_participated += 1;
      });

      // Convert to array and sort by total points (descending)
      const aggregatedUsers = Array.from(userPointsMap.values())
        .sort((a, b) => {
          // Primary sort: total points (descending)
          if (b.total_points !== a.total_points) {
            return b.total_points - a.total_points;
          }
          // Secondary sort: username (ascending) for consistent ordering
          const nameA = a.username || '';
          const nameB = b.username || '';
          return nameA.localeCompare(nameB);
        });

      // Assign ranks (handling ties)
      const standings: CupStandingsEntry[] = [];
      let currentRank = 1;

      for (let i = 0; i < aggregatedUsers.length; i++) {
        const user = aggregatedUsers[i];
        const previousUser = i > 0 ? aggregatedUsers[i - 1] : null;

        // If points differ from previous user, update rank
        if (previousUser && user.total_points !== previousUser.total_points) {
          currentRank = i + 1;
        }

        // Check if this user is tied with others at the same rank
        const usersWithSamePoints = aggregatedUsers.filter(u => u.total_points === user.total_points);
        const isTied = usersWithSamePoints.length > 1;

        standings.push({
          user_id: user.user_id,
          username: user.username,
          total_points: user.total_points,
          rounds_participated: user.rounds_participated,
          rank: currentRank,
          is_tied: isTied
        });
      }

      // Calculate metadata
      const totalPoints = standings.reduce((sum, user) => sum + user.total_points, 0);
      const maxPoints = standings.length > 0 ? standings[0].total_points : 0;
      const averagePoints = standings.length > 0 ? totalPoints / standings.length : 0;

      result.standings = standings;
      result.totalParticipants = standings.length;
      result.maxPoints = maxPoints;
      result.averagePoints = Math.round(averagePoints * 100) / 100; // Round to 2 decimal places

      logger.info({
        ...loggerContext,
        totalParticipants: result.totalParticipants,
        maxPoints: result.maxPoints,
        averagePoints: result.averagePoints,
        topUserPoints: standings.slice(0, 3).map(s => ({ user_id: s.user_id, points: s.total_points, rank: s.rank }))
      }, 'Cup standings calculation completed successfully');

      return result;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error({ 
        ...loggerContext, 
        error: errorObj.message, 
        stack: errorObj.stack 
      }, 'Failed to calculate cup standings');
      result.errors.push(errorObj);
      return result;
    }
  }

  // --- Subtask 2: Winner Identification Logic ---

  /**
   * Identifies cup winners from standings, handling tie scenarios appropriately.
   * 
   * @param standings - The calculated cup standings
   * @param numberOfWinners - Maximum number of winners to identify (default: all tied for first)
   * @returns CupWinner[] - Array of winners with tie information
   */
  identifyWinners(standings: CupStandingsEntry[], numberOfWinners: number = Infinity): CupWinner[] {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'identifyWinners',
      standingsCount: standings.length,
      numberOfWinners
    };
    logger.debug(loggerContext, 'Starting winner identification');

    if (!standings || standings.length === 0) {
      logger.info(loggerContext, 'No standings provided, no winners identified');
      return [];
    }

    // Find all users with rank 1 (highest points, handling ties)
    const topRankUsers = standings.filter(user => user.rank === 1);
    
    if (topRankUsers.length === 0) {
      logger.warn(loggerContext, 'No users with rank 1 found in standings');
      return [];
    }

    // If numberOfWinners is specified and less than tied users, log warning but include all tied users
    if (numberOfWinners < topRankUsers.length && numberOfWinners !== Infinity) {
      logger.warn({
        ...loggerContext,
        tiedUsers: topRankUsers.length,
        requestedWinners: numberOfWinners
      }, 'More users tied for first place than requested winners - including all tied users');
    }

    const winners: CupWinner[] = topRankUsers.map(user => ({
      user_id: user.user_id,
      username: user.username,
      total_points: user.total_points,
      rounds_participated: user.rounds_participated,
      rank: user.rank,
      is_tied: user.is_tied
    }));

    logger.info({
      ...loggerContext,
      winnerCount: winners.length,
      isTied: winners.length > 1,
      winnerPoints: winners[0]?.total_points,
      winners: winners.map(w => ({ user_id: w.user_id, username: w.username, points: w.total_points }))
    }, `Identified ${winners.length} cup winner${winners.length > 1 ? 's' : ''}${winners.length > 1 ? ' (tied for first place)' : ''}`);

    return winners;
  }

  // --- Subtask 3 & 4: Database Operations with Idempotency ---

  /**
   * Determines cup winners for a specific season and records them in the Hall of Fame.
   * Implements idempotency to prevent duplicate entries.
   * 
   * @param seasonId - The ID of the season to determine winners for
   * @returns Promise<CupWinnerDeterminationResult> - Detailed result including winners and metadata
   */
  async determineCupWinners(seasonId: number): Promise<CupWinnerDeterminationResult> {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'determineCupWinners', 
      seasonId 
    };
    logger.info(loggerContext, 'Starting cup winner determination');

    const result: CupWinnerDeterminationResult = {
      seasonId,
      winners: [],
      totalParticipants: 0,
      isAlreadyDetermined: false,
      errors: [],
      metadata: {
        maxPoints: 0,
        averagePoints: 0,
        participationRate: 0
      }
    };

    try {
      // 1. Check if cup winners have already been determined (idempotency)
      const existingWinners = await this.getExistingCupWinners(seasonId);
      if (existingWinners.length > 0) {
        logger.info({ 
          ...loggerContext, 
          winnerCount: existingWinners.length 
        }, 'Cup winners already determined, returning existing results');
        result.isAlreadyDetermined = true;
        result.winners = existingWinners;
        return result;
      }

      // 2. Calculate cup standings
      logger.debug(loggerContext, 'Calculating cup standings for winner determination');
      const standingsResult = await this.calculateCupStandings(seasonId);
      
      if (standingsResult.errors.length > 0) {
        logger.error({ 
          ...loggerContext, 
          errorCount: standingsResult.errors.length 
        }, 'Errors occurred during standings calculation');
        result.errors.push(...standingsResult.errors);
        return result;
      }

      if (standingsResult.standings.length === 0) {
        logger.info(loggerContext, 'No cup participants found, no winners to determine');
        return result;
      }

      // 3. Update result metadata
      result.totalParticipants = standingsResult.totalParticipants;
      result.metadata = {
        maxPoints: standingsResult.maxPoints,
        averagePoints: standingsResult.averagePoints,
        participationRate: 100 // All participants in the standings are active participants
      };

      // 4. Identify winners
      const winners = this.identifyWinners(standingsResult.standings);
      if (winners.length === 0) {
        logger.warn(loggerContext, 'No winners identified from standings');
        return result;
      }

      // 5. Record winners in the Hall of Fame
      await this.recordCupWinnersInHallOfFame(seasonId, winners);

      result.winners = winners;
      logger.info({ 
        ...loggerContext, 
        winnerCount: winners.length,
        totalParticipants: result.totalParticipants,
        maxPoints: result.metadata.maxPoints
      }, 'Successfully determined and recorded cup winners');

      return result;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error({ 
        ...loggerContext, 
        error: errorObj.message, 
        stack: errorObj.stack 
      }, 'Failed to determine cup winners');
      result.errors.push(errorObj);
      return result;
    }
  }

  // --- Private Helper Methods ---

  /**
   * Checks if cup winners have already been determined for a season.
   */
  private async getExistingCupWinners(seasonId: number): Promise<CupWinner[]> {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'getExistingCupWinners', 
      seasonId 
    };
    logger.debug(loggerContext, 'Checking for existing cup winners');

    try {
      const { data, error } = await this.client
        .from('season_winners')
        .select(`
          user_id,
          total_points,
          profiles (
            full_name
          )
        `)
        .eq('season_id', seasonId)
        .eq('competition_type', 'last_round_special')
        .order('total_points', { ascending: false });

      if (error) {
        const errorMessage = `Error checking existing cup winners: ${error.message}`;
        logger.error({ ...loggerContext, error: errorMessage }, 'Database error');
        throw new Error(errorMessage);
      }

      if (!data || data.length === 0) {
        logger.debug(loggerContext, 'No existing cup winners found');
        return [];
      }

      const winners: CupWinner[] = data.map((winner) => ({
        user_id: winner.user_id,
        username: winner.profiles?.full_name || undefined,
        total_points: winner.total_points,
        rounds_participated: 0, // Not stored in season_winners table
        rank: 1, // All existing winners are rank 1
        is_tied: data.length > 1 // Tied if more than one winner
      }));

      logger.debug({ 
        ...loggerContext, 
        winnerCount: winners.length 
      }, 'Found existing cup winners');
      return winners;

    } catch (error) {
      logger.error({ 
        ...loggerContext, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Failed to check existing cup winners');
      throw error;
    }
  }

  /**
   * Records cup winners in the season_winners table with idempotency.
   */
  private async recordCupWinnersInHallOfFame(seasonId: number, winners: CupWinner[]): Promise<void> {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'recordCupWinnersInHallOfFame', 
      seasonId 
    };
    logger.debug({ 
      ...loggerContext, 
      winnerCount: winners.length 
    }, 'Recording cup winners in Hall of Fame');

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
        game_points: 0, // Cup doesn't use game_points separation
        dynamic_points: 0, // Cup doesn't use dynamic_points
        total_points: winner.total_points,
        competition_type: 'last_round_special' as const
      }));

      // Use upsert with correct constraint name from test database
      const { error } = await this.client
        .from('season_winners')
        .upsert(winnerRecords, {
          onConflict: 'season_id, user_id, competition_type',
          ignoreDuplicates: false
        });

      if (error) {
        const errorMessage = `Error recording cup winners: ${error.message}`;
        logger.error({ ...loggerContext, error: errorMessage }, 'Database error');
        throw new Error(errorMessage);
      }

      logger.info({ 
        ...loggerContext, 
        winnerCount: winners.length,
        winners: winners.map(w => ({ user_id: w.user_id, points: w.total_points }))
      }, 'Successfully recorded cup winners in Hall of Fame');

    } catch (error) {
      logger.error({ 
        ...loggerContext, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Failed to record cup winners in Hall of Fame');
      throw error;
    }
  }

  // --- Subtask 5: Edge Case Handling ---

  /**
   * Determines cup winners for all completed seasons that have cup activation
   * but don't have cup winners determined yet.
   */
  async determineCupWinnersForCompletedSeasons(): Promise<CupWinnerDeterminationResult[]> {
    const loggerContext = { 
      service: 'CupWinnerDeterminationService', 
      function: 'determineCupWinnersForCompletedSeasons' 
    };
    logger.info(loggerContext, 'Starting cup winner determination for completed seasons');

    const results: CupWinnerDeterminationResult[] = [];

    try {
      // Find seasons that are completed, have cup activated, but don't have cup winners
      const { data: eligibleSeasons, error } = await this.client
        .from('seasons')
        .select(`
          id, 
          name, 
          completed_at,
          last_round_special_activated,
          last_round_special_activated_at
        `)
        .not('completed_at', 'is', null)
        .eq('last_round_special_activated', true)
        .order('completed_at', { ascending: true });

      if (error) {
        const errorMessage = `Error fetching eligible seasons: ${error.message}`;
        logger.error({ ...loggerContext, error: errorMessage }, 'Database error');
        throw new Error(errorMessage);
      }

      if (!eligibleSeasons || eligibleSeasons.length === 0) {
        logger.info(loggerContext, 'No eligible seasons found for cup winner determination');
        return results;
      }

      // Check which seasons already have winners and which need processing
      const seasonsToProcess = [];
      const seasonsAlreadyDetermined = [];
      
      for (const season of eligibleSeasons) {
        const existingWinners = await this.getExistingCupWinners(season.id);
        if (existingWinners.length === 0) {
          seasonsToProcess.push(season);
        } else {
          seasonsAlreadyDetermined.push({ season, existingWinners });
        }
      }

      logger.info({
        ...loggerContext,
        totalEligible: eligibleSeasons.length,
        needProcessing: seasonsToProcess.length,
        alreadyDetermined: seasonsAlreadyDetermined.length
      }, 'Found seasons for cup winner determination');

      // First, add results for seasons that already have winners
      for (const { season, existingWinners } of seasonsAlreadyDetermined) {
        logger.info({
          ...loggerContext,
          seasonId: season.id,
          seasonName: season.name,
          winnerCount: existingWinners.length
        }, 'Season already has cup winners determined');
        
        results.push({
          seasonId: season.id,
          winners: existingWinners,
          totalParticipants: existingWinners.length, // Approximate - we don't have exact count
          isAlreadyDetermined: true,
          errors: [],
          metadata: {
            maxPoints: existingWinners.length > 0 ? existingWinners[0].total_points : 0,
            averagePoints: existingWinners.length > 0 ?
              existingWinners.reduce((sum, w) => sum + w.total_points, 0) / existingWinners.length : 0,
            participationRate: 100 // Approximate
          }
        });
      }

      // Then process seasons that need winner determination
      for (const season of seasonsToProcess) {
        try {
          logger.info({ 
            ...loggerContext, 
            seasonId: season.id, 
            seasonName: season.name 
          }, 'Processing cup winner determination for season');
          
          const result = await this.determineCupWinners(season.id);
          results.push(result);
          
          if (result.errors.length > 0) {
            logger.warn({ 
              ...loggerContext, 
              seasonId: season.id, 
              errorCount: result.errors.length 
            }, 'Season processed with errors');
          }
        } catch (error) {
          logger.error({ 
            ...loggerContext, 
            seasonId: season.id, 
            error: error instanceof Error ? error.message : String(error) 
          }, 'Failed to process season cup winner determination');
          
          results.push({
            seasonId: season.id,
            winners: [],
            totalParticipants: 0,
            isAlreadyDetermined: false,
            errors: [error instanceof Error ? error : new Error(String(error))],
            metadata: { maxPoints: 0, averagePoints: 0, participationRate: 0 }
          });
        }
      }

      const successfulSeasons = results.filter(r => r.errors.length === 0);
      const failedSeasons = results.filter(r => r.errors.length > 0);

      logger.info({ 
        ...loggerContext, 
        totalProcessed: results.length,
        successful: successfulSeasons.length,
        failed: failedSeasons.length
      }, 'Completed cup winner determination for all eligible seasons');

      return results;

    } catch (error) {
      logger.error({ 
        ...loggerContext, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Failed to determine cup winners for completed seasons');
      throw error;
    }
  }
} 