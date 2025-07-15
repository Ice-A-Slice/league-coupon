import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getCupStandings } from '@/services/cup/cupScoringService';
import { CacheStrategies } from '@/utils/api/cache';
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
 * Retrieves cup standings with user profile data, sorting, and pagination support.
 * 
 * Query Parameters:
 * - season: Season ID to filter standings (optional)
 * - sort: Sort field (total_points, rounds_participated, position, user.full_name)
 * - order: Sort order (asc, desc) - defaults to desc for points, asc for others
 * - page: Page number for pagination (starts at 1)
 * - limit: Items per page (1-100, default 20)
 * 
 * Response:
 * - data: Array of cup standings with user profile information
 * - pagination: Pagination metadata
 * 
 * Caching:
 * - Cache-Control: public, max-age=300, s-maxage=600
 * - ETags for conditional requests
 * 
 * @param request Next.js request object
 * @returns Promise<NextResponse> JSON response with cup standings
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Parse query parameters manually like other routes
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get('season');
    const seasonId = seasonParam ? parseInt(seasonParam, 10) : undefined;
    
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const sort = searchParams.get('sort') || 'total_points';
    const order = searchParams.get('order') || 'desc';

    logger.info({
      seasonId,
      page,
      limit,
      sort,
      order
    }, 'Fetching cup standings with parameters');

    // Get base cup standings data
    const standings = await getCupStandings(seasonId);
    
    if (!standings || standings.length === 0) {
      logger.info({ seasonId }, 'No cup standings found');
      
      // Return empty result with pagination
      const emptyResult = {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
      
      // Apply caching headers
      const response = NextResponse.json(emptyResult, { 
        status: 200,
        headers: {
          'Cache-Control': `public, max-age=${CacheStrategies.LIVE_DATA.maxAge}, stale-while-revalidate=${CacheStrategies.LIVE_DATA.staleWhileRevalidate}`,
        }
      });
      
      return response;
    }

    // Enhance with user profile data
    const enhancedStandings = await enhanceStandingsWithUserProfiles(standings);
    
    // Apply sorting
    const sortedStandings = applySorting(enhancedStandings, sort, order);
    
    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedData = sortedStandings.slice(offset, offset + limit);
    const totalPages = Math.ceil(sortedStandings.length / limit);
    
    const paginatedResult = {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: sortedStandings.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
    
    const duration = performance.now() - startTime;
    logger.info({
      seasonId,
      totalStandings: enhancedStandings.length,
      page,
      limit,
      sort,
      order,
      duration: `${duration.toFixed(2)}ms`
    }, 'Cup standings retrieved successfully');

    // Create response with caching headers
    const response = NextResponse.json(paginatedResult, { 
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${CacheStrategies.LIVE_DATA.maxAge}, stale-while-revalidate=${CacheStrategies.LIVE_DATA.staleWhileRevalidate}`,
      }
    });
    
    return response;

  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration.toFixed(2)}ms`
    }, 'Failed to fetch cup standings');

    return NextResponse.json(
      { 
        error: 'Failed to fetch cup standings',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Enhance cup standings with user profile information
 * @param standings Raw cup standings data
 * @returns Enhanced standings with user profiles
 */
async function enhanceStandingsWithUserProfiles(standings: Awaited<ReturnType<typeof getCupStandings>>): Promise<CupStandingsAPIResult[]> {
  if (!standings || standings.length === 0) {
    return [];
  }

  try {
    // Get all user IDs
    const userIds = standings.map(standing => standing.user_id);

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
        user_id: standing.user_id,
        user: {
          id: standing.user_id,
          full_name: `User ${standing.user_id}`,
          avatar_url: null
        },
        total_points: standing.total_points,
        rounds_participated: standing.rounds_participated,
        position: standing.position,
        last_updated: standing.last_updated
      }));
    }

    // Create profile lookup map
    const profileMap = new Map(profiles?.map(profile => [
      profile.id,
      profile
    ]) || []);

    // Enhance standings with profile data
    return standings.map(standing => {
      const userProfile = profileMap.get(standing.user_id) || {
        id: standing.user_id,
        full_name: `User ${standing.user_id}`,
        avatar_url: null
      };

      return {
        user_id: standing.user_id,
        user: {
          id: userProfile.id,
          full_name: userProfile.full_name || `User ${standing.user_id}`,
          avatar_url: userProfile.avatar_url
        },
        total_points: standing.total_points,
        rounds_participated: standing.rounds_participated,
        position: standing.position,
        last_updated: standing.last_updated
      };
    });

  } catch (error) {
    logger.error('Error enhancing cup standings with user profiles', { error });
    
    // Fall back to basic user info
    return standings.map(standing => ({
      user_id: standing.user_id,
      user: {
        id: standing.user_id,
        full_name: `User ${standing.user_id}`,
        avatar_url: null
      },
      total_points: standing.total_points,
      rounds_participated: standing.rounds_participated,
      position: standing.position,
      last_updated: standing.last_updated
    }));
  }
}

/**
 * Apply sorting to cup standings
 * @param standings Standings data to sort
 * @param sort Sort field
 * @param order Sort order
 * @returns Sorted standings
 */
function applySorting(standings: CupStandingsAPIResult[], sort: string, order: string): CupStandingsAPIResult[] {
  return standings.sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;
    
    switch (sort) {
      case 'total_points':
        aValue = a.total_points;
        bValue = b.total_points;
        break;
      case 'rounds_participated':
        aValue = a.rounds_participated;
        bValue = b.rounds_participated;
        break;
      case 'position':
        aValue = a.position;
        bValue = b.position;
        break;
      case 'user.full_name':
        aValue = a.user.full_name;
        bValue = b.user.full_name;
        break;
      default:
        aValue = a.total_points;
        bValue = b.total_points;
    }
    
    if (aValue < bValue) {
      return order === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
} 