import { NextResponse } from 'next/server';
import { calculateStandings, UserStandingEntry } from '@/services/standingsService';
import { cupActivationStatusChecker } from '@/services/cup/cupActivationStatusChecker';
import { getCupStandings, CupStandingsRow } from '@/services/cup/cupScoringService';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Ensure the route is treated as dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

/**
 * Enhanced cup standings result with user profile information
 */
export interface EnhancedCupStandingsRow {
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
 * Enhanced response interface that includes both league and cup standings
 */
export interface EnhancedStandingsResponse {
  // Legacy league standings (maintained for backward compatibility)
  league_standings: UserStandingEntry[];
  
  // Cup information and standings
  cup: {
    is_active: boolean;
    season_id: number | null;
    season_name: string | null;
    activated_at: string | null;
    standings?: EnhancedCupStandingsRow[];
  };
  
  // Metadata
  metadata: {
    timestamp: string;
    has_cup_data: boolean;
    total_league_participants: number;
    total_cup_participants?: number;
  };
}

/**
 * GET handler for the /api/standings endpoint.
 * 
 * Enhanced to include cup standings when the Last Round Special cup is active.
 * Maintains backward compatibility by always including league_standings.
 * 
 * Response includes:
 * - league_standings: Standard league standings (same as before)
 * - cup: Cup activation status and standings (if active)
 * - metadata: Additional information about the response
 */
export async function GET() {
  const loggerContext = { api: '/api/standings', method: 'GET' };
  const startTime = Date.now();
  logger.info(loggerContext, 'Enhanced standings request received.');

  try {
    // Step 1: Get standard league standings (existing functionality)
    logger.debug(loggerContext, 'Fetching league standings...');
    const leagueStandings = await calculateStandings();

    if (leagueStandings === null) {
      logger.error(loggerContext, 'League standings calculation failed in the service layer.');
      return NextResponse.json(
        { error: 'Failed to calculate league standings.' },
        { status: 500 }
      );
    }

    // Step 2: Check cup activation status
    logger.debug(loggerContext, 'Checking cup activation status...');
    const cupStatus = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();
    
    // Step 3: Get cup standings if cup is active
    let enhancedCupStandings: EnhancedCupStandingsRow[] | undefined;
    if (cupStatus.isActivated) {
      logger.debug(loggerContext, 'Cup is active - fetching cup standings...');
      try {
        const rawCupStandings = await getCupStandings();
        enhancedCupStandings = await enhanceStandingsWithUserProfiles(rawCupStandings);
        logger.debug(loggerContext, `Retrieved ${enhancedCupStandings.length} enhanced cup standings entries.`);
      } catch (cupError) {
        logger.warn(
          { ...loggerContext, error: cupError instanceof Error ? cupError.message : String(cupError) },
          'Failed to fetch cup standings - continuing with league standings only'
        );
        // Continue without cup standings rather than failing the entire request
      }
    }

    // Step 4: Compile enhanced response
    const response: EnhancedStandingsResponse = {
      league_standings: leagueStandings,
      cup: {
        is_active: cupStatus.isActivated,
        season_id: cupStatus.seasonId,
        season_name: cupStatus.seasonName,
        activated_at: cupStatus.activatedAt,
        ...(enhancedCupStandings && { standings: enhancedCupStandings })
      },
      metadata: {
        timestamp: new Date().toISOString(),
        has_cup_data: cupStatus.isActivated && enhancedCupStandings !== undefined,
        total_league_participants: leagueStandings.length,
        ...(enhancedCupStandings && { total_cup_participants: enhancedCupStandings.length })
      }
    };

    const processingTime = Date.now() - startTime;
    logger.info(
      { 
        ...loggerContext, 
        leagueParticipants: leagueStandings.length,
        cupActive: cupStatus.isActivated,
        cupParticipants: enhancedCupStandings?.length || 0,
        processingTime
      },
      'Successfully compiled enhanced standings response.'
    );

    // Add caching headers for performance
    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(
      { 
        ...loggerContext, 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }, 
      'Unexpected error fetching enhanced standings.'
    );
    
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

/**
 * Get user display name from multiple sources
 * @param userId User ID to look up
 * @param supabase Supabase service role client
 * @returns Promise resolving to display name
 */
async function getUserDisplayName(userId: string, supabase: ReturnType<typeof createSupabaseServiceRoleClient>): Promise<string> {
  try {
    // First try profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (profile?.full_name) {
      return profile.full_name;
    }

    // Fallback: try auth.users metadata (for Google OAuth)
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    
    if (authUser?.user?.user_metadata) {
      const metadata = authUser.user.user_metadata;
      // Try different metadata fields that might contain the name
      const name = metadata.full_name || metadata.name || metadata.display_name;
      if (name) return name;
    }

    // Final fallback: use email prefix if available
    if (authUser?.user?.email) {
      const emailPrefix = authUser.user.email.split('@')[0];
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    // Ultimate fallback
    return `User ${userId.slice(-8)}`;

  } catch (error) {
    logger.warn('Error getting user display name', { userId, error });
    return `User ${userId.slice(-8)}`;
  }
}

/**
 * Enhance cup standings with user profile information
 * @param standings Raw cup standings data  
 * @returns Enhanced standings with user profiles
 */
async function enhanceStandingsWithUserProfiles(standings: CupStandingsRow[]): Promise<EnhancedCupStandingsRow[]> {
  if (!standings || standings.length === 0) {
    return [];
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const userIds = standings.map(standing => standing.user_id);

    // Fetch profiles for all users at once
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    // Create profile lookup map
    const profileMap = new Map(profiles?.map(profile => [
      profile.id,
      profile
    ]) || []);

    // Get display names for users missing profiles
    const usersWithoutProfiles = userIds.filter(id => !profileMap.has(id));
    const displayNames = new Map<string, string>();

    for (const userId of usersWithoutProfiles) {
      const displayName = await getUserDisplayName(userId, supabase);
      displayNames.set(userId, displayName);
    }

    // Enhance standings with user info
    return standings.map(standing => {
      const userProfile = profileMap.get(standing.user_id);
      const displayName = userProfile?.full_name || displayNames.get(standing.user_id) || `User ${standing.user_id.slice(-8)}`;

      return {
        user_id: standing.user_id,
        user: {
          id: standing.user_id,
          full_name: displayName,
          avatar_url: userProfile?.avatar_url || null
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
        full_name: `User ${standing.user_id.slice(-8)}`,
        avatar_url: null
      },
      total_points: standing.total_points,
      rounds_participated: standing.rounds_participated,
      position: standing.position,
      last_updated: standing.last_updated
    }));
  }
}