import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getCupStandings } from '@/services/cup/cupScoringService';
import { parseQueryParams } from '@/utils/api/pagination';
import { CacheStrategies } from '@/utils/api/cache';
import { sortData, paginateData } from '@/utils/api/transforms';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Ensure the route is treated as dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

/**
 * Enhanced cup standings result with user profile information
 */
export interface CupStandingsAPIResult {
  user_id: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  total_points: number;
  rounds_participated: number;
  position: number;
  last_updated: string;
}

/**
 * GET /api/last-round-special/standings
 * 
 * Public endpoint to retrieve the current Last Round Special cup standings.
 * Returns ranked list of users with their cup points, user details, and participation stats.
 * 
 * Query Parameters:
 * - limit?: number (default: 50, max: 100) - Number of results per page
 * - offset?: number (default: 0) - Number of results to skip
 * - page?: number - Page number (alternative to offset)
 * - sort?: 'points_desc' | 'points_asc' | 'position_asc' | 'rounds_desc' | 'recent' (default: 'position_asc')
 * - season_id?: number - Filter by specific season (defaults to current season)
 * 
 * Returns:
 * - 200: Success with cup standings data, pagination, and metadata
 * - 400: Bad request (invalid parameters)
 * - 404: No cup data found for season
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    logger.info('Cup Standings API: Processing request', {
      requestId,
      method: 'GET',
      timestamp
    });

    // Parse and validate query parameters
    const queryParams = parseQueryParams(request, {
      pagination: {
        defaultLimit: 50,
        maxLimit: 100
      },
      sort: {
        defaultSort: 'position_asc',
        validSorts: ['points_desc', 'points_asc', 'position_asc', 'rounds_desc', 'recent']
      },
      filters: ['season_id']
    });

    const { pagination, sort, filters } = queryParams;
    const seasonId = filters.season_id as number | undefined;

    logger.debug('Cup Standings API: Parsed parameters', {
      requestId,
      pagination,
      sort,
      seasonId
    });

    // Get cup standings from the service
    const standings = await getCupStandings(seasonId);

    if (!standings || standings.length === 0) {
      logger.info('Cup Standings API: No standings data found', {
        requestId,
        seasonId
      });

      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total_items: 0,
          total_pages: 0,
          current_page: 1,
          page_size: pagination.limit,
          has_more: false,
          offset: pagination.offset,
          limit: pagination.limit
        },
        query_info: {
          sort,
          season_id: seasonId,
          request_time_ms: Date.now() - startTime
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          message: 'No cup standings data available for the specified season'
        }
      }, { status: 200 });
    }

    // Enhance standings with user profile information
    const enhancedStandings = await enhanceStandingsWithUserProfiles(standings);

    // Apply sorting
    const sortedStandings = applySorting(enhancedStandings, sort || 'position_asc');

    // Apply pagination
    const totalItems = sortedStandings.length;
    const paginatedStandings = paginateData(sortedStandings, pagination.limit, pagination.offset);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pagination.limit);
    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const hasMore = pagination.offset + pagination.limit < totalItems;

    const processingTime = Date.now() - startTime;

    const response = {
      success: true,
      data: paginatedStandings,
      pagination: {
        total_items: totalItems,
        total_pages: totalPages,
        current_page: currentPage,
        page_size: pagination.limit,
        has_more: hasMore,
        offset: pagination.offset,
        limit: pagination.limit
      },
      query_info: {
        sort,
        season_id: seasonId,
        request_time_ms: processingTime
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        participantCount: totalItems,
        processingTime
      }
    };

    logger.info('Cup Standings API: Request completed', {
      requestId,
      resultCount: paginatedStandings.length,
      totalCount: totalItems,
      processingTime
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${CacheStrategies.LIVE_DATA.maxAge}, stale-while-revalidate=${CacheStrategies.LIVE_DATA.staleWhileRevalidate}`,
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Cup Standings API: Unexpected error', {
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

/**
 * Enhance cup standings with user profile information
 */
async function enhanceStandingsWithUserProfiles(standings: Awaited<ReturnType<typeof getCupStandings>>): Promise<CupStandingsAPIResult[]> {
  if (!standings || standings.length === 0) {
    return [];
  }

  try {
    // Get all user IDs
    const userIds = standings.map(standing => standing.userId);

    // Fetch user profiles
    const supabase = getSupabaseServiceRoleClient();
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (error) {
      logger.error('Failed to fetch user profiles for cup standings', { error });
      // Fall back to basic user info without profile data
      return standings.map(standing => ({
        user_id: standing.userId,
        user: {
          id: standing.userId,
          full_name: standing.userName || `User ${standing.userId}`,
          avatar_url: null
        },
        total_points: standing.totalPoints,
        rounds_participated: standing.roundsParticipated,
        position: standing.position,
        last_updated: standing.lastUpdated
      }));
    }

    // Create profile lookup map
    const profileMap = new Map(profiles?.map(profile => [
      profile.id,
      {
        id: profile.id,
        full_name: profile.full_name || `User ${profile.id}`,
        avatar_url: profile.avatar_url
      }
    ]) || []);

    // Enhance standings with profile data
    return standings.map(standing => {
      const userProfile = profileMap.get(standing.userId) || {
        id: standing.userId,
        full_name: standing.userName || `User ${standing.userId}`,
        avatar_url: null
      };

      return {
        user_id: standing.userId,
        user: userProfile,
        total_points: standing.totalPoints,
        rounds_participated: standing.roundsParticipated,
        position: standing.position,
        last_updated: standing.lastUpdated
      };
    });

  } catch (error) {
    logger.error('Error enhancing standings with user profiles', { error });
    
    // Fall back to basic user info
    return standings.map(standing => ({
      user_id: standing.userId,
      user: {
        id: standing.userId,
        full_name: standing.userName || `User ${standing.userId}`,
        avatar_url: null
      },
      total_points: standing.totalPoints,
      rounds_participated: standing.roundsParticipated,
      position: standing.position,
      last_updated: standing.lastUpdated
    }));
  }
}

/**
 * Apply sorting to cup standings
 */
function applySorting(standings: CupStandingsAPIResult[], sort: string): CupStandingsAPIResult[] {
  switch (sort) {
    case 'points_desc':
      return sortData(standings, 'total_points', 'desc');
    case 'points_asc':
      return sortData(standings, 'total_points', 'asc');
    case 'position_asc':
      return sortData(standings, 'position', 'asc');
    case 'rounds_desc':
      return sortData(standings, 'rounds_participated', 'desc');
    case 'recent':
      return sortData(standings, 'last_updated', 'desc');
    default:
      // Default to position ascending (best position first)
      return sortData(standings, 'position', 'asc');
  }
} 