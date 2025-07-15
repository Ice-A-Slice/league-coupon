import { NextResponse } from 'next/server';
import { detectAndActivateCup } from '@/services/cup/cupActivationDetectionService';
import { logger } from '@/utils/logger';
import { startCronExecution, completeCronExecution } from '@/utils/cron/alerts';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cup-activation
 * 
 * Dedicated cron endpoint for Last Round Special cup activation detection.
 * This endpoint runs daily to check if the cup should be activated based on
 * the trigger condition (60% of teams having ≤5 games remaining).
 * 
 * This endpoint should be called daily at low-traffic time to:
 * - Query fixture data to determine remaining games per team
 * - Calculate if the 60% threshold is met for cup activation
 * - Check if cup is already activated for the current season
 * - Attempt activation if conditions are met and cup is not yet activated
 * - Log comprehensive execution details and audit trail
 * 
 * Authentication: Requires CRON_SECRET in Authorization header or X-Cron-Secret header
 * Schedule: Daily at 01:00 UTC (recommended low-traffic time)
 * 
 * @returns JSON response with activation decision and supporting data
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const executionId = startCronExecution('cup-activation');

  try {
    // Authenticate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');
    
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      logger.error('CRON_SECRET environment variable not configured');
      completeCronExecution(executionId, 'failure', 'CRON_SECRET not configured');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Server configuration error',
          timestamp 
        }, 
        { status: 500 }
      );
    }

    const isAuthorized = 
      authHeader === `Bearer ${expectedSecret}` || 
      cronSecretHeader === expectedSecret;

    if (!isAuthorized) {
      logger.warn('Unauthorized cup activation cron access attempt', {
        authHeader: authHeader ? 'present' : 'missing',
        cronSecretHeader: cronSecretHeader ? 'present' : 'missing',
        timestamp
      });
      completeCronExecution(executionId, 'failure', 'Unauthorized access');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized',
          timestamp 
        }, 
        { status: 401 }
      );
    }

    logger.info('Starting cup activation detection cron job', {
      executionId,
      timestamp,
      jobName: 'cup-activation'
    });

    // Execute cup activation detection
    const result = await detectAndActivateCup({
      service: 'CupActivationCronJob',
      operation: 'daily-activation-check',
      executionId,
      timestamp: new Date().toISOString()
    });

    const duration = Date.now() - startTime;

    // Prepare metrics for monitoring
    const metrics = {
      duration,
      teams_total: result.fixtureData?.totalTeams || 0,
      teams_with_five_or_fewer: result.fixtureData?.teamsWithFiveOrFewerGames || 0,
      activation_percentage: result.activationCondition?.percentageWithFiveOrFewerGames || 0,
      threshold_met: result.activationCondition?.conditionMet ? 1 : 0,
      cup_activated: result.success && result.shouldActivate ? 1 : 0,
      was_already_activated: result.statusCheck?.isActivated ? 1 : 0
    };

    if (result.success) {
      logger.info('Cup activation detection completed successfully', {
        executionId,
        duration,
        shouldActivate: result.shouldActivate,
        actionTaken: result.actionTaken,
        summary: result.summary,
        metrics
      });

      completeCronExecution(executionId, 'success', undefined, metrics);

      // Revalidate cache if activation occurred
      if (result.shouldActivate && result.actionTaken.includes('activated')) {
        try {
          revalidatePath('/standings');
          revalidatePath('/api/standings');
          logger.info('Cache revalidation triggered for standings after cup activation');
        } catch (revalError) {
          logger.error('Error during cache revalidation after cup activation', { 
            error: revalError instanceof Error ? revalError.message : String(revalError),
            executionId 
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Cup activation detection completed successfully',
        data: {
          shouldActivate: result.shouldActivate,
          actionTaken: result.actionTaken,
          summary: result.summary,
          reasoning: result.reasoning,
          seasonId: result.seasonId,
          seasonName: result.seasonName,
          metrics
        },
        executionId,
        timestamp,
        duration
      });

    } else {
      // Handle failures
      const errorMessage = result.error || 'Cup activation detection failed';
      
      logger.error('Cup activation detection failed', {
        executionId,
        duration,
        error: errorMessage,
        errors: result.errors,
        summary: result.summary,
        metrics
      });

      completeCronExecution(executionId, 'failure', errorMessage, metrics);

      return NextResponse.json(
        {
          success: false,
          message: 'Cup activation detection failed',
          error: errorMessage,
          details: {
            errors: result.errors,
            summary: result.summary,
            metrics
          },
          executionId,
          timestamp,
          duration
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Critical error in cup activation cron job', {
      executionId,
      duration,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp
    });

    completeCronExecution(executionId, 'failure', `Critical error: ${errorMessage}`, { duration });

    return NextResponse.json(
      {
        success: false,
        message: 'Critical error in cup activation cron job',
        error: errorMessage,
        executionId,
        timestamp,
        duration
      },
      { status: 500 }
    );
  }
} 