import React from 'react';
import { StandingsPageContent } from '@/components/standings/StandingsPageContent';
import { logger } from '@/utils/logger';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Standings',
  description: 'View current tournament standings and leaderboard'
};

// Define the expected structure for a standing entry, matching UserStandingEntry from backend
interface UserStandingEntry {
  user_id: string;
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
  rank: number;
  username?: string;
}

// Cup standings interface
interface CupStandingEntry {
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

// Cup status interface
interface CupStatus {
  is_active: boolean;
  season_id: number | null;
  season_name: string | null;
  activated_at: string | null;
}

// Enhanced response interface from the /api/standings endpoint
interface EnhancedStandingsResponse {
  league_standings: UserStandingEntry[];
  cup: {
    is_active: boolean;
    season_id: number | null;
    season_name: string | null;
    activated_at: string | null;
    standings?: CupStandingEntry[]; // Cup standings if available
  };
  metadata: {
    timestamp: string;
    has_cup_data: boolean;
    total_league_participants: number;
    total_cup_participants?: number;
  };
}

async function getEnhancedStandingsData(): Promise<{
  leagueStandings: UserStandingEntry[] | null;
  cupStandings: CupStandingEntry[] | null;
  cupStatus: CupStatus | null;
}> {
  const loggerContext = { page: '/standings', function: 'getEnhancedStandingsData' };
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${appUrl}/api/standings`, {
      cache: 'no-store', // Ensure fresh data for standings
    });

    if (!response.ok) {
      logger.error(
        { ...loggerContext, status: response.status, statusText: response.statusText },
        `Enhanced standings API request failed with status ${response.status}`
      );
      return { leagueStandings: null, cupStandings: null, cupStatus: null };
    }

    const result: EnhancedStandingsResponse = await response.json();
    
    // Extract league standings
    const leagueStandings = result.league_standings || [];
    
    // Extract cup status
    const cupStatus: CupStatus = {
      is_active: result.cup.is_active,
      season_id: result.cup.season_id,
      season_name: result.cup.season_name,
      activated_at: result.cup.activated_at
    };
    
    // Extract cup standings if available
    const cupStandings = result.cup.standings || null;
    
    logger.info(
      { 
        ...loggerContext, 
        leagueCount: leagueStandings.length,
        cupActive: cupStatus.is_active,
        cupCount: cupStandings?.length || 0
      }, 
      'Successfully fetched enhanced standings data.'
    );
    
    return { leagueStandings, cupStandings, cupStatus };
  } catch (error) {
    logger.error(
      { ...loggerContext, error: error instanceof Error ? error.message : String(error) },
      'Failed to fetch enhanced standings data'
    );
    return { leagueStandings: null, cupStandings: null, cupStatus: null };
  }
}

export default async function StandingsPage() {
  // Fetch all data in a single call
  const { leagueStandings, cupStandings, cupStatus } = await getEnhancedStandingsData();

  // Pass all data to the client component for rendering
  return (
    <StandingsPageContent 
      leagueStandings={leagueStandings}
      cupStandings={cupStandings}
      cupStatus={cupStatus}
    />
  );
}

// Optional: Revalidate data periodically or on demand if standings change frequently
// export const revalidate = 60; // Revalidate every 60 seconds 
// export const revalidate = 60; // Revalidate every 60 seconds 