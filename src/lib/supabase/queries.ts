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

/**
 * Fetches teams associated with a specific season from the database.
 *
 * @param seasonId The database ID of the season.
 * @returns A promise resolving to an array of team objects ({ id, name }) or null on error.
 */
export async function getTeamsForSeason(seasonId: number): Promise<{ id: number; name: string; }[] | null> {
  console.log(`Query: Fetching teams for season ID ${seasonId}`);

  try {
    // We need to join fixtures to link teams to a season indirectly
    // Select distinct teams linked to fixtures within the target season's rounds
    
    // 1. Get round IDs for the season
    const { data: rounds, error: roundsError } = await supabaseServerClient
      .from('rounds')
      .select('id')
      .eq('season_id', seasonId);

    if (roundsError) throw new Error(`Failed to fetch rounds for season ${seasonId}: ${roundsError.message}`);
    if (!rounds || rounds.length === 0) {
      console.log(`Query: No rounds found for season ID ${seasonId}. Returning empty array.`);
      return [];
    }
    const roundIds = rounds.map(r => r.id);

    // 2. Get distinct team IDs from fixtures in those rounds
    const { data: fixtureTeams, error: fixtureTeamsError } = await supabaseServerClient
      .from('fixtures')
      .select('home_team_id, away_team_id')
      .in('round_id', roundIds);

    if (fixtureTeamsError) throw new Error(`Failed to fetch teams from fixtures for season ${seasonId}: ${fixtureTeamsError.message}`);
    
    const teamIds = new Set<number>();
    (fixtureTeams || []).forEach(f => {
      if (f.home_team_id) teamIds.add(f.home_team_id);
      if (f.away_team_id) teamIds.add(f.away_team_id);
    });

    if (teamIds.size === 0) {
        console.log(`Query: No teams found linked to fixtures for season ID ${seasonId}. Returning empty array.`);
        return [];
    }

    // 3. Fetch team details for the unique IDs
    const { data: teams, error: teamsError } = await supabaseServerClient
      .from('teams')
      .select('id, name') // Select only id and name for now
      .in('id', Array.from(teamIds))
      .order('name', { ascending: true });

    if (teamsError) throw new Error(`Failed to fetch team details: ${teamsError.message}`);

    console.log(`Query: Found ${teams?.length ?? 0} teams for season ID ${seasonId}.`);
    return teams || []; // Return the fetched teams or an empty array

  } catch (error: unknown) {
    console.error(`Error in getTeamsForSeason(${seasonId}):`, error instanceof Error ? error.message : error);
    return null; // Indicate an error occurred
  }
}

/**
 * Fetches players associated with a specific season from the database.
 *
 * @param seasonId The database ID of the season.
 * @returns A promise resolving to an array of player objects ({ id, name, photo_url }) or null on error.
 */
export async function getPlayersForSeason(
  seasonId: number
): Promise<{ id: number; name: string | null; photo_url: string | null; }[] | null> {
  console.log(`Query: Fetching players for season ID ${seasonId}`);

  try {
    // Fetch distinct players linked to the season via the player_statistics table
    const { data, error } = await supabaseServerClient
      .from('player_statistics')
      .select(`
        players!inner(
          id,
          name,
          photo_url
        )
      `)
      .eq('season_id', seasonId);

    if (error) {
      throw new Error(`Failed to fetch players for season ${seasonId}: ${error.message}`);
    }

    if (!data) {
      console.log(`Query: No player statistics data found for season ID ${seasonId}.`);
      return [];
    }

    // The result will have duplicates if a player played for multiple teams.
    // We need to deduplicate based on the player's ID.
    const uniquePlayersMap = new Map<number, { id: number; name: string | null; photo_url: string | null; }>();
    
    data.forEach(item => {
      // Type guard for the joined players table data
      const playerData = Array.isArray(item.players) ? item.players[0] : item.players;
      
      if (playerData && typeof playerData === 'object' && playerData.id && !uniquePlayersMap.has(playerData.id)) {
        uniquePlayersMap.set(playerData.id, {
          id: playerData.id,
          name: playerData.name,
          photo_url: playerData.photo_url
        });
      }
    });

    // Convert map values to an array and sort by name
    const uniquePlayersArray = Array.from(uniquePlayersMap.values());
    uniquePlayersArray.sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? 0);

    console.log(`Query: Found ${uniquePlayersArray.length} unique players for season ID ${seasonId}.`);
    return uniquePlayersArray;

  } catch (error: unknown) {
    console.error(`Error in getPlayersForSeason(${seasonId}):`, error instanceof Error ? error.message : error);
    return null; // Indicate an error occurred
  }
} 