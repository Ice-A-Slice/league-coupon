import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

/**
 * Unified season winner response interface
 */
export interface UnifiedSeasonWinner {
  id: number;
  season_id: number;
  user_id: string;
  league_id: number;
  total_points: number;
  game_points: number;
  dynamic_points: number;
  created_at: string | null;
  competition_type: 'league' | 'last_round_special';
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    updated_at: string;
  };
}

export interface CompleteSeasonResponse {
  season_id: number;
  league_winners: UnifiedSeasonWinner[];
  cup_winners: UnifiedSeasonWinner[];
  season: {
    id: number;
    name: string | null;
    api_season_year: number;
    start_date: string | null;
    end_date: string | null;
    completed_at: string | null;
    winner_determined_at: string | null;
    last_round_special_activated: boolean;
    last_round_special_activated_at: string | null;
    competition: {
      id: number;
      name: string | null;
      country_name: string | null;
      logo_url: string | null;
    };
  };
}

/**
 * GET /api/hall-of-fame/season/[id]/complete
 * 
 * Public endpoint to retrieve both league and cup winners for a specific season.
 * Returns detailed information about both competition winners including user profiles,
 * season details, and competition information.
 * 
 * This endpoint supports the UI requirement for displaying both League Winner 
 * and Last Round Winner side-by-side for each season.
 * 
 * Path Parameters:
 * - id: number - Season ID (must be positive integer)
 * 
 * Returns:
 * - 200: Success with complete season data including both winners
 * - 400: Invalid season ID
 * - 404: Season not found
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
      logger.error('HallOfFame Complete Season API: Invalid season ID', {
        requestId,
        seasonId: seasonIdStr
      });
      return NextResponse.json(
        { error: 'Invalid season ID' },
        { status: 400 }
      );
    }

    logger.info('HallOfFame Complete Season API: Processing request', {
      requestId,
      method: 'GET',
      timestamp,
      seasonId
    });

    // Create Supabase client
    const supabase = createSupabaseServiceRoleClient();

    // First, verify the season exists and get its details
    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select(`
        id,
        name,
        api_season_year,
        start_date,
        end_date,
        completed_at,
        winner_determined_at,
        last_round_special_activated,
        last_round_special_activated_at,
        competition:competitions!inner(
          id,
          name,
          country_name,
          logo_url
        )
      `)
      .eq('id', seasonId)
      .single();

    if (seasonError) {
      if (seasonError.code === 'PGRST116') {
        logger.error('HallOfFame Complete Season API: Season not found', {
          requestId,
          seasonId
        });
        return NextResponse.json(
          { error: 'Season not found' },
          { status: 404 }
        );
      }

      logger.error('HallOfFame Complete Season API: Database error fetching season', {
        requestId,
        seasonId,
        error: seasonError.message,
        code: seasonError.code
      });
      return NextResponse.json(
        { error: 'Database error', details: seasonError.message },
        { status: 500 }
      );
    }

    // Query for all winners for this season (both league and cup)
    const { data: allWinners, error: winnersError } = await supabase
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
        profile:profiles!inner(
          id,
          full_name,
          avatar_url,
          updated_at
        )
      `)
      .eq('season_id', seasonId);

    if (winnersError) {
      logger.error('HallOfFame Complete Season API: Database error fetching winners', {
        requestId,
        seasonId,
        error: winnersError.message,
        code: winnersError.code
      });
      return NextResponse.json(
        { error: 'Database error', details: winnersError.message },
        { status: 500 }
      );
    }

    // Separate league and cup winners (support multiple winners)
    const leagueWinners = allWinners?.filter(winner => 
      winner.competition_type === 'league' || !winner.competition_type
    ) || [];
    
    const cupWinners = allWinners?.filter(winner => 
      winner.competition_type === 'last_round_special'
    ) || [];

    const processingTime = Date.now() - startTime;

    const response: CompleteSeasonResponse = {
      season_id: seasonId,
      league_winners: leagueWinners.map(winner => ({
        id: winner.id,
        season_id: winner.season_id,
        user_id: winner.user_id,
        league_id: winner.league_id,
        total_points: winner.total_points,
        game_points: winner.game_points,
        dynamic_points: winner.dynamic_points,
        created_at: winner.created_at,
        competition_type: 'league' as const,
        profile: {
          id: winner.profile.id,
          full_name: winner.profile.full_name,
          avatar_url: winner.profile.avatar_url,
          updated_at: winner.profile.updated_at
        }
      })),
      cup_winners: cupWinners.map(winner => ({
        id: winner.id,
        season_id: winner.season_id,
        user_id: winner.user_id,
        league_id: winner.league_id,
        total_points: winner.total_points,
        game_points: winner.game_points,
        dynamic_points: winner.dynamic_points,
        created_at: winner.created_at,
        competition_type: 'last_round_special' as const,
        profile: {
          id: winner.profile.id,
          full_name: winner.profile.full_name,
          avatar_url: winner.profile.avatar_url,
          updated_at: winner.profile.updated_at
        }
      })),
      season: {
        id: seasonData.id,
        name: seasonData.name,
        api_season_year: seasonData.api_season_year,
        start_date: seasonData.start_date,
        end_date: seasonData.end_date,
        completed_at: seasonData.completed_at,
        winner_determined_at: seasonData.winner_determined_at,
        last_round_special_activated: seasonData.last_round_special_activated || false,
        last_round_special_activated_at: seasonData.last_round_special_activated_at,
        competition: {
          id: seasonData.competition.id,
          name: seasonData.competition.name,
          country_name: seasonData.competition.country_name,
          logo_url: seasonData.competition.logo_url
        }
      }
    };

    const responseWithMetadata = {
      data: response,
      metadata: {
        requestId,
        timestamp,
        processingTime,
        has_league_winners: leagueWinners.length > 0,
        has_cup_winners: cupWinners.length > 0,
        league_winners_count: leagueWinners.length,
        cup_winners_count: cupWinners.length,
        cup_was_activated: seasonData.last_round_special_activated || false
      }
    };

    logger.info('HallOfFame Complete Season API: Request completed', {
      requestId,
      seasonId,
      processingTime,
      leagueWinnersCount: leagueWinners.length,
      cupWinnersCount: cupWinners.length,
      cupActivated: seasonData.last_round_special_activated || false
    });

    return NextResponse.json(responseWithMetadata, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('HallOfFame Complete Season API: Unexpected error', {
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