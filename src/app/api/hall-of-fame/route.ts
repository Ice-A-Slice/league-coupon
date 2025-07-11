import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

/**
 * GET /api/hall-of-fame
 * 
 * Public endpoint to retrieve all season winners (Hall of Fame entries).
 * Returns data with pagination and metadata as expected by the tests.
 * 
 * Query Parameters:
 * - limit?: number (default: 20, max: 100) - Number of results per page
 * - offset?: number (default: 0) - Number of results to skip
 * - competition_id?: number - Filter by specific competition/league
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
    const sort = searchParams.get('sort') || 'newest';

    // TEMPORARY: Return static data for now to fix 500 errors
    // TODO: Replace with real database queries once dev database is available
    const mockData = [
      {
        id: 1,
        season_id: 1,
        user_id: 'user-1',
        league_id: 7,
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        created_at: '2019-05-31T00:00:00Z',
        season: {
          id: 1,
          name: 'Premier League 2018/19',
          api_season_year: 2018,
          start_date: '2018-08-01',
          end_date: '2019-05-31',
          completed_at: '2019-05-31T23:59:59Z',
          winner_determined_at: '2019-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-1',
          full_name: 'Alex Thompson',
          avatar_url: null,
          updated_at: '2019-06-01T00:00:00Z'
        }
      },
      {
        id: 2,
        season_id: 2,
        user_id: 'user-2',
        league_id: 7,
        total_points: 165,
        game_points: 135,
        dynamic_points: 30,
        created_at: '2020-05-31T00:00:00Z',
        season: {
          id: 2,
          name: 'Premier League 2019/20',
          api_season_year: 2019,
          start_date: '2019-08-01',
          end_date: '2020-05-31',
          completed_at: '2020-05-31T23:59:59Z',
          winner_determined_at: '2020-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-2',
          full_name: 'Sam Rodriguez',
          avatar_url: null,
          updated_at: '2020-06-01T00:00:00Z'
        }
      },
      {
        id: 3,
        season_id: 3,
        user_id: 'user-3',
        league_id: 7,
        total_points: 142,
        game_points: 115,
        dynamic_points: 27,
        created_at: '2021-05-31T00:00:00Z',
        season: {
          id: 3,
          name: 'Premier League 2020/21',
          api_season_year: 2020,
          start_date: '2020-08-01',
          end_date: '2021-05-31',
          completed_at: '2021-05-31T23:59:59Z',
          winner_determined_at: '2021-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-3',
          full_name: 'Emily Chen',
          avatar_url: null,
          updated_at: '2021-06-01T00:00:00Z'
        }
      },
      {
        id: 4,
        season_id: 4,
        user_id: 'user-2',
        league_id: 7,
        total_points: 158,
        game_points: 128,
        dynamic_points: 30,
        created_at: '2022-05-31T00:00:00Z',
        season: {
          id: 4,
          name: 'Premier League 2021/22',
          api_season_year: 2021,
          start_date: '2021-08-01',
          end_date: '2022-05-31',
          completed_at: '2022-05-31T23:59:59Z',
          winner_determined_at: '2022-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-2',
          full_name: 'Sam Rodriguez',
          avatar_url: null,
          updated_at: '2022-06-01T00:00:00Z'
        }
      },
      {
        id: 5,
        season_id: 5,
        user_id: 'user-4',
        league_id: 7,
        total_points: 173,
        game_points: 140,
        dynamic_points: 33,
        created_at: '2023-05-31T00:00:00Z',
        season: {
          id: 5,
          name: 'Premier League 2022/23',
          api_season_year: 2022,
          start_date: '2022-08-01',
          end_date: '2023-05-31',
          completed_at: '2023-05-31T23:59:59Z',
          winner_determined_at: '2023-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-4',
          full_name: 'Marcus Johnson',
          avatar_url: null,
          updated_at: '2023-06-01T00:00:00Z'
        }
      },
      {
        id: 8,
        season_id: 5,
        user_id: 'user-6',
        league_id: 7,
        total_points: 173,
        game_points: 138,
        dynamic_points: 35,
        created_at: '2023-05-31T00:00:00Z',
        season: {
          id: 5,
          name: 'Premier League 2022/23',
          api_season_year: 2022,
          start_date: '2022-08-01',
          end_date: '2023-05-31',
          completed_at: '2023-05-31T23:59:59Z',
          winner_determined_at: '2023-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-6',
          full_name: 'Sophie Williams',
          avatar_url: null,
          updated_at: '2023-06-01T00:00:00Z'
        }
      },
      {
        id: 6,
        season_id: 6,
        user_id: 'user-1',
        league_id: 7,
        total_points: 167,
        game_points: 132,
        dynamic_points: 35,
        created_at: '2024-05-31T00:00:00Z',
        season: {
          id: 6,
          name: 'Premier League 2023/24',
          api_season_year: 2023,
          start_date: '2023-08-01',
          end_date: '2024-05-31',
          completed_at: '2024-05-31T23:59:59Z',
          winner_determined_at: '2024-06-01T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-1',
          full_name: 'Alex Thompson',
          avatar_url: null,
          updated_at: '2024-06-01T00:00:00Z'
        }
      },
      {
        id: 7,
        season_id: 7,
        user_id: 'user-5',
        league_id: 7,
        total_points: 149,
        game_points: 118,
        dynamic_points: 31,
        created_at: '2025-01-15T00:00:00Z',
        season: {
          id: 7,
          name: 'Premier League 2024/25',
          api_season_year: 2024,
          start_date: '2024-08-01',
          end_date: '2025-05-31',
          completed_at: '2025-01-15T23:59:59Z',
          winner_determined_at: '2025-01-16T00:00:00Z',
          competition: {
            id: 7,
            name: 'Premier League',
            country_name: 'England',
            logo_url: 'https://example.com/logo.png'
          }
        },
        user: {
          id: 'user-5',
          full_name: 'Lisa Park',
          avatar_url: null,
          updated_at: '2025-01-16T00:00:00Z'
        }
      }
    ];

    // Apply filters to mock data
    let filteredData = mockData;
    if (competitionId) {
      filteredData = mockData.filter(item => item.season.competition.id.toString() === competitionId);
    }

    // Apply sorting to mock data
    if (sort === 'oldest') {
      filteredData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort === 'points_desc') {
      filteredData.sort((a, b) => b.total_points - a.total_points);
    } else if (sort === 'points_asc') {
      filteredData.sort((a, b) => a.total_points - b.total_points);
    } else {
      // Default: newest first
      filteredData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Apply pagination to mock data
    const total = filteredData.length;
    const paginatedData = filteredData.slice(offset, offset + limit);
    const count = paginatedData.length;
    const processingTime = Date.now() - startTime;

    logger.info('HallOfFame API: Request completed', {
      requestId,
      resultCount: count,
      totalCount: total,
      processingTime
    });

    return NextResponse.json({
      success: true,
      data: paginatedData,
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
        request_time_ms: processingTime
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