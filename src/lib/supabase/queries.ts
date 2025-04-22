import 'server-only';
import { supabaseServerClient } from './server';
import type { Match } from '@/components/BettingCoupon/types'; // Use the existing UI type

/**
 * Fetches fixtures for a specific round from the database.
 * Joins with teams to get names.
 * Orders by kickoff time.
 *
 * @param roundName The name of the round (e.g., "Regular Season - 1").
 * @param seasonYear The year of the season (e.g., 2024).
 * @param leagueApiId The API ID of the league (e.g., 39 for Premier League).
 * @returns A promise resolving to an array of Match objects or null if not found/error.
 */
export async function getFixturesForRound(
  roundName: string,
  seasonYear: number,
  leagueApiId: number
): Promise<Match[] | null> {
  console.log(`Querying Supabase for fixtures: Round "${roundName}", Season ${seasonYear}, League ${leagueApiId}`);

  try {
    // Note: Adjust !inner(...) join syntax if needed based on actual foreign key relationships
    // The select string uses backticks for multi-line template literal
    const { data, error } = await supabaseServerClient
      .from('fixtures')
      .select(`
        id,
        kickoff,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name),
        round:rounds!inner(
          id,
          name,
          season:seasons!inner(
            id,
            api_season_year,
            competition:competitions!inner(
              id,
              api_league_id
            )
          )
        )
      `)
      .eq('round.season.competition.api_league_id', leagueApiId)
      .eq('round.season.api_season_year', seasonYear)
      .eq('round.name', roundName)
      .order('kickoff', { ascending: true });

    if (error) {
      console.error('Error fetching fixtures from Supabase:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No fixtures found in DB for the specified criteria.');
      return [];
    }

    // Transform the data to match the Match[] type expected by the UI
    const matches: Match[] = data.map((fixture) => {
      // Type guards - Adjusting to handle potential array inference
      const homeTeamData = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
      const awayTeamData = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

      if (!homeTeamData || typeof homeTeamData !== 'object' || !homeTeamData.name) {
        console.warn(`Fixture ID ${fixture.id} missing resolved home team data.`);
        return null;
      }
      if (!awayTeamData || typeof awayTeamData !== 'object' || !awayTeamData.name) {
        console.warn(`Fixture ID ${fixture.id} missing resolved away team data.`);
        return null;
      }

      return {
        id: fixture.id,
        homeTeam: homeTeamData.name, // Access name from the resolved object
        awayTeam: awayTeamData.name, // Access name from the resolved object
      };
    }).filter((match): match is Match => match !== null);

    console.log(`Successfully fetched ${matches.length} fixtures from Supabase.`);
    return matches;

  } catch (error) {
    console.error('An error occurred in getFixturesForRound:', error);
    return null;
  }
} 