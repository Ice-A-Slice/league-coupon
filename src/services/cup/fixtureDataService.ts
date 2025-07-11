import { createClient } from '@/utils/supabase/client';
import { Tables } from '@/types/supabase';
import { logger } from '@/utils/logger';

// --- Types ---
export type TeamRemainingGames = {
  teamId: number;
  teamName: string;
  remainingGames: number;
};

export type FixtureDataResult = {
  teams: TeamRemainingGames[];
  totalTeams: number;
  teamsWithFiveOrFewerGames: number;
  percentageWithFiveOrFewerGames: number;
};

// --- Utilities ---
const log = (...args: unknown[]) => console.log('[FixtureDataService]', ...args);

const error = (...args: unknown[]) => {
  const serviceContext = { service: 'FixtureDataService' };
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    logger.error({ ...serviceContext, err: args[0] as Record<string, unknown> }, (args[0] as Error)?.message ?? 'Error object logged');
  } else {
    logger.error(serviceContext, args[0] as string, ...args.slice(1));
  }
};

class FixtureDataServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureDataServiceError';
  }
}

// --- Service Definition ---
export const fixtureDataService = {
  /**
   * Queries fixture data to determine how many teams have 5 or fewer games remaining in the current season.
   * 
   * @returns Promise<FixtureDataResult> - Object containing team data and statistics
   * @throws {FixtureDataServiceError} If unable to fetch fixture data or current season
   */
  async getTeamRemainingGames(): Promise<FixtureDataResult> {
    log('Starting to query fixture data for remaining games calculation...');
    const supabase = createClient();

    try {
      // 1. Get the current season
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id, name')
        .eq('is_current', true)
        .single();

      if (seasonError || !currentSeason) {
        error('Failed to fetch current season:', seasonError);
        throw new FixtureDataServiceError('Unable to determine current season');
      }

      log(`Current season found: ${currentSeason.name} (ID: ${currentSeason.id})`);

      // 2. Get all fixtures for the current season (both past and future)
      const { data: allFixtures, error: fixturesError } = await supabase
        .from('fixtures')
        .select(`
          id,
          home_team_id,
          away_team_id,
          kickoff,
          status_short,
          result,
          home_team:teams!fixtures_home_team_id_fkey(id, name),
          away_team:teams!fixtures_away_team_id_fkey(id, name),
          round:rounds!inner(
            id,
            name,
            season_id
          )
        `)
        .eq('round.season_id', currentSeason.id)
        .order('kickoff', { ascending: true });

      if (fixturesError) {
        error('Failed to fetch fixtures:', fixturesError);
        throw new FixtureDataServiceError('Unable to fetch fixtures for current season');
      }

      if (!allFixtures || allFixtures.length === 0) {
        log('No fixtures found for current season');
        return {
          teams: [],
          totalTeams: 0,
          teamsWithFiveOrFewerGames: 0,
          percentageWithFiveOrFewerGames: 0
        };
      }

      log(`Found ${allFixtures.length} total fixtures for current season`);

      // 3. Filter for remaining fixtures (not finished)
      const now = new Date();
      const remainingFixtures = allFixtures.filter(fixture => {
        const fixtureDate = new Date(fixture.kickoff);
        // Consider a fixture as remaining if it's in the future or not finished
        return fixtureDate > now || !fixture.result || fixture.status_short === 'NS' || fixture.status_short === 'TBD';
      });

      log(`Found ${remainingFixtures.length} remaining fixtures`);

      // 4. Group fixtures by team and count remaining games
      const teamGameCounts = new Map<number, { name: string; remainingGames: number }>();

      // Initialize all teams with 0 remaining games
      allFixtures.forEach(fixture => {
        const homeTeamData = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
        const awayTeamData = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

        if (homeTeamData && typeof homeTeamData === 'object' && homeTeamData.id) {
          if (!teamGameCounts.has(homeTeamData.id)) {
            teamGameCounts.set(homeTeamData.id, { name: homeTeamData.name, remainingGames: 0 });
          }
        }

        if (awayTeamData && typeof awayTeamData === 'object' && awayTeamData.id) {
          if (!teamGameCounts.has(awayTeamData.id)) {
            teamGameCounts.set(awayTeamData.id, { name: awayTeamData.name, remainingGames: 0 });
          }
        }
      });

      // Count remaining games for each team
      remainingFixtures.forEach(fixture => {
        const homeTeamData = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
        const awayTeamData = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

        if (homeTeamData && typeof homeTeamData === 'object' && homeTeamData.id) {
          const homeTeamInfo = teamGameCounts.get(homeTeamData.id);
          if (homeTeamInfo) {
            homeTeamInfo.remainingGames++;
          }
        }

        if (awayTeamData && typeof awayTeamData === 'object' && awayTeamData.id) {
          const awayTeamInfo = teamGameCounts.get(awayTeamData.id);
          if (awayTeamInfo) {
            awayTeamInfo.remainingGames++;
          }
        }
      });

      // 5. Convert to result format and calculate statistics
      const teams: TeamRemainingGames[] = Array.from(teamGameCounts.entries()).map(([teamId, info]) => ({
        teamId,
        teamName: info.name,
        remainingGames: info.remainingGames
      }));

      const totalTeams = teams.length;
      const teamsWithFiveOrFewerGames = teams.filter(team => team.remainingGames <= 5).length;
      const percentageWithFiveOrFewerGames = totalTeams > 0 ? (teamsWithFiveOrFewerGames / totalTeams) * 100 : 0;

      log(`Analysis complete: ${totalTeams} teams total, ${teamsWithFiveOrFewerGames} with ≤5 games remaining (${percentageWithFiveOrFewerGames.toFixed(1)}%)`);

      return {
        teams,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames
      };

    } catch (err) {
      if (err instanceof FixtureDataServiceError) throw err;
      error('Unexpected error in getTeamRemainingGames:', err);
      throw new FixtureDataServiceError('Unexpected error while analyzing fixture data');
    }
  },

  /**
   * Gets a summary of teams with their remaining game counts.
   * Helper method for logging and debugging.
   * 
   * @returns Promise<TeamRemainingGames[]> - Array of teams with their remaining game counts
   */
  async getTeamsSummary(): Promise<TeamRemainingGames[]> {
    const result = await this.getTeamRemainingGames();
    return result.teams;
  }
};

// --- Type Exports ---
export type Fixture = Tables<'fixtures'>;
export type Team = Tables<'teams'>;
export type Round = Tables<'rounds'>;
export type Season = Tables<'seasons'>; 