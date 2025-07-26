import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

/**
 * GET /api/hall-of-fame/season/[id]
 * 
 * Public endpoint to retrieve the winner of a specific season.
 * Returns detailed information about the season winner including user profile,
 * season details, and competition information.
 * 
 * Path Parameters:
 * - id: number - Season ID (must be positive integer)
 * 
 * Returns:
 * - 200: Success with season winner data and metadata
 * - 400: Invalid season ID
 * - 404: Season winner not found
 * - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Await the params since they are now a Promise
  const resolvedParams = await params;
  
  try {
    // Validate season ID - must be a positive integer (no floating points)
    const seasonIdStr = resolvedParams.id;
    const seasonId = parseInt(seasonIdStr);
    
    // Check for floating point numbers or invalid integers
    if (isNaN(seasonId) || seasonId <= 0 || seasonIdStr.includes('.')) {
      logger.error('HallOfFame Season API: Invalid season ID', {
        requestId,
        seasonId: seasonIdStr
      });
      return NextResponse.json(
        { error: 'Invalid season ID' },
        { status: 400 }
      );
    }

    logger.info('HallOfFame Season API: Processing request', {
      requestId,
      method: 'GET',
      timestamp,
      seasonId // Now logging as number
    });

    // Create Supabase client
    const supabase = createSupabaseServiceRoleClient();

    // Query for the season winner with all related data
    const { data: seasonWinner, error } = await supabase
      .from('season_winners')
      .select(`
        id,
        season_id,
        user_id,
        league_id,
        total_points,
        game_points,
        dynamic_points,
        created_at,
        season:seasons!inner(
          id,
          name,
          api_season_year,
          start_date,
          end_date,
          completed_at,
          winner_determined_at,
          competition:competitions!inner(
            id,
            name,
            country_name,
            logo_url
          )
        ),
        profile:profiles!inner(
          id,
          full_name,
          avatar_url,
          updated_at
        )
      `)
      .eq('season_id', seasonId)
      .single();

    if (error) {
      // Check if it's a "not found" error vs actual database error
      if (error.code === 'PGRST116') {
        logger.error('HallOfFame Season API: Season winner not found', {
          requestId,
          seasonId
        });
        return NextResponse.json(
          { error: 'Season winner not found' },
          { status: 404 }
        );
      }

      // Actual database error
      logger.error('HallOfFame Season API: Database error', {
        requestId,
        seasonId,
        error: error.message,
        code: error.code
      });
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;

    const response = {
      data: seasonWinner,
      metadata: {
        requestId,
        timestamp,
        processingTime
      }
    };

    logger.info('HallOfFame Season API: Request completed', {
      requestId,
      seasonId,
      processingTime,
      found: true
    });

    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('HallOfFame Season API: Unexpected error', {
      requestId,
      seasonId: resolvedParams.id,
      error: errorMessage,
      processingTime
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 