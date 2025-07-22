import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { SeasonCompletionDetectorService } from '@/services/seasonCompletionDetectorService';
import { WinnerDeterminationService } from '@/services/winnerDeterminationService';
import { logger } from '@/utils/logger';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/admin/season-complete
 * 
 * Admin endpoint to manually trigger season completion and winner determination.
 * This endpoint allows administrators to force completion of a specific season
 * and determine its winner outside of the normal automated process.
 * 
 * Authentication: Requires CRON_SECRET (admin operation)
 * 
 * Body Parameters:
 * - season_id: number - The ID of the season to complete
 * - force?: boolean (default: false) - Force completion even if criteria not met
 * - skip_winner_determination?: boolean (default: false) - Complete season but skip winner determination
 * 
 * Returns:
 * - 200: Success with completion and winner determination results
 * - 400: Invalid parameters or season not eligible for completion
 * - 401: Unauthorized (missing or invalid admin credentials)
 * - 404: Season not found
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Admin Season Complete: Processing request', { requestId });

    // Authentication - Admin only (using CRON_SECRET pattern for admin operations)
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;
    
    const isValidAuth = cronSecret && (
      authHeader === `Bearer ${cronSecret}` || 
      cronSecretHeader === cronSecret
    );
    
    if (!isValidAuth) {
      logger.warn('Admin Season Complete: Unauthorized attempt', {
        requestId,
        hasSecret: !!cronSecret,
        hasAuth: !!authHeader,
        hasCronHeader: !!cronSecretHeader
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - admin access required' 
      }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { season_id, force = false, skip_winner_determination = false } = body;

    if (!season_id || typeof season_id !== 'number') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid season_id', 
          details: 'season_id must be a valid number' 
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createSupabaseServiceRoleClient();

    // Check if season exists and get its current status
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select(`
        id,
        name,
        api_season_year,
        competition_id,
        is_current,
        completed_at,
        winner_determined_at,
        start_date,
        end_date,
        competition:competitions!seasons_competition_id_fkey(
          id,
          name,
          country_name
        )
      `)
      .eq('id', season_id)
      .single();

    if (seasonError || !season) {
      logger.info('Admin Season Complete: Season not found', { 
        requestId, 
        seasonId: season_id 
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Season not found',
          details: `No season found with ID ${season_id}`
        },
        { status: 404 }
      );
    }

    // Check if season is already completed (unless force is true)
    if (season.completed_at && !force) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Season already completed',
          details: `Season ${season_id} was completed on ${season.completed_at}`,
          season_info: {
            id: season.id,
            name: season.name,
            completed_at: season.completed_at,
            winner_determined: !!season.winner_determined_at
          }
        },
        { status: 400 }
      );
    }

    logger.info('Admin Season Complete: Processing season completion', {
      requestId,
      seasonId: season_id,
      seasonName: season.name,
      force,
      skipWinnerDetermination: skip_winner_determination,
      alreadyCompleted: !!season.completed_at
    });

    // Initialize services
    const detectorService = new SeasonCompletionDetectorService();
    const winnerService = new WinnerDeterminationService(supabase);

    let completionResult = null;
    let winnerDeterminationResult = null;
    const errors: string[] = [];

    try {
      // Step 1: Mark season as completed
      if (!season.completed_at || force) {
        if (force) {
          // Force completion by directly updating the database
          const { error: updateError } = await supabase
            .from('seasons')
            .update({ 
              completed_at: new Date().toISOString(),
              is_current: false
            })
            .eq('id', season_id);

          if (updateError) {
            throw new Error(`Failed to force complete season: ${updateError.message}`);
          }

          completionResult = {
            season_id: season_id,
            completed: true,
            forced: true,
            completed_at: new Date().toISOString()
          };

          logger.info('Admin Season Complete: Forced season completion', {
            requestId,
            seasonId: season_id
          });

        } else {
          // Use the detector service to check eligibility and complete
          const detectionResult = await detectorService.detectAndMarkCompletedSeasons();
          
          // Check if our season was in the completed list
          const wasCompleted = detectionResult.completedSeasonIds.includes(season_id);
          
          if (!wasCompleted) {
            errors.push('Season does not meet automatic completion criteria. Use force=true to override.');
          } else {
            completionResult = {
              season_id: season_id,
              completed: true,
              forced: false,
              detection_result: detectionResult
            };
          }
        }
      } else {
        completionResult = {
          season_id: season_id,
          completed: true,
          already_completed: true,
          completed_at: season.completed_at
        };
      }

      // Step 2: Determine winner (if requested and completion was successful)
      if (!skip_winner_determination && (completionResult?.completed || season.completed_at)) {
        try {
          const winnerResults = await winnerService.determineWinnersForCompletedSeasons();
          
          // Find our season in the results
          const ourSeasonResult = winnerResults.find(result => result.seasonId === season_id);
          
          if (ourSeasonResult) {
            winnerDeterminationResult = ourSeasonResult;
            logger.info('Admin Season Complete: Winner determination completed', {
              requestId,
              seasonId: season_id,
              winnerId: ourSeasonResult.winners?.[0]?.user_id,
              winnerPoints: ourSeasonResult.winners?.[0]?.total_points
            });
          } else {
            // Try to determine winner specifically for this season
            logger.info('Admin Season Complete: Season not in auto-determination results, attempting manual determination', {
              requestId,
              seasonId: season_id
            });
            // Note: Could add specific winner determination logic here if needed
          }

        } catch (winnerError) {
          const errorMessage = `Winner determination failed: ${winnerError instanceof Error ? winnerError.message : String(winnerError)}`;
          errors.push(errorMessage);
          logger.error('Admin Season Complete: Winner determination error', {
            requestId,
            seasonId: season_id,
            error: errorMessage
          });
        }
      }

    } catch (processingError) {
      const errorMessage = `Season completion failed: ${processingError instanceof Error ? processingError.message : String(processingError)}`;
      errors.push(errorMessage);
      logger.error('Admin Season Complete: Processing error', {
        requestId,
        seasonId: season_id,
        error: errorMessage
      });
    }

    // Revalidate relevant cache paths
    try {
      revalidatePath('/api/hall-of-fame');
      revalidatePath('/api/hall-of-fame/stats');
      revalidatePath(`/api/hall-of-fame/season/${season_id}`);
    } catch (revalidateError) {
      logger.warn('Admin Season Complete: Cache revalidation failed', {
        requestId,
        error: revalidateError instanceof Error ? revalidateError.message : String(revalidateError)
      });
    }

    // Build response
    const hasErrors = errors.length > 0;
    const success = !hasErrors && completionResult?.completed;

    const response = {
      success,
      data: {
        season: {
          id: season.id,
          name: season.name,
          api_season_year: season.api_season_year,
          competition: season.competition
        },
        completion_result: completionResult,
        winner_determination_result: winnerDeterminationResult,
        skipped_winner_determination: skip_winner_determination,
        forced: force
      },
      errors: hasErrors ? errors : undefined,
      processing_info: {
        request_id: requestId,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };

    const statusCode = hasErrors ? (success ? 207 : 500) : 200; // 207 for partial success

    logger.info('Admin Season Complete: Request completed', {
      requestId,
      seasonId: season_id,
      success,
      hasErrors,
      processingTimeMs: Date.now() - startTime
    });

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    logger.error('Admin Season Complete: Unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 