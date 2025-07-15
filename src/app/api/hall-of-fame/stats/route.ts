import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';

/**
 * GET /api/hall-of-fame/stats
 * 
 * Public endpoint to retrieve aggregated Hall of Fame statistics by player for both competitions.
 * Returns user statistics with win counts, points aggregations, and optional season details
 * for both league and cup competitions.
 * 
 * Query Parameters:
 * - limit?: number (default: 50, max: 100) - Number of results per page
 * - sort?: 'wins_desc' | 'wins_asc' | 'points_desc' | 'points_asc' | 'recent' (default: 'wins_desc')
 * - competition_id?: number - Filter by specific competition/league
 * - competition_type?: 'league' | 'last_round_special' | 'all' (default: 'all') - Filter by competition type
 * - include_seasons?: 'true' | 'false' (default: 'false') - Include individual season details
 * 
 * Returns:
 * - 200: Success with aggregated player statistics, pagination, and metadata
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  try {
    logger.info('HallOfFame Stats API: Processing request', {
      requestId,
      timestamp
    });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '50';
    const sort = searchParams.get('sort') || 'wins_desc';
    const competitionId = searchParams.get('competition_id');
    const competitionType = searchParams.get('competition_type') || 'all';
    const includeSeasons = searchParams.get('include_seasons') === 'true';

    // Validate and sanitize parameters
    const limit = Math.min(100, Math.max(1, parseInt(limitParam)));
    
    if (!['wins_desc', 'wins_asc', 'points_desc', 'points_asc', 'recent'].includes(sort)) {
      return NextResponse.json(
        { error: 'Invalid sort parameter' },
        { status: 400 }
      );
    }

    if (!['league', 'last_round_special', 'all'].includes(competitionType)) {
      return NextResponse.json(
        { error: 'Invalid competition_type parameter' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Use manual aggregation for comprehensive statistics
    const { data: rawWinners, error: fallbackError } = await supabase
      .from('season_winners')
      .select(`
        user_id,
        total_points,
        created_at,
        competition_type,
        profiles!inner(
          id,
          full_name,
          avatar_url,
          updated_at
        ),
        seasons!inner(
          id,
          name,
          api_season_year,
          completed_at,
          competitions!inner(
            id,
            name,
            country_name,
            logo_url
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (fallbackError) {
      logger.error('HallOfFame Stats API: Fallback query failed', {
        requestId,
        error: fallbackError.message
      });
      return NextResponse.json(
        { error: 'Database error', details: fallbackError.message },
        { status: 500 }
      );
    }

    // Manual aggregation
    const userStatsMap = new Map();
    
    rawWinners?.forEach(winner => {
      const userId = winner.user_id;
      const competitionType = winner.competition_type || 'league';
      
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          user_id: userId,
          user: winner.profiles,
          total_wins: 0,
          total_points: 0,
          points: [],
          league_wins: 0,
          cup_wins: 0,
          first_win_date: winner.created_at,
          latest_win_date: winner.created_at,
          seasons_won: includeSeasons ? [] : undefined
        });
      }

      const userStats = userStatsMap.get(userId);
      userStats.total_wins++;
      userStats.total_points += winner.total_points || 0;
      userStats.points.push(winner.total_points || 0);
      
      if (competitionType === 'league') {
        userStats.league_wins++;
      } else if (competitionType === 'last_round_special') {
        userStats.cup_wins++;
      }

      if (winner.created_at && (!userStats.first_win_date || new Date(winner.created_at) < new Date(userStats.first_win_date))) {
        userStats.first_win_date = winner.created_at;
      }
      if (winner.created_at && (!userStats.latest_win_date || new Date(winner.created_at) > new Date(userStats.latest_win_date))) {
        userStats.latest_win_date = winner.created_at;
      }

      if (includeSeasons) {
        userStats.seasons_won.push({
          season_id: winner.seasons.id,
          season_name: winner.seasons.name,
          season_year: winner.seasons.api_season_year,
          completed_at: winner.seasons.completed_at,
          points: winner.total_points,
          competition_type: competitionType,
          competition: winner.seasons.competitions
        });
      }
    });

    // Convert to array and calculate averages
    const processedStats = Array.from(userStatsMap.values()).map(stats => ({
      user: stats.user,
      total_wins: stats.total_wins,
      total_points: stats.total_points,
      average_points: stats.points.length > 0 ? Math.round(stats.total_points / stats.points.length) : 0,
      best_points: Math.max(...stats.points, 0),
      worst_points: Math.min(...stats.points, 0),
      first_win_date: stats.first_win_date,
      latest_win_date: stats.latest_win_date,
      league_wins: stats.league_wins,
      cup_wins: stats.cup_wins,
      seasons_won: stats.seasons_won
    }));

    // Apply sorting manually
    switch (sort) {
      case 'wins_asc':
        processedStats.sort((a, b) => a.total_wins - b.total_wins);
        break;
      case 'points_desc':
        processedStats.sort((a, b) => b.total_points - a.total_points);
        break;
      case 'points_asc':
        processedStats.sort((a, b) => a.total_points - b.total_points);
        break;
      case 'recent':
        processedStats.sort((a, b) => new Date(b.latest_win_date).getTime() - new Date(a.latest_win_date).getTime());
        break;
      case 'wins_desc':
      default:
        processedStats.sort((a, b) => b.total_wins - a.total_wins);
        break;
    }

    const limitedStats = processedStats.slice(0, limit);

    // Calculate overall stats
    const overallStats = {
      total_players: limitedStats.length,
      total_seasons_completed: Math.max(...(rawWinners?.map(w => w.seasons.api_season_year) || [0])) - 2018 + 1,
      total_points_awarded: limitedStats.reduce((sum, stat) => sum + stat.total_points, 0),
      average_points_per_season: limitedStats.length > 0 
        ? Math.round(limitedStats.reduce((sum, stat) => sum + stat.average_points, 0) / limitedStats.length)
        : 0,
      total_league_wins: limitedStats.reduce((sum, stat) => sum + stat.league_wins, 0),
      total_cup_wins: limitedStats.reduce((sum, stat) => sum + stat.cup_wins, 0),
      top_player: limitedStats.length > 0 ? {
        user: limitedStats[0].user,
        total_wins: limitedStats[0].total_wins,
        total_points: limitedStats[0].total_points
      } : null
    };

    const processingTime = Date.now() - startTime;

    logger.info('HallOfFame Stats API: Fallback processing completed', {
      requestId,
      resultCount: limitedStats.length,
      processingTime
    });

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: limitedStats,
        overall_stats: overallStats
      },
      query_info: {
        sort,
        competition_id: competitionId ? parseInt(competitionId) : null,
        competition_type: competitionType,
        include_seasons: includeSeasons,
        limit,
        total_records: limitedStats.length,
        request_time_ms: processingTime,
        fallback_used: true
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('HallOfFame Stats API: Unexpected error', {
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