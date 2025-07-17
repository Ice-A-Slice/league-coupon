import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';
import { revalidatePath } from 'next/cache';

/**
 * Admin endpoint for managing Hall of Fame entries.
 * Supports GET (list all), POST (create), PUT (update), DELETE operations.
 * 
 * Authentication: Requires CRON_SECRET (admin operation)
 */

function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('Admin HallOfFame API: CRON_SECRET not configured');
    return false;
  }

  return (
    (authHeader !== null && authHeader === `Bearer ${expectedSecret}`) ||
    (cronSecret !== null && cronSecret === expectedSecret)
  );
}

/**
 * GET /api/admin/hall-of-fame
 * 
 * Admin endpoint to retrieve all Hall of Fame entries with extended details.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    logger.info('Admin HallOfFame API: Processing GET request', {
      requestId,
      method: 'GET',
      timestamp: new Date().toISOString()
    });

    // Authentication check
    if (!isAuthenticated(request)) {
      logger.warn('Admin HallOfFame API: Unauthorized access attempt', {
        requestId,
        userAgent: request.headers.get('user-agent')
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get URL parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const competitionId = searchParams.get('competition_id');
    const competitionType = searchParams.get('competition_type') || 'all';
    const seasonId = searchParams.get('season_id');
    const userId = searchParams.get('user_id');
    const sort = searchParams.get('sort') || 'newest';

    // Create Supabase client
    const supabase = getSupabaseServiceRoleClient();

    // Build the query with proper joins
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

    // Apply filters
    if (competitionType !== 'all') {
      if (competitionType === 'league') {
        query = query.or('competition_type.eq.league,competition_type.is.null');
      } else {
        query = query.eq('competition_type', competitionType);
      }
    }

    if (competitionId) {
      query = query.eq('league_id', parseInt(competitionId));
    }

    if (seasonId) {
      query = query.eq('season_id', parseInt(seasonId));
    }

    if (userId) {
      query = query.eq('user_id', userId);
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

    if (seasonId) {
      countQuery = countQuery.eq('season_id', parseInt(seasonId));
    }

    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    // Execute queries
    const [{ data: hallOfFameData, error: dataError }, { count, error: countError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery
    ]);

    if (dataError) {
      logger.error('Admin HallOfFame API: Database error fetching data', {
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
      logger.error('Admin HallOfFame API: Database error fetching count', {
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
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasMore = offset + resultCount < total;

    logger.info('Admin HallOfFame API: Successfully retrieved data', {
      requestId,
      resultCount,
      totalCount: total,
      processingTime
    });

    const timestamp = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: hallOfFameData || [],
      pagination: {
        offset,
        limit,
        total,
        count: resultCount
      },
      metadata: {
        timestamp,
        processing_time_ms: processingTime,
        environment: process.env.NODE_ENV || 'development'
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Admin HallOfFame API: Unexpected error', {
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

/**
 * POST /api/admin/hall-of-fame
 * 
 * Admin endpoint to manually create a Hall of Fame entry.
 * 
 * Body Parameters:
 * - season_id: number (required)
 * - user_id: string (required)
 * - total_points: number (required)
 * - game_points?: number (optional)
 * - dynamic_points?: number (optional)
 * - override_existing?: boolean (default: false) - Whether to override existing winner
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    logger.info('Admin HallOfFame API: Processing POST request', {
      requestId,
      method: 'POST',
      timestamp: new Date().toISOString()
    });

    // Authentication check
    if (!isAuthenticated(request)) {
      logger.warn('Admin HallOfFame API: Unauthorized access attempt', {
        requestId,
        userAgent: request.headers.get('user-agent')
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      season_id, 
      user_id, 
      total_points, 
      game_points, 
      dynamic_points, 
      override_existing = false 
    } = body;

    // Validate required fields
    if (!season_id || !user_id || total_points === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: season_id, user_id, total_points' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Check if season exists
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('id, name, competition_id')
      .eq('id', season_id)
      .single();

    if (seasonError || !season) {
      logger.error('Admin HallOfFame API: Season not found', {
        requestId,
        seasonId: season_id,
        error: seasonError?.message
      });
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      logger.error('Admin HallOfFame API: User not found', {
        requestId,
        userId: user_id,
        error: userError?.message
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if winner already exists
    const { data: existingWinner, error: _existingError } = await supabase
      .from('season_winners')
      .select('id')
      .eq('season_id', season_id)
      .single();

    if (existingWinner && !override_existing) {
      logger.warn('Admin HallOfFame API: Winner already exists', {
        requestId,
        seasonId: season_id,
        existingWinnerId: existingWinner.id
      });
      return NextResponse.json(
        { error: 'Winner already exists for this season. Use override_existing=true to replace.' },
        { status: 409 }
      );
    }

    // Create or update winner entry
    const winnerData = {
      season_id,
      user_id,
      league_id: season.competition_id,
      total_points,
      game_points: game_points || 0,
      dynamic_points: dynamic_points || 0,
      created_at: new Date().toISOString()
    };

    let result;
    if (existingWinner && override_existing) {
      // Update existing winner
      const { data, error } = await supabase
        .from('season_winners')
        .update(winnerData)
        .eq('id', existingWinner.id)
        .select()
        .single();

      if (error) {
        logger.error('Admin HallOfFame API: Error updating winner', {
          requestId,
          error: error.message,
          winnerId: existingWinner.id
        });
        return NextResponse.json(
          { error: 'Failed to update winner', details: error.message },
          { status: 500 }
        );
      }

      result = data;
      logger.info('Admin HallOfFame API: Winner updated successfully', {
        requestId,
        winnerId: existingWinner.id,
        seasonId: season_id,
        userId: user_id
      });

    } else {
      // Create new winner
      const { data, error } = await supabase
        .from('season_winners')
        .insert([winnerData])
        .select()
        .single();

      if (error) {
        logger.error('Admin HallOfFame API: Error creating winner', {
          requestId,
          error: error.message,
          seasonId: season_id,
          userId: user_id
        });
        return NextResponse.json(
          { error: 'Failed to create winner', details: error.message },
          { status: 500 }
        );
      }

      result = data;
      logger.info('Admin HallOfFame API: Winner created successfully', {
        requestId,
        winnerId: result.id,
        seasonId: season_id,
        userId: user_id
      });
    }

    // Invalidate cache
    revalidatePath('/api/hall-of-fame');

    const response = {
      data: result,
      season: season,
      user: user,
      operation: existingWinner ? 'updated' : 'created',
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Admin HallOfFame API: Unexpected error in POST', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/hall-of-fame
 * 
 * Admin endpoint to remove a Hall of Fame entry.
 * 
 * Body Parameters:
 * - winner_id?: number - ID of the winner entry to delete
 * - season_id?: number - Delete winner for this season
 * - soft_delete?: boolean (default: false) - Whether to soft delete or hard delete
 */
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    logger.info('Admin HallOfFame API: Processing DELETE request', {
      requestId,
      method: 'DELETE',
      timestamp: new Date().toISOString()
    });

    // Authentication check
    if (!isAuthenticated(request)) {
      logger.warn('Admin HallOfFame API: Unauthorized access attempt', {
        requestId,
        userAgent: request.headers.get('user-agent')
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { winner_id, season_id, soft_delete: _soft_delete = false } = body;

    if (!winner_id && !season_id) {
      return NextResponse.json(
        { error: 'Either winner_id or season_id must be provided' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Find the winner entry
    let query = supabase
      .from('season_winners')
      .select('*');

    if (winner_id) {
      query = query.eq('id', winner_id);
    } else if (season_id) {
      query = query.eq('season_id', season_id);
    }

    const { data: winner, error: findError } = await query.single();

    if (findError || !winner) {
      logger.error('Admin HallOfFame API: Winner not found', {
        requestId,
        winnerId: winner_id,
        seasonId: season_id,
        error: findError?.message
      });
      return NextResponse.json(
        { error: 'Winner not found' },
        { status: 404 }
      );
    }

    // Delete the winner
    const { error: deleteError } = await supabase
      .from('season_winners')
      .delete()
      .eq('id', winner.id);

    if (deleteError) {
      logger.error('Admin HallOfFame API: Error deleting winner', {
        requestId,
        winnerId: winner.id,
        error: deleteError.message
      });
      return NextResponse.json(
        { error: 'Failed to delete winner', details: deleteError.message },
        { status: 500 }
      );
    }

    // Invalidate cache
    revalidatePath('/api/hall-of-fame');

    logger.info('Admin HallOfFame API: Winner deleted successfully', {
      requestId,
      winnerId: winner.id,
      seasonId: winner.season_id,
      userId: winner.user_id
    });

    const response = {
      message: 'Winner deleted successfully',
      deleted_winner: winner,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Admin HallOfFame API: Unexpected error in DELETE', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 