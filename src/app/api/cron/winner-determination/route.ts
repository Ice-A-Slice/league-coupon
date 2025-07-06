import { NextResponse } from 'next/server';
import { WinnerDeterminationService, WinnerDeterminationResult } from '@/services/winnerDeterminationService';
import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { revalidatePath } from 'next/cache';
import { startCronExecution, completeCronExecution } from '@/utils/cron/alerts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/winner-determination
 * 
 * Dedicated cron endpoint for winner determination processing.
 * This endpoint can be called independently to determine winners for any 
 * completed seasons that haven't had their winners determined yet.
 * 
 * This endpoint should be called periodically (e.g., daily) to:
 * - Find seasons that are complete but haven't had winners determined
 * - Process winner determination for those seasons
 * - Update the Hall of Fame records
 * - Revalidate cached standings data
 * 
 * Authentication: Requires CRON_SECRET in Authorization header or X-Cron-Secret header
 * Schedule: Daily at 02:00 UTC (recommended)
 * 
 * @returns JSON response with processing results and metrics
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const executionId = startCronExecution('winner-determination');

  try {
    // Authenticate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');
    
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      logger.error('CRON_SECRET environment variable not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecretHeader;
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn('Unauthorized cron request to winner determination endpoint', {
        hasAuthHeader: !!authHeader,
        hasCronHeader: !!cronSecretHeader,
        timestamp
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting winner determination cron job', { timestamp });

    // Initialize service
    const supabaseClient = getSupabaseServiceRoleClient();
    const winnerDeterminationService = new WinnerDeterminationService(supabaseClient);

    // Process winner determination for all eligible seasons
    let winnerDeterminationResults: WinnerDeterminationResult[] | null = null;
    const winnerDeterminationErrors: string[] = [];
    let totalWinnersProcessed = 0;
    let totalWinnersDetermined = 0;

    try {
      logger.info('Triggering winner determination for completed seasons');
      winnerDeterminationResults = await winnerDeterminationService.determineWinnersForCompletedSeasons();
      
      // Process results
      if (Array.isArray(winnerDeterminationResults)) {
        totalWinnersProcessed = winnerDeterminationResults.length;
        totalWinnersDetermined = winnerDeterminationResults.filter(
          result => !result.isSeasonAlreadyDetermined && result.winners.length > 0
        ).length;
        
        // Collect any errors from individual season processing
        winnerDeterminationResults.forEach(result => {
          if (result.errors && result.errors.length > 0) {
            winnerDeterminationErrors.push(...result.errors.map((e: { message: string } | string) => 
              typeof e === 'string' ? e : e.message || String(e)
            ));
          }
        });
      }

      if (totalWinnersDetermined > 0) {
        logger.info(`Winner determination completed successfully`, {
          totalWinnersProcessed,
          totalWinnersDetermined,
          errorCount: winnerDeterminationErrors.length,
          timestamp
        });

        // Revalidate cached standings data since winners may have been determined
        try {
          revalidatePath('/standings');
          logger.info('Revalidated standings cache');
        } catch (revalidateError) {
          logger.warn('Failed to revalidate standings cache', { 
            error: revalidateError instanceof Error ? revalidateError.message : String(revalidateError)
          });
        }
      } else {
        logger.info('No new winners to determine', {
          totalWinnersProcessed,
          alreadyDeterminedCount: winnerDeterminationResults?.filter(r => r.isSeasonAlreadyDetermined).length || 0,
          timestamp
        });
      }

    } catch (winnerDeterminationError) {
      // Service-level error - this should be a 500 response
      const duration = Date.now() - startTime;
      const errorMessage = winnerDeterminationError instanceof Error 
        ? winnerDeterminationError.message 
        : String(winnerDeterminationError);
      
      logger.error('Winner determination service failed', {
        error: errorMessage,
        duration,
        timestamp
      });

      // Report failed execution to alerting system
      completeCronExecution(executionId, 'failure', errorMessage, {
        durationMs: duration
      });

      return NextResponse.json({
        success: false,
        error: 'Winner determination failed',
        message: errorMessage,
        timestamp,
        duration_ms: duration
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    const hasErrors = winnerDeterminationErrors.length > 0;
    const success = !hasErrors || totalWinnersDetermined > 0; // Success if we determined some winners or had no errors

    // Determine log level and final message
    if (hasErrors && totalWinnersDetermined === 0) {
      logger.error('Winner determination cron job completed with errors and no winners determined', {
        errorCount: winnerDeterminationErrors.length,
        duration,
        timestamp
      });
    } else if (hasErrors) {
      logger.warn('Winner determination cron job completed with some errors but determined winners successfully', {
        totalWinnersDetermined,
        errorCount: winnerDeterminationErrors.length,
        duration,
        timestamp
      });
    } else {
      logger.info('Winner determination cron job completed successfully', {
        totalWinnersDetermined,
        duration,
        timestamp
      });
    }

    // Build comprehensive response
    const response = {
      success,
      message: `Winner determination check completed. ${totalWinnersDetermined} winners determined.`,
      timestamp,
      duration_ms: duration,
      total_seasons_processed: totalWinnersProcessed,
      total_winners_determined: totalWinnersDetermined,
      error_count: winnerDeterminationErrors.length,
      winner_determination_results: winnerDeterminationResults,
      ...(winnerDeterminationErrors.length > 0 && {
        detailed_errors: winnerDeterminationErrors
      })
    };

    // Report successful execution to alerting system
    completeCronExecution(executionId, 'success', undefined, {
      seasonsProcessed: totalWinnersProcessed,
      winnersProcessed: totalWinnersDetermined,
      errorCount: winnerDeterminationErrors.length,
      durationMs: duration
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Winner determination cron job failed', {
      error: errorMessage,
      duration,
      timestamp
    });

    // Report failed execution to alerting system
    completeCronExecution(executionId, 'failure', errorMessage, {
      durationMs: duration
    });

    return NextResponse.json({
      success: false,
      error: 'Winner determination failed',
      message: errorMessage,
      timestamp,
      duration_ms: duration
    }, { status: 500 });
  }
} 