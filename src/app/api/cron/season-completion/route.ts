import { NextResponse } from 'next/server';
import { SeasonCompletionDetectorService } from '@/services/seasonCompletionDetectorService';
import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/season-completion
 * 
 * Cron endpoint for automated season completion detection.
 * This endpoint should be called periodically (e.g., daily) to:
 * - Check for seasons where all fixtures are complete
 * - Mark those seasons as completed with a timestamp
 * 
 * Authentication: Requires CRON_SECRET environment variable
 * 
 * Returns:
 * - 200: Success with detection results
 * - 401: Unauthorized (missing or invalid CRON_SECRET)
 * - 500: Internal server error
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  logger.info('SeasonCompletion: Starting cron job for season completion detection...');

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
    // Initialize Supabase service role client for the detector service
    const serviceRoleClient = getSupabaseServiceRoleClient();
    
    // Initialize the season completion detector service
    const detectorService = new SeasonCompletionDetectorService(serviceRoleClient);
    
    // Run the season completion detection
    const detectionResult = await detectorService.detectAndMarkCompletedSeasons();
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Analyze results
    const totalProcessed = detectionResult.processedCount + detectionResult.skippedCount;
    const hasErrors = detectionResult.errors.length > 0;

    const summary = {
      success: !hasErrors || detectionResult.completedSeasonIds.length > 0,
      message: `Season completion check completed. ${detectionResult.completedSeasonIds.length} seasons marked as complete.`,
      duration_ms: duration,
      total_seasons_checked: totalProcessed,
      completed_seasons: detectionResult.completedSeasonIds.length,
      seasons_in_progress: detectionResult.skippedCount,
      error_count: detectionResult.errors.length,
      completed_season_ids: detectionResult.completedSeasonIds,
      timestamp: new Date().toISOString()
    };

    // Log completion info
    if (detectionResult.completedSeasonIds.length > 0) {
      logger.info(`SeasonCompletion: Marked ${detectionResult.completedSeasonIds.length} seasons as complete`, {
        completedSeasonIds: detectionResult.completedSeasonIds,
        duration
      });

      // Trigger cache revalidation since season data has changed
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

    // Log any errors but don't fail the entire operation
    if (hasErrors) {
      logger.warn('SeasonCompletion: Some errors occurred during detection', {
        errorCount: detectionResult.errors.length,
        errors: detectionResult.errors.map(e => e.message)
      });
    }

    logger.info('SeasonCompletion: Cron job completed', summary);

    // Include detailed results in response for debugging
    return NextResponse.json({
      ...summary,
      detailed_errors: hasErrors ? detectionResult.errors.map(e => e.message) : undefined
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

    return NextResponse.json({
      success: false,
      error: 'Season completion detection failed',
      message: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 