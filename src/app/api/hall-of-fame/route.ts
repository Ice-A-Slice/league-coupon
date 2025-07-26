import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

/**
 * GET /api/hall-of-fame
 * 
 * Public endpoint to retrieve all season winners (Hall of Fame entries) from both competitions.
 * Returns data with pagination and metadata, including both league and cup winners.
 * 
 * Query Parameters:
 * - limit?: number (default: 20, max: 100) - Number of results per page
 * - offset?: number (default: 0) - Number of results to skip
 * - competition_id?: number - Filter by specific competition/league
 * - competition_type?: 'league' | 'last_round_special' | 'all' (default: 'all') - Filter by competition type
 * 
 * Returns:
 * - 200: Success with Hall of Fame data, pagination, and metadata
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    logger.info('HallOfFame API: Processing GET request', {
      requestId,
      method: 'GET',
      timestamp: new Date().toISOString()
    });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const competitionId = searchParams.get('competition_id');
    const competitionType = searchParams.get('competition_type') || 'all';
    const sort = searchParams.get('sort') || 'newest';

    // Create Supabase client
    const supabase = createSupabaseServiceRoleClient();

    // Build the query
    let query = supabase
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
        competition_type,
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
        user:profiles!inner(
          id,
          full_name,
          avatar_url,
          updated_at
        )
      `);

    // Apply competition type filter
    if (competitionType !== 'all') {
      if (competitionType === 'league') {
        // Handle both explicit 'league' and null values for backward compatibility
        query = query.or('competition_type.eq.league,competition_type.is.null');
      } else {
        query = query.eq('competition_type', competitionType);
      }
    }

    // Apply competition ID filter if specified
    if (competitionId) {
      query = query.eq('league_id', parseInt(competitionId));
    }

    // Apply sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'points_desc':
        query = query.order('total_points', { ascending: false });
        break;
      case 'points_asc':
        query = query.order('total_points', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('season_winners')
      .select('*', { count: 'exact', head: true });

    // Apply same filters to count query
    if (competitionType !== 'all') {
      if (competitionType === 'league') {
        countQuery = countQuery.or('competition_type.eq.league,competition_type.is.null');
      } else {
        countQuery = countQuery.eq('competition_type', competitionType);
      }
    }

    if (competitionId) {
      countQuery = countQuery.eq('league_id', parseInt(competitionId));
    }

    // Execute queries
    const [{ data: hallOfFameData, error: dataError }, { count, error: countError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery
    ]);

    if (dataError) {
      logger.error('HallOfFame API: Database error fetching data', {
        requestId,
        error: dataError.message,
        code: dataError.code
      });
      return NextResponse.json(
        { error: 'Database error', details: dataError.message },
        { status: 500 }
      );
    }

    if (countError) {
      logger.error('HallOfFame API: Database error fetching count', {
        requestId,
        error: countError.message,
        code: countError.code
      });
      return NextResponse.json(
        { error: 'Database error', details: countError.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const resultCount = hallOfFameData?.length || 0;
    const processingTime = Date.now() - startTime;

    logger.info('HallOfFame API: Request completed', {
      requestId,
      resultCount,
      totalCount: total,
      competitionType,
      processingTime
    });

    return NextResponse.json({
      success: true,
      data: hallOfFameData || [],
      pagination: {
        total_items: total,
        total_pages: Math.ceil(total / limit),
        current_page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: (offset + limit) < total
      },
      query_info: {
        sort,
        competition_id: competitionId ? parseInt(competitionId) : null,
        competition_type: competitionType,
        request_time_ms: processingTime
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('HallOfFame API: Unexpected error', {
      requestId,
      error: errorMessage,
      processingTime
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 