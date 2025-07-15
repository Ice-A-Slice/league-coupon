import { NextResponse } from 'next/server';
import { calculateStandings, UserStandingEntry } from '@/services/standingsService';
import { cupActivationStatusChecker } from '@/services/cup/cupActivationStatusChecker';
import { getCupStandings, CupStandingsRow } from '@/services/cup/cupScoringService';
import { logger } from '@/utils/logger';

// Ensure the route is treated as dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

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
    standings?: CupStandingsRow[];
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
    let cupStandings: CupStandingsRow[] | undefined;
    if (cupStatus.isActivated) {
      logger.debug(loggerContext, 'Cup is active - fetching cup standings...');
      try {
        cupStandings = await getCupStandings();
        logger.debug(loggerContext, `Retrieved ${cupStandings.length} cup standings entries.`);
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
        ...(cupStandings && { standings: cupStandings })
      },
      metadata: {
        timestamp: new Date().toISOString(),
        has_cup_data: cupStatus.isActivated && cupStandings !== undefined,
        total_league_participants: leagueStandings.length,
        ...(cupStandings && { total_cup_participants: cupStandings.length })
      }
    };

    const processingTime = Date.now() - startTime;
    logger.info(
      { 
        ...loggerContext, 
        leagueParticipants: leagueStandings.length,
        cupActive: cupStatus.isActivated,
        cupParticipants: cupStandings?.length || 0,
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