import 'server-only';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

type DatabaseClient = SupabaseClient<Database>;

export interface RetroactivePointsResult {
  userId: string;
  roundsProcessed: number;
  totalPointsAwarded: number;
  rounds: Array<{
    roundId: number;
    roundName: string;
    pointsAwarded: number;
    minimumParticipantScore: number;
    participantCount: number;
  }>;
  errors: string[];
  warnings?: string[];
}

export interface BulkRetroactivePointsResult {
  totalUsersProcessed: number;
  totalRoundsProcessed: number;
  totalPointsAwarded: number;
  userResults: RetroactivePointsResult[];
  errors: string[];
  warnings?: string[];
}

export interface CompetitionContext {
  competitionId: number;
  competitionName: string;
  seasonId: number;
}

/**
 * Service for handling retroactive points allocation for new competitors
 * who joined after Round 1. Implements the same "lowest score" rule as 
 * the non-participant scoring system, but can be applied retroactively.
 * 
 * Key Design Principles:
 * - Uses same logic as applyNonParticipantScoringRule from scoring.ts
 * - Creates actual user_bets records for consistency
 * - Game points only (not dynamic points)
 * - Competition-scoped processing
 * - Dry-run capability for safe testing
 */
export class RetroactivePointsService {
  private client: DatabaseClient;

  constructor(client?: DatabaseClient) {
    this.client = client || createSupabaseServiceRoleClient();
  }

  /**
   * Apply retroactive points for a specific user for all missed rounds in current competition
   * 
   * @param userId - The user ID to process
   * @param fromRoundId - Optional: Start from specific round (default: Round 1)
   * @param dryRun - If true, calculates points but doesn't insert records
   * @returns Promise<RetroactivePointsResult>
   */
  async applyRetroactivePointsForUser(
    userId: string, 
    fromRoundId?: number,
    dryRun: boolean = false
  ): Promise<RetroactivePointsResult> {
    const loggerContext = { 
      service: 'RetroactivePointsService', 
      function: 'applyRetroactivePointsForUser', 
      userId,
      fromRoundId,
      dryRun
    };
    
    logger.info(loggerContext, 'Starting retroactive points allocation for user');

    const result: RetroactivePointsResult = {
      userId,
      roundsProcessed: 0,
      totalPointsAwarded: 0,
      rounds: [],
      errors: []
    };

    try {
      // 1. Verify user exists
      const userProfile = await this.verifyUserExists(userId);
      if (!userProfile.exists) {
        result.errors.push(`User ${userId} not found in profiles table`);
        logger.error({ ...loggerContext, error: result.errors[0] }, 'User not found');
        return result;
      }

      logger.info({ ...loggerContext, userCreatedAt: userProfile.createdAt }, 'Found user profile');

      // 2. Get competition context (assumes single competition for now, multi-competition ready)
      const competitionContext = await this.getCurrentCompetitionContext();
      if (!competitionContext) {
        result.errors.push('No active competition found');
        logger.error({ ...loggerContext }, 'No active competition found');
        return result;
      }

      // 3. Get all scored rounds that the user missed in this competition
      const missedRounds = await this.getMissedRoundsInCompetition(
        userId, 
        competitionContext.competitionId, 
        fromRoundId
      );
      
      if (missedRounds.length === 0) {
        logger.info({ ...loggerContext, competitionId: competitionContext.competitionId }, 'No missed rounds found for user in competition');
        return result;
      }

      logger.info({ 
        ...loggerContext, 
        missedRoundsCount: missedRounds.length,
        competitionId: competitionContext.competitionId,
        competitionName: competitionContext.competitionName
      }, 'Found missed rounds in competition');

      // 4. Process each missed round
      for (const round of missedRounds) {
        try {
          const roundResult = await this.processRetroactivePointsForRound(
            userId, 
            round.id, 
            round.name,
            dryRun
          );

          result.rounds.push(roundResult);
          result.roundsProcessed++;
          result.totalPointsAwarded += roundResult.pointsAwarded;

          logger.debug({ 
            ...loggerContext, 
            roundId: round.id, 
            pointsAwarded: roundResult.pointsAwarded,
            participantCount: roundResult.participantCount
          }, 'Processed retroactive points for round');

        } catch (roundError) {
          const errorMessage = `Failed to process round ${round.id}: ${roundError instanceof Error ? roundError.message : String(roundError)}`;
          result.errors.push(errorMessage);
          logger.error({ ...loggerContext, roundId: round.id, error: errorMessage }, 'Failed to process round');
        }
      }

      logger.info({ 
        ...loggerContext, 
        roundsProcessed: result.roundsProcessed,
        totalPointsAwarded: result.totalPointsAwarded,
        errorsCount: result.errors.length,
        competitionName: competitionContext.competitionName
      }, 'Completed retroactive points allocation for user');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error: ${errorMessage}`);
      logger.error({ ...loggerContext, error: errorMessage }, 'Unexpected error in retroactive points allocation');
      return result;
    }
  }

  /**
   * Apply retroactive points for a specific user in a specific competition
   * (Future-ready for multi-competition support)
   * 
   * @param userId - The user ID to process
   * @param competitionId - The competition ID to process
   * @param fromRoundId - Optional: Start from specific round (default: Round 1)
   * @param dryRun - If true, calculates points but doesn't insert records
   * @returns Promise<RetroactivePointsResult>
   */
  async applyRetroactivePointsForCompetition(
    userId: string,
    competitionId: number,
    fromRoundId?: number,
    dryRun: boolean = false
  ): Promise<RetroactivePointsResult> {
    const loggerContext = { 
      service: 'RetroactivePointsService', 
      function: 'applyRetroactivePointsForCompetition', 
      userId,
      competitionId,
      fromRoundId,
      dryRun
    };
    
    logger.info(loggerContext, 'Starting competition-specific retroactive points allocation');

    const result: RetroactivePointsResult = {
      userId,
      roundsProcessed: 0,
      totalPointsAwarded: 0,
      rounds: [],
      errors: []
    };

    try {
      // 1. Verify user exists
      const userProfile = await this.verifyUserExists(userId);
      if (!userProfile.exists) {
        result.errors.push(`User ${userId} not found`);
        return result;
      }

      // 2. Verify competition exists
      const competition = await this.getCompetitionById(competitionId);
      if (!competition) {
        result.errors.push(`Competition ${competitionId} not found`);
        return result;
      }

      // 3. Get missed rounds in this specific competition
      const missedRounds = await this.getMissedRoundsInCompetition(userId, competitionId, fromRoundId);
      
      if (missedRounds.length === 0) {
        logger.info({ ...loggerContext }, 'No missed rounds found for user in competition');
        return result;
      }

      // 4. Process each missed round (same logic as general method)
      for (const round of missedRounds) {
        try {
          const roundResult = await this.processRetroactivePointsForRound(
            userId, 
            round.id, 
            round.name,
            dryRun
          );

          result.rounds.push(roundResult);
          result.roundsProcessed++;
          result.totalPointsAwarded += roundResult.pointsAwarded;

        } catch (roundError) {
          const errorMessage = `Failed to process round ${round.id}: ${roundError instanceof Error ? roundError.message : String(roundError)}`;
          result.errors.push(errorMessage);
          logger.error({ ...loggerContext, roundId: round.id, error: errorMessage }, 'Failed to process round');
        }
      }

      logger.info({ 
        ...loggerContext, 
        roundsProcessed: result.roundsProcessed,
        totalPointsAwarded: result.totalPointsAwarded,
        competitionName: competition.name
      }, 'Completed competition-specific retroactive points allocation');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error: ${errorMessage}`);
      logger.error({ ...loggerContext, error: errorMessage }, 'Unexpected error in competition-specific allocation');
      return result;
    }
  }

  /**
   * Apply retroactive points for all users who joined after a specific date
   * 
   * @param afterDate - ISO date string, users created after this date will be processed
   * @param competitionId - Optional: specific competition (defaults to current competition)
   * @param fromRoundId - Optional: Start from specific round (default: Round 1)
   * @param dryRun - If true, calculates points but doesn't insert records
   * @returns Promise<BulkRetroactivePointsResult>
   */
  async applyRetroactivePointsForNewUsers(
    afterDate: string,
    competitionId?: number,
    fromRoundId?: number,
    dryRun: boolean = false
  ): Promise<BulkRetroactivePointsResult> {
    const loggerContext = { 
      service: 'RetroactivePointsService', 
      function: 'applyRetroactivePointsForNewUsers',
      afterDate,
      competitionId,
      fromRoundId,
      dryRun
    };

    logger.info(loggerContext, 'Starting bulk retroactive points allocation');

    const result: BulkRetroactivePointsResult = {
      totalUsersProcessed: 0,
      totalRoundsProcessed: 0,
      totalPointsAwarded: 0,
      userResults: [],
      errors: []
    };

    try {
      // Find users created after the specified date
      const { data: newUsers, error } = await this.client
        .from('profiles')
        .select('id, full_name, created_at')
        .gte('created_at', afterDate)
        .order('created_at', { ascending: true });

      if (error) {
        const errorMessage = `Failed to fetch new users: ${error.message}`;
        result.errors.push(errorMessage);
        logger.error({ ...loggerContext, error: errorMessage }, 'Failed to fetch new users');
        return result;
      }

      if (!newUsers || newUsers.length === 0) {
        logger.info({ ...loggerContext }, 'No new users found after specified date');
        return result;
      }

      logger.info({ ...loggerContext, userCount: newUsers.length }, 'Found new users to process');

      // Process each user - type assertion is safe after null check above
      for (const user of (newUsers as unknown) as Array<{ id: string; full_name?: string; created_at?: string }>) {
        if (!user?.id) {
          continue;
        }
        try {
          const userResult = competitionId 
            ? await this.applyRetroactivePointsForCompetition(user.id, competitionId, fromRoundId, dryRun)
            : await this.applyRetroactivePointsForUser(user.id, fromRoundId, dryRun);
          
          result.userResults.push(userResult);
          result.totalUsersProcessed++;
          result.totalRoundsProcessed += userResult.roundsProcessed;
          result.totalPointsAwarded += userResult.totalPointsAwarded;

          if (userResult.errors.length > 0) {
            result.errors.push(...userResult.errors.map(err => `User ${user.id}: ${err}`));
          }

          logger.info({ 
            ...loggerContext, 
            userId: user.id, 
            userName: user.full_name,
            roundsProcessed: userResult.roundsProcessed,
            pointsAwarded: userResult.totalPointsAwarded
          }, 'Processed retroactive points for user');

        } catch (userError) {
          const errorMessage = `Failed to process user ${user.id}: ${userError instanceof Error ? userError.message : String(userError)}`;
          result.errors.push(errorMessage);
          logger.error({ ...loggerContext, userId: user.id, error: errorMessage }, 'Failed to process user');
        }
      }

      logger.info({ 
        ...loggerContext,
        usersProcessed: result.totalUsersProcessed,
        totalRoundsProcessed: result.totalRoundsProcessed,
        totalPointsAwarded: result.totalPointsAwarded,
        errorsCount: result.errors.length
      }, 'Completed bulk retroactive points allocation');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error: ${errorMessage}`);
      logger.error({ ...loggerContext, error: errorMessage }, 'Unexpected error in bulk retroactive points allocation');
      return result;
    }
  }

  /**
   * Get a preview of what retroactive points would be awarded without actually applying them
   */
  async previewRetroactivePoints(userId: string, fromRoundId?: number): Promise<RetroactivePointsResult> {
    return this.applyRetroactivePointsForUser(userId, fromRoundId, true);
  }

  /**
   * Get a preview for specific competition
   */
  async previewRetroactivePointsForCompetition(userId: string, competitionId: number, fromRoundId?: number): Promise<RetroactivePointsResult> {
    return this.applyRetroactivePointsForCompetition(userId, competitionId, fromRoundId, true);
  }

  /**
   * Check if a user needs retroactive points (has missed rounds)
   */
  async checkIfUserNeedsRetroactivePoints(userId: string): Promise<{
    needsRetroactivePoints: boolean;
    missedRounds: number;
    estimatedPointsToAward: number;
    competitionContext?: CompetitionContext;
  }> {
    try {
      const preview = await this.previewRetroactivePoints(userId);
      const competitionContext = await this.getCurrentCompetitionContext();
      
      return {
        needsRetroactivePoints: preview.roundsProcessed > 0,
        missedRounds: preview.roundsProcessed,
        estimatedPointsToAward: preview.totalPointsAwarded,
        competitionContext: competitionContext || undefined
      };
    } catch (error) {
      logger.error({ userId, error }, 'Error checking if user needs retroactive points');
      return {
        needsRetroactivePoints: false,
        missedRounds: 0,
        estimatedPointsToAward: 0
      };
    }
  }

  /**
   * Detect if this would be a user's first bet in a specific competition
   * (Future automation helper)
   */
  async isUserFirstBetInCompetition(userId: string, competitionId: number): Promise<boolean> {
    try {
      // Get all betting rounds in this competition
      const { data: competitionRounds, error: roundsError } = await this.client
        .from('betting_rounds')
        .select('id')
        .eq('competition_id', competitionId);

      if (roundsError || !competitionRounds) {
        logger.error({ userId, competitionId, error: roundsError }, 'Failed to fetch competition rounds');
        return false;
      }

      const roundIds = competitionRounds.map(round => round.id);

      // Check if user has any bets in these rounds
      const { data: existingBets, error: betsError } = await this.client
        .from('user_bets')
        .select('id')
        .eq('user_id', userId)
        .in('betting_round_id', roundIds)
        .limit(1);

      if (betsError) {
        logger.error({ userId, competitionId, error: betsError }, 'Failed to check existing bets');
        return false;
      }

      return !existingBets || existingBets.length === 0;

    } catch (error) {
      logger.error({ userId, competitionId, error }, 'Error checking first bet status');
      return false;
    }
  }

  // Private helper methods

  private async verifyUserExists(userId: string): Promise<{ exists: boolean; createdAt?: string }> {
    try {
      const { data: userProfile, error } = await this.client
        .from('profiles')
        .select('id, created_at')
        .eq('id', userId)
        .single();

      if (error || !userProfile) {
        return { exists: false };
      }

      return { 
        exists: true, 
        createdAt: ((userProfile as unknown) as { id: string; created_at?: string }).created_at 
      };
    } catch (error) {
      logger.error({ userId, error }, 'Error verifying user exists');
      return { exists: false };
    }
  }

  private async getCurrentCompetitionContext(): Promise<CompetitionContext | null> {
    try {
      // Get the current active competition (assumes single competition for now)
      // In multi-competition future, this would need competition selection logic
      const { data: currentSeason, error } = await this.client
        .from('seasons')
        .select(`
          id,
          competition_id,
          competitions (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !currentSeason || !currentSeason.competitions) {
        logger.warn('No current competition context found');
        return null;
      }

      return {
        competitionId: currentSeason.competition_id,
        competitionName: currentSeason.competitions.name,
        seasonId: currentSeason.id
      };
    } catch (error) {
      logger.error({ error }, 'Error getting current competition context');
      return null;
    }
  }

  private async getCompetitionById(competitionId: number): Promise<{ id: number; name: string } | null> {
    try {
      const { data: competition, error } = await this.client
        .from('competitions')
        .select('id, name')
        .eq('id', competitionId)
        .single();

      if (error || !competition) {
        return null;
      }

      return competition;
    } catch (error) {
      logger.error({ competitionId, error }, 'Error fetching competition by ID');
      return null;
    }
  }

  private async getMissedRoundsInCompetition(
    userId: string, 
    competitionId: number, 
    fromRoundId?: number
  ): Promise<Array<{ id: number; name: string }>> {
    try {
      // Get all scored rounds in this competition
      let roundsQuery = this.client
        .from('betting_rounds')
        .select('id, name')
        .eq('status', 'scored')
        .eq('competition_id', competitionId)
        .order('id', { ascending: true });

      if (fromRoundId) {
        roundsQuery = roundsQuery.gte('id', fromRoundId);
      }

      const { data: allRounds, error: roundsError } = await roundsQuery;

      if (roundsError || !allRounds) {
        throw new Error(`Failed to fetch scored rounds: ${roundsError?.message || 'Unknown error'}`);
      }

      // Get rounds where user has bets
      const { data: userRounds, error: userRoundsError } = await this.client
        .from('user_bets')
        .select('betting_round_id')
        .eq('user_id', userId)
        .in('betting_round_id', allRounds.map(round => round.id));

      if (userRoundsError) {
        throw new Error(`Failed to fetch user betting rounds: ${userRoundsError.message}`);
      }

      const userRoundIds = new Set(userRounds?.map(bet => bet.betting_round_id) || []);

      // Filter to rounds user missed
      const missedRounds = allRounds.filter(round => !userRoundIds.has(round.id));

      return missedRounds;
    } catch (error) {
      logger.error({ userId, competitionId, fromRoundId, error }, 'Error getting missed rounds in competition');
      throw error;
    }
  }

  /**
   * Process retroactive points for a specific round using the same logic as applyNonParticipantScoringRule
   * This is the core algorithm that matches scoring.ts lines 814-1032
   */
  private async processRetroactivePointsForRound(
    userId: string, 
    roundId: number, 
    roundName: string,
    dryRun: boolean
  ): Promise<{
    roundId: number;
    roundName: string;
    pointsAwarded: number;
    minimumParticipantScore: number;
    participantCount: number;
  }> {
    const loggerContext = { userId, roundId, roundName, dryRun };

    // 1. Find minimum participant score (same logic as applyNonParticipantScoringRule)
    const { data: participantScores, error: scoresError } = await this.client
      .from('user_bets')
      .select('user_id, points_awarded')
      .eq('betting_round_id', roundId);

    if (scoresError) {
      throw new Error(`Failed to fetch participant scores for round ${roundId}: ${scoresError.message}`);
    }

    if (!participantScores || participantScores.length === 0) {
      // No participants - award 0 points
      logger.info({ ...loggerContext }, 'No participants in round, awarding 0 points');
      return {
        roundId,
        roundName,
        pointsAwarded: 0,
        minimumParticipantScore: 0,
        participantCount: 0
      };
    }

    // Calculate total points per participant (same logic as scoring.ts)
    const participantTotals = new Map<string, number>();
    participantScores.forEach(bet => {
      const current = participantTotals.get(bet.user_id) || 0;
      participantTotals.set(bet.user_id, current + (bet.points_awarded || 0));
    });

    const minimumScore = Math.min(...Array.from(participantTotals.values()));
    const participantCount = participantTotals.size;

    logger.info({ 
      ...loggerContext, 
      minimumScore, 
      participantCount 
    }, 'Calculated minimum participant score');

    if (dryRun) {
      return {
        roundId,
        roundName,
        pointsAwarded: minimumScore,
        minimumParticipantScore: minimumScore,
        participantCount
      };
    }

    // 2. Get fixtures for this round to create bet records
    const { data: fixtures, error: fixturesError } = await this.client
      .from('betting_round_fixtures')
      .select(`
        fixture_id,
        fixtures (
          id,
          home_team:teams!fixtures_home_team_id_fkey (name),
          away_team:teams!fixtures_away_team_id_fkey (name)
        )
      `)
      .eq('betting_round_id', roundId);

    if (fixturesError || !fixtures) {
      throw new Error(`Failed to fetch fixtures for round ${roundId}: ${fixturesError?.message || 'Unknown error'}`);
    }

    // 3. Create bet records with distributed points (same logic as applyNonParticipantScoringRule)
    const betRecords = [];
    let remainingPoints = minimumScore;

    for (let i = 0; i < fixtures.length && remainingPoints > 0; i++) {
      const fixture = fixtures[i];
      const pointsToAward = Math.min(1, remainingPoints); // Maximum 1 point per fixture

      betRecords.push({
        user_id: userId,
        betting_round_id: roundId,
        fixture_id: fixture.fixture_id,
        prediction: '1' as const, // Dummy prediction - doesn't matter since points are pre-calculated
        points_awarded: pointsToAward,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      remainingPoints -= pointsToAward;
    }

    // Add remaining fixtures with 0 points
    for (let i = betRecords.length; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      betRecords.push({
        user_id: userId,
        betting_round_id: roundId,
        fixture_id: fixture.fixture_id,
        prediction: '1' as const, // Dummy prediction
        points_awarded: 0,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }

    // 4. Insert bet records atomically
    const { error: insertError } = await this.client
      .from('user_bets')
      .insert(betRecords);

    if (insertError) {
      throw new Error(`Failed to insert retroactive bets for round ${roundId}: ${insertError.message}`);
    }

    logger.info({ 
      ...loggerContext, 
      minimumScore, 
      betRecordsCreated: betRecords.length 
    }, 'Successfully created retroactive bet records');

    return {
      roundId,
      roundName,
      pointsAwarded: minimumScore,
      minimumParticipantScore: minimumScore,
      participantCount
    };
  }
}

// Export singleton instance
export const retroactivePointsService = new RetroactivePointsService();