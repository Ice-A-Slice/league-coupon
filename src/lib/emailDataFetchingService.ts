import { type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { calculateStandings, type UserStandingEntry } from '@/services/standingsService';
import { getAllUsersPerformanceData, type UserPerformanceData } from '@/lib/userDataAggregationService';
import { logger } from '@/utils/logger';
import type { Database } from '@/types/supabase';

// ===== TYPE DEFINITIONS =====

/**
 * Match result data for summary emails
 */
export interface SummaryMatchResult {
  id: number;
  homeTeam: {
    name: string;
    score: number | null;
  };
  awayTeam: {
    name: string;
    score: number | null;
  };
  kickoff: string;
  result: '1' | 'X' | '2' | null; // Final match result
  status: string; // Match status (FT, AET, etc.)
}

/**
 * Round summary data including all matches and metadata
 */
export interface RoundSummaryData {
  roundId: number;
  roundName: string;
  status: 'open' | 'scoring' | 'scored';
  earliestKickoff: string;
  latestKickoff: string;
  matches: SummaryMatchResult[];
  totalMatches: number;
  finishedMatches: number;
  completionPercentage: number;
}

/**
 * User predictions for a specific round
 */
export interface UserRoundPredictions {
  userId: string;
  userName: string | null;
  userEmail: string;
  predictions: Array<{
    matchId: number;
    homeTeam: string;
    awayTeam: string;
    prediction: '1' | 'X' | '2';
    result: '1' | 'X' | '2' | null;
    isCorrect: boolean | null;
    pointsAwarded: number | null;
  }>;
  totalPredictions: number;
  correctPredictions: number;
  pointsEarned: number;
  accuracy: number;
}

/**
 * Complete data package for summary emails
 */
export interface SummaryEmailData {
  round: RoundSummaryData;
  standings: UserStandingEntry[];
  userPerformances: UserPerformanceData[];
  userPredictions: UserRoundPredictions[];
  summary: {
    totalUsers: number;
    averageAccuracy: number;
    highestScore: number;
    topPerformer: string | null;
    biggestMover: {
      name: string | null;
      positionChange: number;
    };
  };
  generatedAt: string;
}

// ===== EMAIL DATA FETCHING SERVICE =====

export class EmailDataFetchingService {
  private client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || getSupabaseServiceRoleClient();
  }

  /**
   * Get complete summary email data for a specific round
   */
  async getSummaryEmailData(roundId?: number): Promise<SummaryEmailData | null> {
    logger.info({ roundId }, 'Fetching summary email data');

    try {
      // 1. Determine target round (specific or latest completed)
      const targetRoundId = roundId || await this.getLatestCompletedRoundId();
      if (!targetRoundId) {
        logger.warn('No completed round found for summary email');
        return null;
      }

      // 2. Fetch round data with match results
      const roundData = await this.getRoundSummaryData(targetRoundId);
      if (!roundData) {
        logger.error({ roundId: targetRoundId }, 'Failed to fetch round summary data');
        return null;
      }

      // 3. Fetch current standings
      const standings = await calculateStandings();
      if (!standings) {
        logger.error('Failed to fetch current standings');
        return null;
      }

      // 4. Fetch user performance data
      const userPerformances = await getAllUsersPerformanceData();

      // 5. Fetch user predictions for the round
      const userPredictions = await this.getUserRoundPredictions(targetRoundId);

      // 6. Generate summary statistics
      const summary = this.generateSummaryStats(userPerformances, userPredictions);

      const emailData: SummaryEmailData = {
        round: roundData,
        standings,
        userPerformances,
        userPredictions,
        summary,
        generatedAt: new Date().toISOString()
      };

      logger.info({ 
        roundId: targetRoundId, 
        userCount: userPerformances.length,
        matchCount: roundData.matches.length 
      }, 'Successfully generated summary email data');

      return emailData;

    } catch (error) {
      logger.error({ roundId, error }, 'Error fetching summary email data');
      return null;
    }
  }

  /**
   * Get latest completed (scored) betting round ID
   */
  private async getLatestCompletedRoundId(): Promise<number | null> {
    try {
      const { data, error } = await this.client
        .from('betting_rounds')
        .select('id')
        .eq('status', 'scored')
        .order('scored_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error({ error }, 'Error fetching latest completed round');
        return null;
      }

      return data?.id || null;

    } catch (error) {
      logger.error({ error }, 'Error in getLatestCompletedRoundId');
      return null;
    }
  }

  /**
   * Get comprehensive round summary including matches and results
   */
  private async getRoundSummaryData(roundId: number): Promise<RoundSummaryData | null> {
    try {
      // 1. Fetch round metadata
      const { data: roundData, error: roundError } = await this.client
        .from('betting_rounds')
        .select('id, name, status, earliest_fixture_kickoff, latest_fixture_kickoff')
        .eq('id', roundId)
        .single();

      if (roundError || !roundData) {
        logger.error({ roundId, error: roundError }, 'Failed to fetch round metadata');
        return null;
      }

      // 2. Fetch fixtures for this round
      const { data: roundFixtures, error: fixtureLinksError } = await this.client
        .from('betting_round_fixtures')
        .select('fixture_id')
        .eq('betting_round_id', roundId);

      if (fixtureLinksError) {
        logger.error({ roundId, error: fixtureLinksError }, 'Failed to fetch round fixtures');
        return null;
      }

      if (!roundFixtures || roundFixtures.length === 0) {
        logger.warn({ roundId }, 'No fixtures found for round');
        return {
          roundId: roundData.id,
          roundName: roundData.name,
          status: roundData.status as 'open' | 'scoring' | 'scored',
          earliestKickoff: roundData.earliest_fixture_kickoff || '',
          latestKickoff: roundData.latest_fixture_kickoff || '',
          matches: [],
          totalMatches: 0,
          finishedMatches: 0,
          completionPercentage: 100
        };
      }

      const fixtureIds = roundFixtures.map(f => f.fixture_id);

      // 3. Fetch fixture details with results
      const { data: fixtures, error: fixturesError } = await this.client
        .from('fixtures')
        .select(`
          id,
          kickoff,
          home_goals,
          away_goals,
          result,
          status_short,
          home_team:teams!fixtures_home_team_id_fkey(name),
          away_team:teams!fixtures_away_team_id_fkey(name)
        `)
        .in('id', fixtureIds)
        .order('kickoff', { ascending: true });

      if (fixturesError || !fixtures) {
        logger.error({ roundId, error: fixturesError }, 'Failed to fetch fixture details');
        return null;
      }

      // 4. Transform fixtures to match results
      const matches: SummaryMatchResult[] = fixtures.map(fixture => {
        const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
        const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

        return {
          id: fixture.id,
          homeTeam: {
            name: homeTeam?.name || 'Unknown Team',
            score: fixture.home_goals
          },
          awayTeam: {
            name: awayTeam?.name || 'Unknown Team', 
            score: fixture.away_goals
          },
          kickoff: fixture.kickoff,
          result: fixture.result as '1' | 'X' | '2' | null,
          status: fixture.status_short
        };
      });

      // 5. Calculate completion stats
      const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
      const finishedMatches = matches.filter(m => finishedStatuses.includes(m.status)).length;
      const completionPercentage = matches.length > 0 ? Math.round((finishedMatches / matches.length) * 100) : 0;

      return {
        roundId: roundData.id,
        roundName: roundData.name,
        status: roundData.status as 'open' | 'scoring' | 'scored',
        earliestKickoff: roundData.earliest_fixture_kickoff || '',
        latestKickoff: roundData.latest_fixture_kickoff || '',
        matches,
        totalMatches: matches.length,
        finishedMatches,
        completionPercentage
      };

    } catch (error) {
      logger.error({ roundId, error }, 'Error in getRoundSummaryData');
      return null;
    }
  }

  /**
   * Get all user predictions for a specific round with results
   */
  private async getUserRoundPredictions(roundId: number): Promise<UserRoundPredictions[]> {
    try {
      // 1. Fetch all user bets for this round with user info
      const { data: userBets, error: betsError } = await this.client
        .from('user_bets')
        .select(`
          user_id,
          fixture_id,
          prediction,
          points_awarded,
          profiles!inner(full_name, email),
          fixtures(
            home_team:teams!fixtures_home_team_id_fkey(name),
            away_team:teams!fixtures_away_team_id_fkey(name),
            result
          )
        `)
        .eq('betting_round_id', roundId);

      if (betsError || !userBets) {
        logger.error({ roundId, error: betsError }, 'Failed to fetch user bets');
        return [];
      }

      // 2. Group bets by user
      const userBetsMap = new Map<string, (typeof userBets)[number][]>();
      userBets.forEach(bet => {
        if (!userBetsMap.has(bet.user_id)) {
          userBetsMap.set(bet.user_id, []);
        }
        userBetsMap.get(bet.user_id)!.push(bet);
      });

      // 3. Transform to UserRoundPredictions format
      const userPredictions: UserRoundPredictions[] = [];

      for (const [userId, bets] of userBetsMap) {
        if (bets.length === 0) continue;

        const userProfile = Array.isArray(bets[0].profiles) ? bets[0].profiles[0] : bets[0].profiles;
        
        const predictions = bets.map(bet => {
          const fixture = Array.isArray(bet.fixtures) ? bet.fixtures[0] : bet.fixtures;
          const homeTeam = Array.isArray(fixture?.home_team) ? fixture.home_team[0] : fixture?.home_team;
          const awayTeam = Array.isArray(fixture?.away_team) ? fixture.away_team[0] : fixture?.away_team;
          
          const result = fixture?.result as '1' | 'X' | '2' | null;
          const isCorrect = result ? bet.prediction === result : null;

          return {
            matchId: bet.fixture_id,
            homeTeam: homeTeam?.name || 'Unknown',
            awayTeam: awayTeam?.name || 'Unknown',
            prediction: bet.prediction,
            result,
            isCorrect,
            pointsAwarded: bet.points_awarded
          };
        });

        const correctPredictions = predictions.filter(p => p.isCorrect === true).length;
        const pointsEarned = predictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);
        const accuracy = predictions.length > 0 ? (correctPredictions / predictions.length) * 100 : 0;

        userPredictions.push({
          userId,
          userName: userProfile?.full_name || null,
          userEmail: userProfile?.email || '',
          predictions,
          totalPredictions: predictions.length,
          correctPredictions,
          pointsEarned,
          accuracy
        });
      }

      logger.info({ roundId, userCount: userPredictions.length }, 'Fetched user round predictions');
      return userPredictions;

    } catch (error) {
      logger.error({ roundId, error }, 'Error fetching user round predictions');
      return [];
    }
  }

  /**
   * Generate summary statistics from user data
   */
  private generateSummaryStats(
    userPerformances: UserPerformanceData[], 
    userPredictions: UserRoundPredictions[]
  ) {
    const totalUsers = userPerformances.length;
    const averageAccuracy = userPredictions.length > 0 
      ? userPredictions.reduce((sum, u) => sum + u.accuracy, 0) / userPredictions.length 
      : 0;
    
    const highestScore = userPerformances.length > 0 
      ? Math.max(...userPerformances.map(u => u.totalPoints))
      : 0;
    
    const topPerformer = userPerformances.find(u => u.currentPosition === 1)?.userName || null;
    
    const biggestMover = userPerformances.reduce((biggest, user) => {
      const absChange = Math.abs(user.positionChange);
      if (absChange > Math.abs(biggest.positionChange)) {
        return { name: user.userName, positionChange: user.positionChange };
      }
      return biggest;
    }, { name: null as string | null, positionChange: 0 });

    return {
      totalUsers,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      highestScore,
      topPerformer,
      biggestMover
    };
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Get summary email data for a specific round (convenience function)
 */
export async function getSummaryEmailData(roundId?: number): Promise<SummaryEmailData | null> {
  const service = new EmailDataFetchingService();
  return service.getSummaryEmailData(roundId);
}

/**
 * Get the latest completed round data for summary emails
 */
export async function getLatestCompletedRoundSummary(): Promise<SummaryEmailData | null> {
  const service = new EmailDataFetchingService();
  return service.getSummaryEmailData(); // No roundId = latest completed
}

/**
 * Check if there are any completed rounds available for summary emails
 */
export async function hasCompletedRoundsForSummary(): Promise<boolean> {
  try {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client
      .from('betting_rounds')
      .select('id')
      .eq('status', 'scored')
      .limit(1);

    return !error && data && data.length > 0;
  } catch (error) {
    logger.error({ error }, 'Error checking for completed rounds');
    return false;
  }
} 