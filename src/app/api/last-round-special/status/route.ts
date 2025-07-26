import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { CacheStrategies } from '@/utils/api/cache';

// Ensure the route is treated as dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

/**
 * Cup status response interface
 */
export interface CupStatusResponse {
  is_active: boolean;
  season_id: number | null;
  season_name: string | null;
  activated_at: string | null;
  activation_date: string | null; // Legacy field for backward compatibility
}

/**
 * GET /api/last-round-special/status
 * 
 * Public endpoint to check if the Last Round Special cup is active for the current season.
 * Returns activation status, season information, and activation timestamp.
 * 
 * Returns:
 * - 200: Success with cup status data
 * - 404: No current season found
 * - 500: Internal server error
 */
export async function GET() {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    logger.info('Cup Status API: Processing request', {
      requestId,
      method: 'GET',
      timestamp
    });

    // Get Supabase client
    const supabase = createSupabaseServiceRoleClient();

    // Query for current season and its cup activation status
    const { data: currentSeason, error } = await supabase
      .from('seasons')
      .select(`
        id,
        name,
        last_round_special_activated,
        last_round_special_activated_at
      `)
      .eq('is_current', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No current season found
        logger.warn('Cup Status API: No current season found', {
          requestId,
          error: error.message
        });

        const response: CupStatusResponse = {
          is_active: false,
          season_id: null,
          season_name: null,
          activated_at: null,
          activation_date: null
        };

        return NextResponse.json({
          success: true,
          data: response,
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            message: 'No current season found',
            processingTime: Date.now() - startTime
          }
        }, { status: 200 });
      }

      // Actual database error
      logger.error('Cup Status API: Database error', {
        requestId,
        error: error.message,
        code: error.code
      });

      return NextResponse.json({
        success: false,
        error: 'Database error',
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }, { status: 500 });
    }

    // Determine activation status
    const isActive = currentSeason.last_round_special_activated === true;
    const activatedAt = currentSeason.last_round_special_activated_at;

    const response: CupStatusResponse = {
      is_active: isActive,
      season_id: currentSeason.id,
      season_name: currentSeason.name,
      activated_at: activatedAt,
      activation_date: activatedAt // Legacy field
    };

    const processingTime = Date.now() - startTime;

    logger.info('Cup Status API: Request completed', {
      requestId,
      seasonId: currentSeason.id,
      isActive,
      processingTime
    });

    return NextResponse.json({
      success: true,
      data: response,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${CacheStrategies.LIVE_DATA.maxAge}, stale-while-revalidate=${CacheStrategies.LIVE_DATA.staleWhileRevalidate}`,
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Cup Status API: Unexpected error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime
      }
    }, { status: 500 });
  }
} 