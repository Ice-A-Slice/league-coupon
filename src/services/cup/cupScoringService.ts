import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';

// Types for Cup Scoring
export interface CupPointsCalculationOptions {
  onlyAfterActivation?: boolean; // Only process rounds after cup activation
  seasonId?: number; // Specific season to process (defaults to current)
  bettingRoundId?: number; // Specific round to process
}

export interface CupPointsResult {
  userId: string;
  bettingRoundId: number;
  seasonId: number;
  points: number;
  processed: boolean;
  error?: string;
}

export interface CupScoringResult {
  success: boolean;
  message: string;
  details: {
    usersProcessed: number;
    roundsProcessed: number;
    totalPointsAwarded: number;
    errors: string[];
  };
}

export interface UserCupTotalPoints {
  userId: string;
  userName: string | null;
  totalPoints: number;
  roundsParticipated: number;
  lastUpdated: string;
}

export interface CupStandingsResult {
  userId: string;
  userName: string | null;
  totalPoints: number;
  roundsParticipated: number;
  position: number;
  lastUpdated: string;
}

export class CupScoringServiceError extends Error {
  constructor(message: string, public context?: Record<string, unknown>) {
    super(message);
    this.name = 'CupScoringServiceError';
  }
}

/**
 * Cup Scoring Service
 * 
 * Handles calculation and storage of points for the Last Round Special cup competition.
 * Only processes standard game prediction points (excludes dynamic points).
 * Calculates points only for rounds after cup activation.
 */
export class CupScoringService {
  private client = createClient();

  /**
   * Calculate cup points for a specific betting round
   * 
   * @param bettingRoundId - The betting round to process
   * @param options - Additional options for calculation
   * @returns Results of the calculation
   */
  async calculateRoundCupPoints(
    bettingRoundId: number, 
    options: CupPointsCalculationOptions = {}
  ): Promise<CupScoringResult> {
    try {
      logger.info('Starting cup points calculation for round', { 
        bettingRoundId, 
        options 
      });

      // 1. Get season information and validate cup activation
      const seasonInfo = await this.getSeasonInfoForRound(bettingRoundId);
      if (!seasonInfo) {
        throw new CupScoringServiceError('Season not found for betting round', { bettingRoundId });
      }

      const { seasonId, seasonName, cupActivated, cupActivatedAt } = seasonInfo;

      // 2. Check if cup is activated for this season
      if (!cupActivated) {
        logger.info('Cup not activated for season - skipping calculation', { 
          seasonId, 
          seasonName, 
          bettingRoundId 
        });
        return {
          success: true,
          message: 'Cup not activated - no points calculated',
          details: {
            usersProcessed: 0,
            roundsProcessed: 0,
            totalPointsAwarded: 0,
            errors: []
          }
        };
      }

      // 3. Check if round occurred after cup activation (if option enabled)
      if (options.onlyAfterActivation && cupActivatedAt) {
        const roundInfo = await this.getRoundInfo(bettingRoundId);
        if (roundInfo && roundInfo.createdAt < cupActivatedAt) {
          logger.info('Round occurred before cup activation - skipping', { 
            bettingRoundId, 
            roundCreated: roundInfo.createdAt, 
            cupActivated: cupActivatedAt 
          });
          return {
            success: true,
            message: 'Round before cup activation - no points calculated',
            details: {
              usersProcessed: 0,
              roundsProcessed: 0,
              totalPointsAwarded: 0,
              errors: []
            }
          };
        }
      }

      // 4. Get all user bets for this round with awarded points
      const userBetsData = await this.getUserBetsForRound(bettingRoundId);
      if (userBetsData.length === 0) {
        logger.info('No user bets found for round', { bettingRoundId });
        return {
          success: true,
          message: 'No user bets found for round',
          details: {
            usersProcessed: 0,
            roundsProcessed: 1,
            totalPointsAwarded: 0,
            errors: []
          }
        };
      }

      // 5. Calculate cup points for each user
      const userResults = await this.calculateUserCupPointsForRound(
        userBetsData,
        bettingRoundId,
        seasonId
      );

      // 6. Store the calculated points
      const storeResult = await this.storeCupPoints(userResults);

      const successfulUsers = userResults.filter(r => r.processed);
      const totalPoints = successfulUsers.reduce((sum, r) => sum + r.points, 0);
      const errors = userResults.filter(r => r.error).map(r => r.error!);

      logger.info('Cup points calculation completed', { 
        bettingRoundId, 
        seasonId,
        usersProcessed: successfulUsers.length,
        totalPointsAwarded: totalPoints,
        errorCount: errors.length
      });

      return {
        success: storeResult.success,
        message: storeResult.success 
          ? `Successfully calculated cup points for ${successfulUsers.length} users`
          : 'Cup points calculation completed with errors',
        details: {
          usersProcessed: successfulUsers.length,
          roundsProcessed: 1,
          totalPointsAwarded: totalPoints,
          errors: storeResult.success ? [] : [storeResult.message]
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error calculating cup points for round', { 
        bettingRoundId, 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        message: `Failed to calculate cup points: ${errorMessage}`,
        details: {
          usersProcessed: 0,
          roundsProcessed: 0,
          totalPointsAwarded: 0,
          errors: [errorMessage]
        }
      };
    }
  }

  /**
   * Calculate cup points for multiple betting rounds
   * 
   * @param bettingRoundIds - Array of betting round IDs to process
   * @param options - Additional options for calculation
   * @returns Results of the calculation
   */
  async calculateMultipleRoundsCupPoints(
    bettingRoundIds: number[], 
    options: CupPointsCalculationOptions = {}
  ): Promise<CupScoringResult> {
    const allResults: CupScoringResult[] = [];
    let totalUsersProcessed = 0;
    let totalPointsAwarded = 0;
    let allErrors: string[] = [];

    for (const roundId of bettingRoundIds) {
      const result = await this.calculateRoundCupPoints(roundId, options);
      allResults.push(result);
      
      totalUsersProcessed += result.details.usersProcessed;
      totalPointsAwarded += result.details.totalPointsAwarded;
      allErrors = allErrors.concat(result.details.errors);
    }

    const successCount = allResults.filter(r => r.success).length;
    const overallSuccess = successCount === bettingRoundIds.length;

    return {
      success: overallSuccess,
      message: `Processed ${bettingRoundIds.length} rounds: ${successCount} successful, ${bettingRoundIds.length - successCount} failed`,
      details: {
        usersProcessed: totalUsersProcessed,
        roundsProcessed: bettingRoundIds.length,
        totalPointsAwarded: totalPointsAwarded,
        errors: allErrors
      }
    };
  }

  /**
   * Calculate cup points for all rounds after cup activation
   * 
   * @param seasonId - Season to process (optional, defaults to current)
   * @returns Results of the calculation
   */
  async calculateAllCupPointsAfterActivation(seasonId?: number): Promise<CupScoringResult> {
    try {
      // 1. Get season information
      const season = seasonId 
        ? await this.getSeasonInfo(seasonId)
        : await this.getCurrentSeasonInfo();

      if (!season) {
        throw new CupScoringServiceError('Season not found', { seasonId });
      }

      if (!season.cupActivated) {
        return {
          success: true,
          message: 'Cup not activated for season',
          details: {
            usersProcessed: 0,
            roundsProcessed: 0,
            totalPointsAwarded: 0,
            errors: []
          }
        };
      }

      // 2. Get all betting rounds after cup activation
      const roundsToProcess = await this.getBettingRoundsAfterActivation(
        season.seasonId, 
        season.cupActivatedAt!
      );

      if (roundsToProcess.length === 0) {
        return {
          success: true,
          message: 'No betting rounds found after cup activation',
          details: {
            usersProcessed: 0,
            roundsProcessed: 0,
            totalPointsAwarded: 0,
            errors: []
          }
        };
      }

      // 3. Process all rounds
      return await this.calculateMultipleRoundsCupPoints(
        roundsToProcess.map(r => r.id), 
        { onlyAfterActivation: true, seasonId: season.seasonId }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error calculating all cup points after activation', { 
        seasonId, 
        error: errorMessage 
      });

      return {
        success: false,
        message: `Failed to calculate all cup points: ${errorMessage}`,
        details: {
          usersProcessed: 0,
          roundsProcessed: 0,
          totalPointsAwarded: 0,
          errors: [errorMessage]
        }
      };
    }
  }

  /**
   * Get cup standings for a specific season
   * 
   * @param seasonId - Season to get standings for (optional, defaults to current)
   * @returns Cup standings
   */
  async getCupStandings(seasonId?: number): Promise<CupStandingsResult[]> {
    try {
      const season = seasonId 
        ? await this.getSeasonInfo(seasonId)
        : await this.getCurrentSeasonInfo();

      if (!season) {
        throw new CupScoringServiceError('Season not found', { seasonId });
      }

      // Get aggregated cup points with user information
      const { data: standingsData, error } = await this.client
        .from('user_last_round_special_points')
        .select(`
          user_id,
          points,
          profiles!inner(full_name)
        `)
        .eq('season_id', season.seasonId);

      if (error) {
        throw new CupScoringServiceError('Failed to fetch cup standings', { error, seasonId: season.seasonId });
      }

      // Aggregate points by user
      const userPointsMap = new Map<string, { 
        totalPoints: number; 
        roundsParticipated: number; 
        userName: string | null;
      }>();

      for (const record of standingsData || []) {
        const userId = record.user_id;
        const points = record.points || 0;
        const userName = Array.isArray(record.profiles) 
          ? (record.profiles[0] as { full_name?: string })?.full_name || null
          : (record.profiles as { full_name?: string })?.full_name || null;

        if (!userPointsMap.has(userId)) {
          userPointsMap.set(userId, {
            totalPoints: 0,
            roundsParticipated: 0,
            userName
          });
        }

        const userStats = userPointsMap.get(userId)!;
        userStats.totalPoints += points;
        userStats.roundsParticipated += 1;
      }

      // Convert to array and sort by total points
      const standings = Array.from(userPointsMap.entries())
        .map(([userId, stats]) => ({
          userId,
          userName: stats.userName,
          totalPoints: stats.totalPoints,
          roundsParticipated: stats.roundsParticipated,
          position: 0, // Will be set below
          lastUpdated: new Date().toISOString()
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      // Assign positions (handle ties)
      let currentPosition = 1;
      for (let i = 0; i < standings.length; i++) {
        if (i > 0 && standings[i].totalPoints < standings[i - 1].totalPoints) {
          currentPosition = i + 1;
        }
        standings[i].position = currentPosition;
      }

      logger.info('Cup standings calculated', { 
        seasonId: season.seasonId,
        participantCount: standings.length
      });

      return standings;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting cup standings', { seasonId, error: errorMessage });
      throw new CupScoringServiceError(`Failed to get cup standings: ${errorMessage}`, { seasonId });
    }
  }

  /**
   * Get total cup points for a specific user in a season
   * 
   * @param userId - User ID
   * @param seasonId - Season ID (optional, defaults to current)
   * @returns User's total cup points
   */
  async getUserCupTotalPoints(userId: string, seasonId?: number): Promise<UserCupTotalPoints | null> {
    try {
      const season = seasonId 
        ? await this.getSeasonInfo(seasonId)
        : await this.getCurrentSeasonInfo();

      if (!season) {
        throw new CupScoringServiceError('Season not found', { seasonId });
      }

      const { data: userPoints, error } = await this.client
        .from('user_last_round_special_points')
        .select(`
          points,
          betting_round_id,
          updated_at,
          profiles!inner(full_name)
        `)
        .eq('user_id', userId)
        .eq('season_id', season.seasonId);

      if (error) {
        throw new CupScoringServiceError('Failed to fetch user cup points', { error, userId, seasonId: season.seasonId });
      }

      if (!userPoints || userPoints.length === 0) {
        return null;
      }

      const totalPoints = userPoints.reduce((sum, record) => sum + (record.points || 0), 0);
      const roundsParticipated = userPoints.length;
      const lastUpdated = userPoints.reduce((latest, record) => 
        record.updated_at > latest ? record.updated_at : latest
      , userPoints[0].updated_at);

      const userName = Array.isArray(userPoints[0].profiles) 
        ? (userPoints[0].profiles[0] as { full_name?: string })?.full_name || null
        : (userPoints[0].profiles as { full_name?: string })?.full_name || null;

      return {
        userId,
        userName,
        totalPoints,
        roundsParticipated,
        lastUpdated
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting user cup total points', { userId, seasonId, error: errorMessage });
      throw new CupScoringServiceError(`Failed to get user cup points: ${errorMessage}`, { userId, seasonId });
    }
  }

  // Private helper methods

  private async getSeasonInfoForRound(bettingRoundId: number): Promise<{
    seasonId: number;
    seasonName: string;
    cupActivated: boolean;
    cupActivatedAt: string | null;
  } | null> {
    const { data, error } = await this.client
      .from('betting_rounds')
      .select(`
        season_id,
        seasons!inner(
          id,
          season_name,
          last_round_special_activated,
          last_round_special_activated_at
        )
      `)
      .eq('id', bettingRoundId)
      .single();

    if (error || !data) {
      logger.error('Failed to get season info for round', { bettingRoundId, error });
      return null;
    }

    const season = Array.isArray(data.seasons) ? data.seasons[0] : data.seasons;
    
    return {
      seasonId: season.id,
      seasonName: season.season_name,
      cupActivated: season.last_round_special_activated || false,
      cupActivatedAt: season.last_round_special_activated_at
    };
  }

  private async getSeasonInfo(seasonId: number): Promise<{
    seasonId: number;
    seasonName: string;
    cupActivated: boolean;
    cupActivatedAt: string | null;
  } | null> {
    const { data, error } = await this.client
      .from('seasons')
      .select('id, season_name, last_round_special_activated, last_round_special_activated_at')
      .eq('id', seasonId)
      .single();

    if (error || !data) {
      logger.error('Failed to get season info', { seasonId, error });
      return null;
    }

    return {
      seasonId: data.id,
      seasonName: data.season_name,
      cupActivated: data.last_round_special_activated || false,
      cupActivatedAt: data.last_round_special_activated_at
    };
  }

  private async getCurrentSeasonInfo(): Promise<{
    seasonId: number;
    seasonName: string;
    cupActivated: boolean;
    cupActivatedAt: string | null;
  } | null> {
    const { data, error } = await this.client
      .from('seasons')
      .select('id, season_name, last_round_special_activated, last_round_special_activated_at')
      .eq('is_current', true)
      .single();

    if (error || !data) {
      logger.error('Failed to get current season info', { error });
      return null;
    }

    return {
      seasonId: data.id,
      seasonName: data.season_name,
      cupActivated: data.last_round_special_activated || false,
      cupActivatedAt: data.last_round_special_activated_at
    };
  }

  private async getRoundInfo(bettingRoundId: number): Promise<{
    id: number;
    createdAt: string;
  } | null> {
    const { data, error } = await this.client
      .from('betting_rounds')
      .select('id, created_at')
      .eq('id', bettingRoundId)
      .single();

    if (error || !data) {
      logger.error('Failed to get round info', { bettingRoundId, error });
      return null;
    }

    return {
      id: data.id,
      createdAt: data.created_at
    };
  }

  private async getUserBetsForRound(bettingRoundId: number): Promise<Array<{
    userId: string;
    fixtureId: number;
    pointsAwarded: number;
  }>> {
    const { data, error } = await this.client
      .from('user_bets')
      .select('user_id, fixture_id, points_awarded')
      .eq('betting_round_id', bettingRoundId)
      .not('points_awarded', 'is', null);

    if (error) {
      throw new CupScoringServiceError('Failed to fetch user bets for round', { error, bettingRoundId });
    }

    return (data || []).map(bet => ({
      userId: bet.user_id,
      fixtureId: bet.fixture_id,
      pointsAwarded: bet.points_awarded || 0
    }));
  }

  private async calculateUserCupPointsForRound(
    userBetsData: Array<{
      userId: string;
      fixtureId: number;
      pointsAwarded: number;
    }>,
    bettingRoundId: number,
    seasonId: number
  ): Promise<CupPointsResult[]> {
    // Group bets by user and sum their points
    const userPointsMap = new Map<string, number>();

    for (const bet of userBetsData) {
      const currentPoints = userPointsMap.get(bet.userId) || 0;
      userPointsMap.set(bet.userId, currentPoints + bet.pointsAwarded);
    }

    // Convert to results array
    return Array.from(userPointsMap.entries()).map(([userId, points]) => ({
      userId,
      bettingRoundId,
      seasonId,
      points,
      processed: true
    }));
  }

  private async storeCupPoints(results: CupPointsResult[]): Promise<{ success: boolean; message: string }> {
    if (results.length === 0) {
      return { success: true, message: 'No points to store' };
    }

    const startTime = Date.now();
    
    try {
      // Enhanced storage with batch processing and validation
      const storageResult = await this.performBatchStorage(results);
      
      const duration = Date.now() - startTime;
      
      logger.info('Cup points stored successfully', { 
        recordCount: results.length,
        totalPoints: results.reduce((sum, r) => sum + r.points, 0),
        storageDurationMs: duration,
        batchSize: results.length,
        averageTimePerRecord: duration / results.length
      });

      return storageResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Error storing cup points', { 
        error: errorMessage,
        recordCount: results.length,
        failedAfterMs: duration,
        context: 'batch_storage_failure'
      });
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Enhanced batch storage mechanism with transaction support
   * Optimized for different batch sizes and includes data validation
   */
  private async performBatchStorage(results: CupPointsResult[]): Promise<{ success: boolean; message: string }> {
    // Validate all data before attempting storage
    const validationResult = this.validateStorageData(results);
    if (!validationResult.isValid) {
      throw new CupScoringServiceError(`Data validation failed: ${validationResult.errors.join(', ')}`, {
        invalidRecords: validationResult.invalidRecords
      });
    }

    // Determine optimal batch size based on dataset
    const batchSize = this.calculateOptimalBatchSize(results.length);
    const batches = this.createBatches(results, batchSize);
    
    logger.info('Starting batch storage operation', {
      totalRecords: results.length,
      batchCount: batches.length,
      optimalBatchSize: batchSize
    });

    // Process batches with transaction support
    let totalProcessed = 0;
    const errors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStart = Date.now();
      
      try {
        await this.storeBatchWithTransaction(batch, i + 1, batches.length);
        totalProcessed += batch.length;
        
        const batchDuration = Date.now() - batchStart;
        logger.debug('Batch processed successfully', {
          batchIndex: i + 1,
          batchSize: batch.length,
          durationMs: batchDuration,
          cumulativeProcessed: totalProcessed
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Batch ${i + 1}: ${errorMessage}`);
        
        logger.error('Batch storage failed', {
          batchIndex: i + 1,
          batchSize: batch.length,
          error: errorMessage,
          recordsProcessedSoFar: totalProcessed
        });
        
        // Decide whether to continue or abort based on error type
        if (this.isCriticalStorageError(error)) {
          throw new CupScoringServiceError(`Critical storage error in batch ${i + 1}: ${errorMessage}`, {
            batchIndex: i + 1,
            totalBatches: batches.length,
            processedSoFar: totalProcessed
          });
        }
      }
    }

    // Verify storage integrity
    const verificationResult = await this.verifyStorageIntegrity(results);
    if (!verificationResult.success) {
      logger.warn('Storage integrity verification failed', verificationResult);
    }

    if (errors.length > 0) {
      const message = `Partial success: ${totalProcessed}/${results.length} records stored. Errors: ${errors.join('; ')}`;
      return { success: false, message };
    }

    return { 
      success: true, 
      message: `Successfully stored ${totalProcessed} cup point records in ${batches.length} batches` 
    };
  }

  /**
   * Store a single batch within a transaction for atomicity
   */
  private async storeBatchWithTransaction(
    batch: CupPointsResult[],
    batchIndex: number,
    totalBatches: number
  ): Promise<void> {
    const insertData = batch.map(result => ({
      user_id: result.userId,
      betting_round_id: result.bettingRoundId,
      season_id: result.seasonId,
      points: result.points
    }));

    // Use Supabase's built-in transaction behavior with upsert
    const { error } = await this.client
      .from('user_last_round_special_points')
      .upsert(insertData, {
        onConflict: 'user_id,betting_round_id,season_id',
        count: 'exact' // Get exact count for verification
      });

    if (error) {
      throw new CupScoringServiceError(`Batch storage failed: ${error.message}`, {
        batchIndex,
        totalBatches,
        batchSize: batch.length,
        supabaseError: error
      });
    }
  }

  /**
   * Validate storage data for integrity and consistency
   */
  private validateStorageData(results: CupPointsResult[]): {
    isValid: boolean;
    errors: string[];
    invalidRecords: number[];
  } {
    const errors: string[] = [];
    const invalidRecords: number[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      // Check required fields
      if (!result.userId || typeof result.userId !== 'string') {
        errors.push(`Record ${i}: Invalid userId`);
        invalidRecords.push(i);
        continue;
      }
      
      if (!result.bettingRoundId || typeof result.bettingRoundId !== 'number' || result.bettingRoundId <= 0) {
        errors.push(`Record ${i}: Invalid bettingRoundId`);
        invalidRecords.push(i);
        continue;
      }
      
      if (!result.seasonId || typeof result.seasonId !== 'number' || result.seasonId <= 0) {
        errors.push(`Record ${i}: Invalid seasonId`);
        invalidRecords.push(i);
        continue;
      }
      
      // Validate points (can be 0 or positive)
      if (typeof result.points !== 'number' || result.points < 0) {
        errors.push(`Record ${i}: Invalid points value`);
        invalidRecords.push(i);
      }
    }

    // Check for duplicate user-round-season combinations within the batch
    const combinations = new Set<string>();
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const combination = `${result.userId}-${result.bettingRoundId}-${result.seasonId}`;
      
      if (combinations.has(combination)) {
        errors.push(`Record ${i}: Duplicate user-round-season combination`);
        invalidRecords.push(i);
      } else {
        combinations.add(combination);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      invalidRecords
    };
  }

  /**
   * Calculate optimal batch size based on dataset size and performance characteristics
   */
  private calculateOptimalBatchSize(totalRecords: number): number {
    // Optimized batch sizes based on dataset characteristics
    if (totalRecords <= 100) return totalRecords; // Small datasets: single batch
    if (totalRecords <= 500) return 100; // Medium datasets: 100 per batch
    if (totalRecords <= 2000) return 200; // Large datasets: 200 per batch
    return 250; // Very large datasets: 250 per batch (Supabase recommended max)
  }

  /**
   * Split results into optimally-sized batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Determine if an error is critical enough to abort the entire operation
   */
  private isCriticalStorageError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      // Critical errors that should abort the operation
      return (
        errorMessage.includes('foreign key') ||
        errorMessage.includes('constraint') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('permission')
      );
    }
    return false;
  }

  /**
   * Verify that stored data matches what was intended to be stored
   */
  private async verifyStorageIntegrity(
    originalResults: CupPointsResult[]
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      // Sample verification: check a subset of stored records
      const sampleSize = Math.min(10, originalResults.length);
      const sampleResults = originalResults.slice(0, sampleSize);
      
      for (const result of sampleResults) {
        const { data, error } = await this.client
          .from('user_last_round_special_points')
          .select('points')
          .eq('user_id', result.userId)
          .eq('betting_round_id', result.bettingRoundId)
          .eq('season_id', result.seasonId)
          .single();
        
        if (error) {
          return {
            success: false,
            message: `Verification failed: Could not find stored record for user ${result.userId}`,
            details: { error, result }
          };
        }
        
        if (data.points !== result.points) {
          return {
            success: false,
            message: `Verification failed: Points mismatch for user ${result.userId}. Expected: ${result.points}, Found: ${data.points}`,
            details: { expected: result.points, found: data.points }
          };
        }
      }
      
      return {
        success: true,
        message: `Storage integrity verified for ${sampleSize} sample records`
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error }
      };
    }
  }

  private async getBettingRoundsAfterActivation(
    seasonId: number, 
    activationDate: string
  ): Promise<Array<{ id: number; createdAt: string }>> {
    const { data, error } = await this.client
      .from('betting_rounds')
      .select('id, created_at')
      .eq('season_id', seasonId)
      .gte('created_at', activationDate)
      .order('created_at', { ascending: true });

    if (error) {
      throw new CupScoringServiceError('Failed to fetch betting rounds after activation', { 
        error, 
        seasonId, 
        activationDate 
      });
    }

    return (data || []).map(round => ({
      id: round.id,
      createdAt: round.created_at
    }));
  }
}

// Export singleton instance
export const cupScoringService = new CupScoringService();

// Export convenience functions
export const calculateRoundCupPoints = (
  bettingRoundId: number, 
  options?: CupPointsCalculationOptions
) => cupScoringService.calculateRoundCupPoints(bettingRoundId, options);

export const calculateAllCupPointsAfterActivation = (seasonId?: number) => 
  cupScoringService.calculateAllCupPointsAfterActivation(seasonId);

export const getCupStandings = (seasonId?: number) => 
  cupScoringService.getCupStandings(seasonId);

export const getUserCupTotalPoints = (userId: string, seasonId?: number) => 
  cupScoringService.getUserCupTotalPoints(userId, seasonId); 