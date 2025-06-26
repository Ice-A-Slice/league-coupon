import 'server-only';

import { supabaseServerClient } from '@/lib/supabase/server';
import { getCurrentBettingRoundFixtures, type CurrentRoundFixturesResult } from '@/lib/supabase/queries';
// import { fetchFixtures } from '@/services/football-api/client';
// import { getCurrentSeasonId } from '@/lib/seasons';
import { logger } from '@/utils/logger';
import type { UpcomingFixture, DeadlineInfo } from '@/components/emails/ReminderEmail';

/**
 * Enhanced fixture data for reminder emails with additional metadata
 */
export interface ReminderFixtureData {
  fixtures: UpcomingFixture[];
  deadline: DeadlineInfo;
  keyMatches?: UpcomingFixture[];
  totalFixtures: number;
  hasActiveRound: boolean;
}

/**
 * Service for fetching and processing fixture data specifically for reminder emails.
 * Integrates with our database, API-Football service, and provides deadline calculations.
 */
export class ReminderFixtureService {
  /**
   * Main method to get all fixture data needed for reminder emails
   * 
   * @param roundId - Optional specific round ID. If not provided, uses current active round
   * @param deadlineHours - Hours before fixture deadline to calculate urgency (default: 24)
   * @returns Promise resolving to comprehensive fixture data for reminder emails
   */
  async getReminderFixtureData(
    roundId?: number,
    deadlineHours: number = 24
  ): Promise<ReminderFixtureData> {
    logger.info('ReminderFixtureService: Starting fixture data retrieval', { 
      roundId: roundId || 'current',
      deadlineHours 
    });

    try {
      // Get current betting round if no specific round provided
      const currentRoundData = await this.getCurrentActiveRound(roundId);
      
      if (!currentRoundData) {
        logger.warn('ReminderFixtureService: No active betting round found');
        return this.getEmptyFixtureData(deadlineHours);
      }

      // Fetch detailed fixture information from database
      const detailedFixtures = await this.getDetailedFixtures(currentRoundData.roundId);
      
      // Transform database fixtures to ReminderEmail format
      const upcomingFixtures = await this.transformToUpcomingFixtures(detailedFixtures);
      
      // Calculate deadline information
      const deadline = await this.calculateDeadlineInfo(
        currentRoundData.roundId, 
        currentRoundData.roundName,
        deadlineHours
      );

      // Identify key matches for highlighting
      const keyMatches = this.identifyKeyMatches(upcomingFixtures);

      logger.info('ReminderFixtureService: Successfully retrieved fixture data', {
        totalFixtures: upcomingFixtures.length,
        keyMatches: keyMatches.length,
        isUrgent: deadline.isUrgent,
        roundNumber: deadline.roundNumber
      });

      return {
        fixtures: upcomingFixtures,
        deadline,
        keyMatches,
        totalFixtures: upcomingFixtures.length,
        hasActiveRound: true
      };

    } catch (error) {
      logger.error('ReminderFixtureService: Error retrieving fixture data', {
        error: error instanceof Error ? error.message : String(error),
        roundId,
        deadlineHours
      });

      // Return safe fallback data
      return this.getEmptyFixtureData(deadlineHours);
    }
  }

  /**
   * Get current active betting round data
   */
  private async getCurrentActiveRound(roundId?: number): Promise<CurrentRoundFixturesResult> {
    if (roundId) {
      // Fetch specific round data
      return await this.getSpecificRoundData(roundId);
    }
    
    // Use existing service to get current active round
    return await getCurrentBettingRoundFixtures();
  }

  /**
   * Fetch specific round data by ID
   */
  private async getSpecificRoundData(roundId: number): Promise<CurrentRoundFixturesResult> {
    logger.debug('ReminderFixtureService: Fetching specific round data', { roundId });

    try {
      // Get betting round information
      const { data: roundData, error: roundError } = await supabaseServerClient
        .from('betting_rounds')
        .select('id, name')
        .eq('id', roundId)
        .single();

      if (roundError || !roundData) {
        logger.warn('ReminderFixtureService: Betting round not found', { roundId, error: roundError });
        return null;
      }

      // Get fixture IDs for this round
      const { data: roundFixtures, error: fixturesError } = await supabaseServerClient
        .from('betting_round_fixtures')
        .select('fixture_id')
        .eq('betting_round_id', roundId);

      if (fixturesError || !roundFixtures?.length) {
        logger.warn('ReminderFixtureService: No fixtures found for round', { roundId, error: fixturesError });
        return {
          roundId: roundData.id,
          roundName: roundData.name,
          matches: []
        };
      }

      // Get detailed fixture information
      const { data: fixtureDetails, error: detailsError } = await supabaseServerClient
        .from('fixtures')
        .select(`
          id,
          kickoff,
          home_team:teams!fixtures_home_team_id_fkey(id, name),
          away_team:teams!fixtures_away_team_id_fkey(id, name)
        `)
        .in('id', roundFixtures.map(f => f.fixture_id));

      if (detailsError || !fixtureDetails) {
        logger.error('ReminderFixtureService: Error fetching fixture details', { roundId, error: detailsError });
        return null;
      }

      // Transform to expected format
      const matches = fixtureDetails.map(fixture => {
        const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
        const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

        if (!homeTeam?.name || !awayTeam?.name) {
          return null;
        }

        return {
          id: fixture.id,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name
        };
      }).filter(match => match !== null);

      return {
        roundId: roundData.id,
        roundName: roundData.name,
        matches
      };

    } catch (error) {
      logger.error('ReminderFixtureService: Unexpected error fetching specific round', { roundId, error });
      return null;
    }
  }

  /**
   * Get detailed fixture information with kickoff times and additional metadata
   */
  private async getDetailedFixtures(roundId: number) {
    logger.debug('ReminderFixtureService: Fetching detailed fixtures', { roundId });

    try {
      // Get fixture IDs for this round
      const { data: roundFixtures, error: roundError } = await supabaseServerClient
        .from('betting_round_fixtures')
        .select('fixture_id')
        .eq('betting_round_id', roundId);

      if (roundError || !roundFixtures?.length) {
        logger.warn('ReminderFixtureService: No fixtures found for round', { roundId });
        return [];
      }

      // Get comprehensive fixture details
      const { data: fixtures, error: fixturesError } = await supabaseServerClient
        .from('fixtures')
        .select(`
          id,
          api_fixture_id,
          kickoff,
          venue_name,
          venue_city,
          status_short,
          home_team:teams!fixtures_home_team_id_fkey(id, name, api_team_id),
          away_team:teams!fixtures_away_team_id_fkey(id, name, api_team_id)
        `)
        .in('id', roundFixtures.map(f => f.fixture_id))
        .order('kickoff', { ascending: true });

      if (fixturesError) {
        logger.error('ReminderFixtureService: Error fetching detailed fixtures', { roundId, error: fixturesError });
        throw new Error(`Failed to fetch detailed fixtures: ${fixturesError.message}`);
      }

      return fixtures || [];

    } catch (error) {
      logger.error('ReminderFixtureService: Error in getDetailedFixtures', { roundId, error });
      throw error;
    }
  }

  /**
   * Transform database fixture data to UpcomingFixture format for ReminderEmail
   */
  private async transformToUpcomingFixtures(fixtures: Array<{
    id: number;
    home_team: { name: string } | Array<{ name: string }>;
    away_team: { name: string } | Array<{ name: string }>;
    kickoff: string;
    venue_name?: string;
  }>): Promise<UpcomingFixture[]> {
    if (!fixtures.length) {
      return [];
    }

    logger.debug('ReminderFixtureService: Transforming fixtures to UpcomingFixture format', { count: fixtures.length });

    return fixtures.map(fixture => {
      const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
      const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

      if (!homeTeam?.name || !awayTeam?.name) {
        logger.warn('ReminderFixtureService: Fixture missing team data', { fixtureId: fixture.id });
        return null;
      }

      // Calculate importance based on kickoff time and position in round
      // For now, use simple heuristics - could be enhanced with actual team rankings
      const importance = this.calculateFixtureImportance(fixture, fixtures.indexOf(fixture));

      const upcomingFixture: UpcomingFixture = {
        id: fixture.id,
        homeTeam: {
          name: homeTeam.name,
          logo: undefined, // Could be added later from API-Football
          form: undefined  // Could be calculated from recent matches
        },
        awayTeam: {
          name: awayTeam.name,
          logo: undefined, // Could be added later from API-Football
          form: undefined  // Could be calculated from recent matches
        },
        kickoffTime: fixture.kickoff,
        venue: fixture.venue_name || undefined,
        importance
      };

      return upcomingFixture;
    }).filter((fixture): fixture is UpcomingFixture => fixture !== null);
  }

  /**
   * Calculate fixture importance based on various factors
   */
  private calculateFixtureImportance(fixture: { venue_name?: string }, index: number): 'low' | 'medium' | 'high' {
    // Simple heuristic - could be enhanced with:
    // - Team rankings/positions
    // - Historical matchups
    // - Current form
    // - League importance
    
    // For now, use position in round and venue as basic indicators
    const isEarlyFixture = index < 3; // First 3 fixtures often more important
    const hasVenue = !!fixture.venue_name;
    
    if (isEarlyFixture && hasVenue) {
      return 'high';
    } else if (isEarlyFixture || hasVenue) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Calculate deadline information for the betting round
   */
  private async calculateDeadlineInfo(
    roundId: number, 
    roundName: string, 
    deadlineHours: number
  ): Promise<DeadlineInfo> {
    logger.debug('ReminderFixtureService: Calculating deadline info', { roundId, deadlineHours });

    try {
      // Get the earliest fixture kickoff for this round (this is the deadline)
      const { data: roundData, error: roundError } = await supabaseServerClient
        .from('betting_rounds')
        .select('earliest_fixture_kickoff')
        .eq('id', roundId)
        .single();

      if (roundError || !roundData?.earliest_fixture_kickoff) {
        logger.warn('ReminderFixtureService: No deadline found for round', { roundId });
        
        // Fallback: calculate deadline based on current time + deadlineHours
        const fallbackDeadline = new Date();
        fallbackDeadline.setHours(fallbackDeadline.getHours() + deadlineHours);
        
        return this.createDeadlineInfo(roundName, fallbackDeadline.toISOString(), deadlineHours);
      }

      const deadline = roundData.earliest_fixture_kickoff;
      return this.createDeadlineInfo(roundName, deadline, deadlineHours);

    } catch (error) {
      logger.error('ReminderFixtureService: Error calculating deadline', { roundId, error });
      
      // Fallback deadline
      const fallbackDeadline = new Date();
      fallbackDeadline.setHours(fallbackDeadline.getHours() + deadlineHours);
      
      return this.createDeadlineInfo(roundName, fallbackDeadline.toISOString(), deadlineHours);
    }
  }

  /**
   * Create DeadlineInfo object from deadline string
   */
  private createDeadlineInfo(roundName: string, deadline: string, _targetHours: number): DeadlineInfo {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const timeUntilDeadline = deadlineDate.getTime() - now.getTime();
    
    // Calculate time remaining
    const hoursRemaining = Math.max(0, Math.floor(timeUntilDeadline / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((timeUntilDeadline % (1000 * 60 * 60)) / (1000 * 60)));
    
    let timeRemaining: string;
    if (hoursRemaining > 48) {
      const daysRemaining = Math.floor(hoursRemaining / 24);
      timeRemaining = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
    } else if (hoursRemaining > 0) {
      timeRemaining = `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
      if (hoursRemaining < 24 && minutesRemaining > 0) {
        timeRemaining += `, ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;
      }
    } else if (minutesRemaining > 0) {
      timeRemaining = `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;
    } else {
      timeRemaining = 'Less than a minute';
    }

    // Extract round number from round name
    const roundNumber = this.extractRoundNumber(roundName);
    
    // Consider urgent if less than 6 hours remaining
    const isUrgent = hoursRemaining < 6;

    return {
      roundNumber,
      deadline,
      timeRemaining,
      isUrgent
    };
  }

  /**
   * Extract round number from round name string
   */
  private extractRoundNumber(roundName: string): number {
    // Try to extract number from various round name formats
    // e.g., "Round 5", "Regular Season - 5", "Matchday 5", etc.
    const matches = roundName.match(/(\d+)/);
    return matches ? parseInt(matches[1], 10) : 1;
  }

  /**
   * Identify key matches for highlighting in the email
   */
  private identifyKeyMatches(fixtures: UpcomingFixture[]): UpcomingFixture[] {
    // Simple logic: take high importance matches and up to 3 fixtures
    const keyMatches = fixtures
      .filter(fixture => fixture.importance === 'high')
      .slice(0, 3);
    
    // If we don't have enough high importance matches, add medium importance ones
    if (keyMatches.length < 3) {
      const mediumMatches = fixtures
        .filter(fixture => fixture.importance === 'medium')
        .slice(0, 3 - keyMatches.length);
      
      keyMatches.push(...mediumMatches);
    }

    // If still not enough, add any remaining fixtures
    if (keyMatches.length < 3) {
      const remainingMatches = fixtures
        .filter(fixture => !keyMatches.includes(fixture))
        .slice(0, 3 - keyMatches.length);
      
      keyMatches.push(...remainingMatches);
    }

    return keyMatches;
  }

  /**
   * Get empty fixture data for fallback scenarios
   */
  private getEmptyFixtureData(deadlineHours: number): ReminderFixtureData {
    const fallbackDeadline = new Date();
    fallbackDeadline.setHours(fallbackDeadline.getHours() + deadlineHours);

    return {
      fixtures: [],
      deadline: {
        roundNumber: 1,
        deadline: fallbackDeadline.toISOString(),
        timeRemaining: `${deadlineHours} hours`,
        isUrgent: deadlineHours < 6
      },
      keyMatches: [],
      totalFixtures: 0,
      hasActiveRound: false
    };
  }
}

// Export singleton instance
export const reminderFixtureService = new ReminderFixtureService(); 