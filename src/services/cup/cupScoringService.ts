import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { cupScoringMonitoringService } from '@/lib/cupScoringMonitoringService';

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

// Edge Case Handling Types
export interface LateSubmissionInfo {
  userId: string;
  fixtureId: number;
  betTimestamp: string;
  matchStartTime: string;
  minutesLate: number;
  isLate: boolean;
}

// Interface for Supabase query result with fixtures join
interface BetWithFixtureData {
  user_id: string;
  fixture_id: number;
  created_at: string;
  fixtures: {
    id: number;
    start_time: string;
  };
}

export interface PointCorrectionRequest {
  userId: string;
  bettingRoundId: number;
  fixtureId?: number; // Optional - if correcting specific fixture
  oldPoints: number;
  newPoints: number;
  reason: string;
  correctionType: 'result_update' | 'manual_override' | 'late_submission';
  adminUserId?: string; // For manual overrides
}

export interface PointCorrectionResult {
  success: boolean;
  message: string;
  details: {
    correctionsApplied: number;
    pointsChanged: number;
    usersAffected: string[];
    conflicts: ConflictInfo[];
  };
}

export interface ConflictInfo {
  userId: string;
  bettingRoundId: number;
  conflictType: 'concurrent_update' | 'data_mismatch' | 'manual_override_conflict';
  existingValue: number;
  attemptedValue: number;
  resolution: 'latest_wins' | 'manual_review_required' | 'admin_override';
  timestamp: string;
}

export interface NotificationInfo {
  type: 'point_correction' | 'late_submission' | 'conflict_resolution' | 'admin_override';
  severity: 'info' | 'warning' | 'error';
  userId?: string;
  bettingRoundId: number;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface EdgeCaseHandlingOptions {
  allowLateSubmissions?: boolean;
  lateSubmissionGracePeriodMinutes?: number;
  enableConflictResolution?: boolean;
  notifyOnPointChanges?: boolean;
  requireAdminApprovalForOverrides?: boolean;
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
    // Start monitoring this operation
    const operationId = cupScoringMonitoringService.startOperation(
      'single_round_calculation',
      options.seasonId || null,
      bettingRoundId,
      'system',
      { options }
    );

    try {
      cupScoringMonitoringService.updateOperationStatus(operationId, 'in_progress');
      
      logger.info('Starting cup points calculation for round', { 
        bettingRoundId, 
        options,
        operationId
      });

      // 1. Get season information and validate cup activation
      const seasonInfo = await this.getSeasonInfoForRound(bettingRoundId);
      if (!seasonInfo) {
        const error = 'Season not found for betting round';
        cupScoringMonitoringService.addError(operationId, 'validation_error', error, 'high', {
          bettingRoundId,
          metadata: { step: 'season_info_validation' }
        });
        throw new CupScoringServiceError(error, { bettingRoundId });
      }

      const { seasonId, seasonName, cupActivated, cupActivatedAt } = seasonInfo;
      
      // Update operation with discovered season ID
      cupScoringMonitoringService.updateOperationProgress(operationId, 0, 0, 0);

      // 2. Check if cup is activated for this season
      if (!cupActivated) {
        logger.info('Cup not activated for season - skipping calculation', { 
          seasonId, 
          seasonName, 
          bettingRoundId,
          operationId
        });
        
        cupScoringMonitoringService.completeOperation(operationId, 'completed', {
          usersProcessed: 0,
          roundsProcessed: 0,
          totalPointsAwarded: 0
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
            cupActivated: cupActivatedAt,
            operationId
          });
          
          cupScoringMonitoringService.completeOperation(operationId, 'completed', {
            usersProcessed: 0,
            roundsProcessed: 0,
            totalPointsAwarded: 0
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
        logger.info('No user bets found for round', { bettingRoundId, operationId });
        
        cupScoringMonitoringService.completeOperation(operationId, 'completed', {
          usersProcessed: 0,
          roundsProcessed: 1,
          totalPointsAwarded: 0
        });
        
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

      logger.info('Found user bets for processing', { 
        bettingRoundId, 
        userCount: userBetsData.length,
        operationId
      });

      // 5. Calculate cup points for each user
      const userResults = await this.calculateUserCupPointsForRound(
        userBetsData,
        bettingRoundId,
        seasonId
      );

      // Track calculation progress
      const successfulUsers = userResults.filter(r => r.processed);
      const totalPoints = successfulUsers.reduce((sum, r) => sum + r.points, 0);
      const errors = userResults.filter(r => r.error);
      
      cupScoringMonitoringService.updateOperationProgress(
        operationId, 
        successfulUsers.length, 
        1, 
        totalPoints
      );

      // Log any calculation errors
      errors.forEach(result => {
        if (result.error) {
          cupScoringMonitoringService.addError(operationId, 'calculation_error', result.error, 'medium', {
            userId: result.userId,
            bettingRoundId: result.bettingRoundId,
            metadata: { step: 'user_points_calculation' }
          });
        }
      });

      // 6. Store the calculated points
      const storeResult = await this.storeCupPoints(userResults);
      
      if (!storeResult.success) {
        cupScoringMonitoringService.addError(operationId, 'storage_error', storeResult.message, 'high', {
          bettingRoundId,
          metadata: { 
            step: 'points_storage',
            userCount: userResults.length,
            totalPoints
          }
        });
      }

      logger.info('Cup points calculation completed', { 
        bettingRoundId, 
        seasonId,
        usersProcessed: successfulUsers.length,
        totalPointsAwarded: totalPoints,
        errorCount: errors.length,
        operationId
      });

      // Complete monitoring with final status
      cupScoringMonitoringService.completeOperation(
        operationId, 
        storeResult.success ? 'completed' : 'failed',
        {
          usersProcessed: successfulUsers.length,
          roundsProcessed: 1,
          totalPointsAwarded: totalPoints
        }
      );

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
      
      // Add error to monitoring
      cupScoringMonitoringService.addError(operationId, 'calculation_error', errorMessage, 'critical', {
        bettingRoundId,
        metadata: { 
          step: 'operation_failure',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      // Complete operation as failed
      cupScoringMonitoringService.completeOperation(operationId, 'failed');
      
      logger.error('Error calculating cup points for round', { 
        bettingRoundId, 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        operationId
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

  // Edge Case Handling Methods

  /**
   * Detect late submissions for a specific round
   * Compares bet timestamps with match start times
   */
  async detectLateSubmissions(
    bettingRoundId: number, 
    options: EdgeCaseHandlingOptions = {}
  ): Promise<LateSubmissionInfo[]> {
    try {
      logger.info(`Detecting late submissions for round ${bettingRoundId}`);

      // Get all bets for the round with fixture start times
      const { data: betsData, error: betsError } = await this.client
        .from('user_bets')
        .select(`
          user_id,
          fixture_id,
          created_at,
          fixtures!inner(
            id,
            start_time
          )
        `)
        .eq('betting_round_id', bettingRoundId) as { data: BetWithFixtureData[] | null; error: unknown };

      if (betsError) {
        throw new CupScoringServiceError('Failed to fetch bets for late submission detection', { betsError });
      }

      if (!betsData?.length) {
        return [];
      }

      const gracePeriodMinutes = options.lateSubmissionGracePeriodMinutes ?? 0;
      const lateSubmissions: LateSubmissionInfo[] = [];

      for (const bet of betsData) {
        const betTime = new Date(bet.created_at);
        // Now we can safely access fixtures as a single object
        const matchStartTime = new Date(bet.fixtures.start_time);
        const minutesDifference = (betTime.getTime() - matchStartTime.getTime()) / (1000 * 60);
        
        const isLate = minutesDifference > gracePeriodMinutes;

        lateSubmissions.push({
          userId: bet.user_id,
          fixtureId: bet.fixture_id,
          betTimestamp: bet.created_at,
          matchStartTime: bet.fixtures.start_time,
          minutesLate: Math.max(0, minutesDifference),
          isLate
        });
      }

      const lateCount = lateSubmissions.filter(s => s.isLate).length;
      logger.info(`Detected ${lateCount} late submissions out of ${lateSubmissions.length} total bets`);

      return lateSubmissions;
    } catch (error) {
      logger.error('Error detecting late submissions:', error);
      throw error;
    }
  }

  /**
   * Handle point corrections when match results are updated
   */
  async handlePointCorrections(
    corrections: PointCorrectionRequest[], 
    options: EdgeCaseHandlingOptions = {}
  ): Promise<PointCorrectionResult> {
    try {
      logger.info(`Processing ${corrections.length} point corrections`);

      const result: PointCorrectionResult = {
        success: true,
        message: '',
        details: {
          correctionsApplied: 0,
          pointsChanged: 0,
          usersAffected: [],
          conflicts: []
        }
      };

      for (const correction of corrections) {
        try {
          // Check for existing points to detect conflicts
          const { data: existingPoints, error: fetchError } = await this.client
            .from('user_last_round_special_points')
            .select('points, last_updated')
            .eq('user_id', correction.userId)
            .eq('betting_round_id', correction.bettingRoundId)
            .maybeSingle();

          if (fetchError) {
            logger.error(`Error fetching existing points for correction:`, fetchError);
            continue;
          }

          // Detect conflicts
          if (existingPoints && options.enableConflictResolution) {
            const conflict = await this.detectAndResolveConflict(
              correction, 
              existingPoints.points, 
              existingPoints.last_updated
            );
            
            if (conflict) {
              result.details.conflicts.push(conflict);
              
              // Skip if manual review required
              if (conflict.resolution === 'manual_review_required') {
                continue;
              }
            }
          }

          // Apply the correction
          const { error: updateError } = await this.client
            .from('user_last_round_special_points')
            .upsert({
              user_id: correction.userId,
              betting_round_id: correction.bettingRoundId,
              season_id: (await this.getSeasonInfoForRound(correction.bettingRoundId))?.seasonId,
              points: correction.newPoints,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'user_id,betting_round_id'
            });

          if (updateError) {
            logger.error(`Error applying point correction:`, updateError);
            continue;
          }

          result.details.correctionsApplied++;
          result.details.pointsChanged += Math.abs(correction.newPoints - correction.oldPoints);
          
          if (!result.details.usersAffected.includes(correction.userId)) {
            result.details.usersAffected.push(correction.userId);
          }

          // Create notification
          if (options.notifyOnPointChanges) {
            await this.createNotification({
              type: 'point_correction',
              severity: 'info',
              userId: correction.userId,
              bettingRoundId: correction.bettingRoundId,
              message: `Points corrected from ${correction.oldPoints} to ${correction.newPoints}. Reason: ${correction.reason}`,
              metadata: {
                correctionType: correction.correctionType,
                pointsDifference: correction.newPoints - correction.oldPoints,
                adminUserId: correction.adminUserId
              },
              timestamp: new Date().toISOString()
            });
          }

        } catch (error) {
          logger.error(`Error processing correction for user ${correction.userId}:`, error);
          result.success = false;
        }
      }

      result.message = `Applied ${result.details.correctionsApplied} corrections affecting ${result.details.usersAffected.length} users`;
      logger.info(result.message);

      return result;
    } catch (error) {
      logger.error('Error handling point corrections:', error);
      throw error;
    }
  }

  /**
   * Apply manual administrative override to user points
   */
  async applyManualOverride(
    userId: string,
    bettingRoundId: number,
    newPoints: number,
    reason: string,
    adminUserId: string,
    options: EdgeCaseHandlingOptions = {}
  ): Promise<PointCorrectionResult> {
    try {
      logger.info(`Applying manual override for user ${userId} in round ${bettingRoundId}`);

      // Require admin approval if configured
      if (options.requireAdminApprovalForOverrides) {
        // In a real system, this would check admin permissions
        logger.info(`Admin override requested by ${adminUserId} for user ${userId}`);
      }

      // Get current points
      const { data: currentData, error: fetchError } = await this.client
        .from('user_last_round_special_points')
        .select('points')
        .eq('user_id', userId)
        .eq('betting_round_id', bettingRoundId)
        .maybeSingle();

      if (fetchError) {
        throw new CupScoringServiceError('Failed to fetch current points for override', { fetchError });
      }

      const oldPoints = currentData?.points ?? 0;

      const correction: PointCorrectionRequest = {
        userId,
        bettingRoundId,
        oldPoints,
        newPoints,
        reason: `Manual override by admin: ${reason}`,
        correctionType: 'manual_override',
        adminUserId
      };

      const result = await this.handlePointCorrections([correction], options);

      // Create admin override notification
      if (options.notifyOnPointChanges) {
        await this.createNotification({
          type: 'admin_override',
          severity: 'warning',
          userId,
          bettingRoundId,
          message: `Admin ${adminUserId} manually overrode points from ${oldPoints} to ${newPoints}`,
          metadata: {
            adminUserId,
            reason,
            pointsDifference: newPoints - oldPoints
          },
          timestamp: new Date().toISOString()
        });
      }

      return result;
    } catch (error) {
      logger.error('Error applying manual override:', error);
      throw error;
    }
  }

  /**
   * Process late submissions with grace period handling
   */
  async processLateSubmissions(
    bettingRoundId: number,
    options: EdgeCaseHandlingOptions = {}
  ): Promise<PointCorrectionResult> {
    try {
      if (!options.allowLateSubmissions) {
        return {
          success: true,
          message: 'Late submissions not allowed',
          details: {
            correctionsApplied: 0,
            pointsChanged: 0,
            usersAffected: [],
            conflicts: []
          }
        };
      }

      const lateSubmissions = await this.detectLateSubmissions(bettingRoundId, options);
      const lateOnes = lateSubmissions.filter(s => s.isLate);

      if (lateOnes.length === 0) {
        return {
          success: true,
          message: 'No late submissions found',
          details: {
            correctionsApplied: 0,
            pointsChanged: 0,
            usersAffected: [],
            conflicts: []
          }
        };
      }

      logger.info(`Processing ${lateOnes.length} late submissions`);

      // Create notifications for late submissions
      for (const late of lateOnes) {
        if (options.notifyOnPointChanges) {
          await this.createNotification({
            type: 'late_submission',
            severity: 'warning',
            userId: late.userId,
            bettingRoundId,
            message: `Late submission detected: bet placed ${late.minutesLate.toFixed(1)} minutes after match start`,
            metadata: {
              fixtureId: late.fixtureId,
              minutesLate: late.minutesLate,
              gracePeriodMinutes: options.lateSubmissionGracePeriodMinutes ?? 0
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      return {
        success: true,
        message: `Processed ${lateOnes.length} late submissions`,
        details: {
          correctionsApplied: lateOnes.length,
          pointsChanged: 0, // Late submissions don't change points, just flag them
          usersAffected: [...new Set(lateOnes.map(s => s.userId))],
          conflicts: []
        }
      };
    } catch (error) {
      logger.error('Error processing late submissions:', error);
      throw error;
    }
  }

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

  /**
   * Detect and resolve conflicts when multiple updates occur
   */
  private async detectAndResolveConflict(
    correction: PointCorrectionRequest,
    existingPoints: number,
    lastUpdated: string
  ): Promise<ConflictInfo | null> {
    try {
      const now = new Date();
      const lastUpdate = new Date(lastUpdated);
      const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
      
      // Consider it a conflict if updated within last 5 minutes and values differ
      const isRecentUpdate = timeSinceUpdate < 5 * 60 * 1000; // 5 minutes
      const valuesDiffer = existingPoints !== correction.oldPoints;

      if (!isRecentUpdate && !valuesDiffer) {
        return null; // No conflict
      }

      let conflictType: ConflictInfo['conflictType'] = 'data_mismatch';
      let resolution: ConflictInfo['resolution'] = 'latest_wins';

      if (isRecentUpdate) {
        conflictType = 'concurrent_update';
        
        // Admin overrides take precedence
        if (correction.correctionType === 'manual_override') {
          conflictType = 'manual_override_conflict';
          resolution = 'admin_override';
        } else if (Math.abs(correction.newPoints - correction.oldPoints) > 10) {
          // Large point corrections require manual review, regardless of existing value differences
          resolution = 'manual_review_required';
        } else if (valuesDiffer) {
          // For smaller corrections, only require review if values actually differ
          resolution = 'latest_wins';
        }
      }

      const conflict: ConflictInfo = {
        userId: correction.userId,
        bettingRoundId: correction.bettingRoundId,
        conflictType,
        existingValue: existingPoints,
        attemptedValue: correction.newPoints,
        resolution,
        timestamp: now.toISOString()
      };

      logger.warn(`Conflict detected for user ${correction.userId}:`, conflict);

      // Create conflict notification
      await this.createNotification({
        type: 'conflict_resolution',
        severity: resolution === 'manual_review_required' ? 'error' : 'warning',
        userId: correction.userId,
        bettingRoundId: correction.bettingRoundId,
        message: `Conflict detected: ${conflictType}, resolution: ${resolution}`,
        metadata: {
          conflict,
          correctionType: correction.correctionType,
          timeSinceUpdate,
          adminUserId: correction.adminUserId
        },
        timestamp: now.toISOString()
      });

      return conflict;
    } catch (error) {
      logger.error('Error detecting/resolving conflict:', error);
      return null;
    }
  }

  /**
   * Create notification for significant events
   */
  private async createNotification(notification: NotificationInfo): Promise<void> {
    try {
      // Log the notification
      const logLevel = notification.severity === 'error' ? 'error' : 
                     notification.severity === 'warning' ? 'warn' : 'info';
      
      logger[logLevel](`[${notification.type.toUpperCase()}] ${notification.message}`, {
        userId: notification.userId,
        bettingRoundId: notification.bettingRoundId,
        metadata: notification.metadata
      });

      // In a production system, you might also:
      // 1. Store notifications in a database table
      // 2. Send emails/SMS for critical notifications
      // 3. Push to a real-time notification service
      // 4. Integrate with monitoring/alerting systems
      
      // For now, we'll store critical notifications in the database
      if (notification.severity === 'error' || notification.type === 'admin_override') {
        try {
          // This would require a notifications table in the database
          // For demonstration, we'll just log it with extra detail
          logger.error('CRITICAL NOTIFICATION - Store in DB:', {
            type: notification.type,
            severity: notification.severity,
            userId: notification.userId,
            bettingRoundId: notification.bettingRoundId,
            message: notification.message,
            metadata: notification.metadata,
            timestamp: notification.timestamp
          });
        } catch (dbError) {
          logger.error('Failed to store critical notification in database:', dbError);
        }
      }

    } catch (error) {
      logger.error('Error creating notification:', error);
      // Don't throw - notifications shouldn't break the main flow
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

// Edge Case Handling Exports
export const detectLateSubmissions = (bettingRoundId: number, options?: EdgeCaseHandlingOptions) =>
  cupScoringService.detectLateSubmissions(bettingRoundId, options);

export const handlePointCorrections = (corrections: PointCorrectionRequest[], options?: EdgeCaseHandlingOptions) =>
  cupScoringService.handlePointCorrections(corrections, options);

export const applyManualOverride = (
  userId: string,
  bettingRoundId: number,
  newPoints: number,
  reason: string,
  adminUserId: string,
  options?: EdgeCaseHandlingOptions
) => cupScoringService.applyManualOverride(userId, bettingRoundId, newPoints, reason, adminUserId, options);

export const processLateSubmissions = (bettingRoundId: number, options?: EdgeCaseHandlingOptions) =>
  cupScoringService.processLateSubmissions(bettingRoundId, options); 