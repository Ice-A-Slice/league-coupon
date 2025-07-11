import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

/**
 * GET /api/hall-of-fame/stats
 * 
 * Public endpoint to retrieve aggregated Hall of Fame statistics by player.
 * Returns user statistics with win counts, points aggregations, and optional season details.
 * 
 * Query Parameters:
 * - limit?: number (default: 50, max: 100) - Number of results per page
 * - sort?: 'wins_desc' | 'wins_asc' | 'points_desc' | 'points_asc' | 'recent' (default: 'wins_desc')
 * - competition_id?: number - Filter by specific competition/league
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
      method: 'GET',
      timestamp
    });

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || '50');
    limit = Math.max(1, Math.min(limit, 100)); // Enforce limits: min 1, max 100
    
    const sort = searchParams.get('sort') || 'wins_desc';
    const competitionId = searchParams.get('competition_id');
    const includeSeasons = searchParams.get('include_seasons') === 'true';

    // TEMPORARY: Return static mock stats data for now
    // TODO: Replace with real database aggregation once dev database is available
    const mockStatsData = [
      {
        user_id: 'user-1',
        user: {
          id: 'user-1',
          full_name: 'Alex Thompson',
          avatar_url: null,
          updated_at: '2024-06-01T00:00:00Z'
        },
        win_count: 2,
        total_points: 317, // 150 + 167
        avg_points: 158.5,
        max_points: 167,
        min_points: 150,
        first_win_date: '2019-05-31T00:00:00Z',
        last_win_date: '2024-05-31T00:00:00Z',
        seasons: [
          {
            season_id: 1,
            season_name: 'Premier League 2018/19',
            season_year: 2018,
            completed_at: '2019-05-31T23:59:59Z',
            points: 150,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          },
          {
            season_id: 6,
            season_name: 'Premier League 2023/24',
            season_year: 2023,
            completed_at: '2024-05-31T23:59:59Z',
            points: 167,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      },
      {
        user_id: 'user-2', 
        user: {
          id: 'user-2',
          full_name: 'Sam Rodriguez',
          avatar_url: null,
          updated_at: '2022-06-01T00:00:00Z'
        },
        win_count: 2,
        total_points: 323, // 165 + 158
        avg_points: 161.5,
        max_points: 165,
        min_points: 158,
        first_win_date: '2020-05-31T00:00:00Z',
        last_win_date: '2022-05-31T00:00:00Z',
        seasons: [
          {
            season_id: 2,
            season_name: 'Premier League 2019/20',
            season_year: 2019,
            completed_at: '2020-05-31T23:59:59Z',
            points: 165,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          },
          {
            season_id: 4,
            season_name: 'Premier League 2021/22',
            season_year: 2021,
            completed_at: '2022-05-31T23:59:59Z',
            points: 158,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      },
      {
        user_id: 'user-4',
        user: {
          id: 'user-4',
          full_name: 'Marcus Johnson',
          avatar_url: null,
          updated_at: '2023-06-01T00:00:00Z'
        },
        win_count: 1,
        total_points: 173,
        avg_points: 173,
        max_points: 173,
        min_points: 173,
        first_win_date: '2023-05-31T00:00:00Z',
        last_win_date: '2023-05-31T00:00:00Z',
        seasons: [
          {
            season_id: 5,
            season_name: 'Premier League 2022/23',
            season_year: 2022,
            completed_at: '2023-05-31T23:59:59Z',
            points: 173,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      },
      {
        user_id: 'user-5',
        user: {
          id: 'user-5',
          full_name: 'Lisa Park',
          avatar_url: null,
          updated_at: '2025-01-16T00:00:00Z'
        },
        win_count: 1,
        total_points: 149,
        avg_points: 149,
        max_points: 149,
        min_points: 149,
        first_win_date: '2025-01-15T00:00:00Z',
        last_win_date: '2025-01-15T00:00:00Z',
        seasons: [
          {
            season_id: 7,
            season_name: 'Premier League 2024/25',
            season_year: 2024,
            completed_at: '2025-01-15T23:59:59Z',
            points: 149,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      },
      {
        user_id: 'user-3',
        user: {
          id: 'user-3',
          full_name: 'Emily Chen',
          avatar_url: null,
          updated_at: '2021-06-01T00:00:00Z'
        },
        win_count: 1,
        total_points: 142,
        avg_points: 142,
        max_points: 142,
        min_points: 142,
        first_win_date: '2021-05-31T00:00:00Z',
        last_win_date: '2021-05-31T00:00:00Z',
        seasons: [
          {
            season_id: 3,
            season_name: 'Premier League 2020/21',
            season_year: 2020,
            completed_at: '2021-05-31T23:59:59Z',
            points: 142,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      },
      {
        user_id: 'user-6',
        user: {
          id: 'user-6',
          full_name: 'Sophie Williams',
          avatar_url: null,
          updated_at: '2023-06-01T00:00:00Z'
        },
        win_count: 1,
        total_points: 173,
        avg_points: 173,
        max_points: 173,
        min_points: 173,
        first_win_date: '2023-05-31T00:00:00Z',
        last_win_date: '2023-05-31T00:00:00Z',
        seasons: [
          {
            season_id: 5,
            season_name: 'Premier League 2022/23',
            season_year: 2022,
            completed_at: '2023-05-31T23:59:59Z',
            points: 173,
            competition: {
              id: 7,
              name: 'Premier League',
              country_name: 'England',
              logo_url: 'https://example.com/logo.png'
            }
          }
        ]
      }
    ];

    // Apply filtering and sorting to mock data
    const filteredData = mockStatsData;
    
    // Filter by competition if specified (for mock data, just keep all)
    // In a real implementation, this would filter based on the competition
    
    // Apply sorting
    switch (sort) {
      case 'wins_asc':
        filteredData.sort((a, b) => a.win_count - b.win_count);
        break;
      case 'wins_desc':
        filteredData.sort((a, b) => b.win_count - a.win_count);
        break;
      case 'points_desc':
        filteredData.sort((a, b) => b.total_points - a.total_points);
        break;
      case 'points_asc':
        filteredData.sort((a, b) => a.total_points - b.total_points);
        break;
      case 'recent':
        filteredData.sort((a, b) => new Date(b.last_win_date).getTime() - new Date(a.last_win_date).getTime());
        break;
      default:
        filteredData.sort((a, b) => b.win_count - a.win_count);
        break;
    }

    // Apply limit
    const statsData = filteredData.slice(0, limit);
    
    const count = statsData.length;
    const processingTime = Date.now() - startTime;

    // Build response according to StatsResponse interface
    const response = {
      success: true,
      data: {
        leaderboard: statsData.map(stat => ({
          user: stat.user,
          total_wins: stat.win_count,
          total_points: stat.total_points,
          average_points: stat.avg_points,
          best_points: stat.max_points,
          worst_points: stat.min_points,
          first_win_date: stat.first_win_date,
          latest_win_date: stat.last_win_date,
          seasons_won: stat.seasons
        })),
        overall_stats: {
          total_players: count,
          total_seasons_completed: 7, // Updated to match our mock data (2018/19 to 2024/25)
          total_points_awarded: statsData.reduce((sum, stat) => sum + stat.total_points, 0),
          average_points_per_season: statsData.length > 0 
            ? statsData.reduce((sum, stat) => sum + stat.avg_points, 0) / statsData.length 
            : 0,
          top_player: statsData.length > 0 ? {
            user: statsData[0].user,
            total_wins: statsData[0].win_count,
            total_points: statsData[0].total_points
          } : null
        }
      },
      query_info: {
        sort,
        competition_id: competitionId ? parseInt(competitionId) : null,
        include_seasons: includeSeasons,
        limit,
        total_records: count,
        request_time_ms: processingTime
      }
    };

    logger.info('HallOfFame Stats API: Request completed', {
      requestId,
      resultCount: count,
      processingTime
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
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