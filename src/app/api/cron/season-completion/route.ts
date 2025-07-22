import { NextResponse } from 'next/server';
import { SeasonCompletionDetectorService } from '@/services/seasonCompletionDetectorService';
import { WinnerDeterminationService, WinnerDeterminationResult } from '@/services/winnerDeterminationService';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { revalidatePath } from 'next/cache';
import { startCronExecution, completeCronExecution } from '@/utils/cron/alerts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/season-completion
 * 
 * Cron endpoint for automated season completion detection and winner determination.
 * This endpoint should be called periodically (e.g., weekly) to:
 * - Check for seasons where all fixtures are complete
 * - Mark those seasons as completed with a timestamp
 * - Determine winners for any newly completed seasons
 * 
 * Authentication: Requires CRON_SECRET environment variable
 * 
 * Returns:
 * - 200: Success with detection and winner determination results
 * - 401: Unauthorized (missing or invalid CRON_SECRET)
 * - 500: Internal server error
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const executionId = startCronExecution('season-completion');
  logger.info('SeasonCompletion: Starting cron job for season completion detection and winner determination...', { executionId });

  // Authenticate cron job using secret (support both Bearer and X-Cron-Secret headers)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');
  
  const isValidAuth = cronSecret && (
    authHeader === `Bearer ${cronSecret}` || 
    cronSecretHeader === cronSecret
  );
  
  if (!isValidAuth) {
    logger.error('SeasonCompletion: Unauthorized attempt to run season completion cron job', {
      hasSecret: !!cronSecret,
      hasAuth: !!authHeader,
      hasCronHeader: !!cronSecretHeader,
      authMatches: authHeader === `Bearer ${cronSecret}`,
      cronHeaderMatches: cronSecretHeader === cronSecret
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Initialize Supabase service role client for both services
    const serviceRoleClient = createSupabaseServiceRoleClient();
    
    // Initialize the season completion detector service
    const detectorService = new SeasonCompletionDetectorService(serviceRoleClient);
    
    // Run the season completion detection
    const detectionResult = await detectorService.detectAndMarkCompletedSeasons();
    
    // Initialize winner determination variables
    let winnerDeterminationResults: WinnerDeterminationResult[] = [];
    let winnerDeterminationErrors: string[] = [];
    let totalWinnersProcessed = 0;

    // If seasons were marked as complete, determine winners for them
    if (detectionResult.completedSeasonIds.length > 0) {
      logger.info(`SeasonCompletion: ${detectionResult.completedSeasonIds.length} seasons marked as complete, determining winners...`, {
        completedSeasonIds: detectionResult.completedSeasonIds
      });

      try {
        // Initialize the winner determination service
        const winnerService = new WinnerDeterminationService(serviceRoleClient);
        
        // Determine winners for completed seasons
        winnerDeterminationResults = await winnerService.determineWinnersForCompletedSeasons();
        
        // Analyze winner determination results
        const successfulDeterminations = winnerDeterminationResults.filter(r => r.errors.length === 0);
        const failedDeterminations = winnerDeterminationResults.filter(r => r.errors.length > 0);
        
        totalWinnersProcessed = winnerDeterminationResults.reduce((sum, r) => sum + r.winners.length, 0);
        
        if (successfulDeterminations.length > 0) {
          logger.info(`SeasonCompletion: Successfully determined winners for ${successfulDeterminations.length} seasons`, {
            successfulSeasons: successfulDeterminations.map(r => r.seasonId),
            totalWinners: totalWinnersProcessed
          });
        }
        
        if (failedDeterminations.length > 0) {
          winnerDeterminationErrors = failedDeterminations.flatMap(r => r.errors.map(e => e.message));
          logger.warn(`SeasonCompletion: Failed to determine winners for ${failedDeterminations.length} seasons`, {
            failedSeasons: failedDeterminations.map(r => r.seasonId),
            errors: winnerDeterminationErrors
          });
        }

      } catch (winnerError) {
        const errorMessage = winnerError instanceof Error ? winnerError.message : String(winnerError);
        winnerDeterminationErrors.push(errorMessage);
        logger.error('SeasonCompletion: Winner determination service failed', {
          error: errorMessage,
          stack: winnerError instanceof Error ? winnerError.stack : undefined,
          completedSeasonIds: detectionResult.completedSeasonIds
        });
      }
    }

    // Send enhanced season finale summary emails if seasons were completed
    let emailSendingResults = {
      attempted: false,
      success: false,
      totalSent: 0,
      errors: [] as string[]
    };

    if (detectionResult.completedSeasonIds.length > 0) {
      logger.info(`SeasonCompletion: Sending enhanced summary emails for ${detectionResult.completedSeasonIds.length} completed seasons`);
      
      try {
        // Call the summary email endpoint with season finale context
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Secret': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({
            test_mode: false,
            // Don't specify round_id to trigger season finale detection automatically
            // Our enhanced EmailDataService will detect completed seasons and include cup data
          }),
        });

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json();
          emailSendingResults = {
            attempted: true,
            success: emailResult.success,
            totalSent: emailResult.email_stats?.total_sent || 0,
            errors: emailResult.errors ? [emailResult.errors.slice(0, 3).join(', ')] : []
          };
          
          logger.info('SeasonCompletion: Enhanced summary emails sent successfully', {
            totalSent: emailSendingResults.totalSent,
            operationId: emailResult.operation_id
          });
        } else {
          const errorText = await emailResponse.text();
          emailSendingResults.errors.push(`HTTP ${emailResponse.status}: ${errorText}`);
          logger.error('SeasonCompletion: Failed to send enhanced summary emails', {
            status: emailResponse.status,
            error: errorText
          });
        }
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        emailSendingResults.errors.push(errorMessage);
        logger.error('SeasonCompletion: Enhanced summary email sending failed', {
          error: errorMessage,
          completedSeasonIds: detectionResult.completedSeasonIds
        });
      }

      emailSendingResults.attempted = true;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Analyze overall results
    const totalProcessed = detectionResult.processedCount + detectionResult.skippedCount;
    const hasSeasonDetectionErrors = detectionResult.errors.length > 0;
    const hasWinnerDeterminationErrors = winnerDeterminationErrors.length > 0;
    const hasAnyErrors = hasSeasonDetectionErrors || hasWinnerDeterminationErrors;

    const summary = {
      success: !hasAnyErrors || detectionResult.completedSeasonIds.length > 0,
      message: `Season completion check completed. ${detectionResult.completedSeasonIds.length} seasons marked as complete. ${totalWinnersProcessed} winners determined.${emailSendingResults.attempted ? ` Enhanced summary emails: ${emailSendingResults.totalSent} sent.` : ''}`,
      duration_ms: duration,
      total_seasons_checked: totalProcessed,
      completed_seasons: detectionResult.completedSeasonIds.length,
      seasons_in_progress: detectionResult.skippedCount,
      season_detection_error_count: detectionResult.errors.length,
      completed_season_ids: detectionResult.completedSeasonIds,
      winner_determination_processed: winnerDeterminationResults.length,
      total_winners_determined: totalWinnersProcessed,
      winner_determination_error_count: winnerDeterminationErrors.length,
      enhanced_email_attempted: emailSendingResults.attempted,
      enhanced_email_success: emailSendingResults.success,
      enhanced_email_total_sent: emailSendingResults.totalSent,
      enhanced_email_error_count: emailSendingResults.errors.length,
      timestamp: new Date().toISOString()
    };

    // Log completion info and trigger cache revalidation
    if (detectionResult.completedSeasonIds.length > 0) {
      logger.info(`SeasonCompletion: Marked ${detectionResult.completedSeasonIds.length} seasons as complete and determined ${totalWinnersProcessed} winners`, {
        completedSeasonIds: detectionResult.completedSeasonIds,
        totalWinners: totalWinnersProcessed,
        duration
      });

      // Trigger cache revalidation since season and standings data may have changed
      try {
        revalidatePath('/');
        revalidatePath('/standings');
        logger.info('[season-completion] Cache revalidation triggered for paths: /, /standings');
      } catch (revalError) {
        logger.error('[season-completion] Error during cache revalidation:', revalError);
      }
    } else {
      logger.info('SeasonCompletion: No seasons marked as complete', { 
        seasonsChecked: totalProcessed,
        duration 
      });
    }

    // Log any errors but don't fail the entire operation if we had some success
    if (hasSeasonDetectionErrors) {
      logger.warn('SeasonCompletion: Some errors occurred during season detection', {
        errorCount: detectionResult.errors.length,
        errors: detectionResult.errors.map(e => e.message)
      });
    }

    if (hasWinnerDeterminationErrors) {
      logger.warn('SeasonCompletion: Some errors occurred during winner determination', {
        errorCount: winnerDeterminationErrors.length,
        errors: winnerDeterminationErrors
      });
    }

    logger.info('SeasonCompletion: Cron job completed', summary);

    // Report successful execution to alerting system
    completeCronExecution(executionId, 'success', undefined, {
      seasonsChecked: totalProcessed,
      seasonsCompleted: detectionResult.completedSeasonIds.length,
      winnersProcessed: totalWinnersProcessed,
      durationMs: duration
    });

    // Include detailed results in response for debugging
    return NextResponse.json({
      ...summary,
      detailed_season_detection_errors: hasSeasonDetectionErrors ? detectionResult.errors.map(e => e.message) : undefined,
      detailed_winner_determination_errors: hasWinnerDeterminationErrors ? winnerDeterminationErrors : undefined,
      detailed_enhanced_email_errors: emailSendingResults.errors.length > 0 ? emailSendingResults.errors : undefined,
      winner_determination_results: winnerDeterminationResults.length > 0 ? winnerDeterminationResults.map(r => ({
        seasonId: r.seasonId,
        winnersCount: r.winners.length,
        totalPlayers: r.totalPlayers,
        isAlreadyDetermined: r.isSeasonAlreadyDetermined,
        hasErrors: r.errors.length > 0
      })) : undefined
    }, { status: 200 });

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('SeasonCompletion: Cron job failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });

    // Report failed execution to alerting system
    completeCronExecution(executionId, 'failure', errorMessage, {
      durationMs: duration
    });

    return NextResponse.json({
      success: false,
      error: 'Season completion detection and winner determination failed',
      message: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 