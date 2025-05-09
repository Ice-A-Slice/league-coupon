import { supabaseServerClient } from './server';
import type { Match } from '@/components/BettingCoupon/types'; // Use the existing UI type
import type { Database } from '@/types/supabase'; // Ensure this import is present
import { SupabaseClient } from '@supabase/supabase-js'; // Ensure SupabaseClient is imported

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
): Promise<{ id: number; name: string; }[] | null> {
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
    const teamIds = new Set<number>();
    data.forEach(item => {
      // Type guard for the joined players table data
      const playerData = Array.isArray(item.players) ? item.players[0] : item.players;
      
      if (playerData && typeof playerData === 'object' && playerData.id) {
        teamIds.add(playerData.id);
      }
    });

    if (teamIds.size === 0) {
        console.log(`Query: No teams found linked to fixtures for season ID ${seasonId}. Returning empty array.`);
        return [];
    }

    // Fetch player details, ensuring name is not null
    const { data: teams, error: teamsError } = await supabaseServerClient
      .from('players')
      .select('id, name') // Select only id and name
      .not('name', 'is', null) // Ensure name is not null
      .in('id', Array.from(teamIds))
      .order('name', { ascending: true });

    if (teamsError) throw new Error(`Failed to fetch team details: ${teamsError.message}`);

    // The type now matches { id: number; name: string } implicitly due to the .not() filter
    const uniquePlayersArray = teams || []; // Use directly as it should be unique players now

    console.log(`Query: Found ${uniquePlayersArray.length} unique players for season ID ${seasonId}.`);
    return uniquePlayersArray; // Type matches now

  } catch (error: unknown) {
    console.error(`Error in getPlayersForSeason(${seasonId}):`, error instanceof Error ? error.message : error);
    return null; // Indicate an error occurred
  }
}

/**
 * Type definition for the return value of getCurrentBettingRoundFixtures.
 */
export type CurrentRoundFixturesResult = {
  roundId: number; // Representative round ID (from the first fixture in the group)
  roundName: string; // Representative round name (from the first fixture in the group)
  matches: Match[]; // The grouped fixtures for the current betting round
} | null;

/**
 * Identifies the current betting round by querying the `betting_rounds` table
 * for the round explicitly marked as 'open'. Then fetches the associated fixtures.
 *
 * @returns {Promise<CurrentRoundFixturesResult>} An object containing the round ID, name,
 *          and the list of matches for the current betting round, or null if no 'open' round exists.
 */
export async function getCurrentBettingRoundFixtures(): Promise<CurrentRoundFixturesResult> {
  console.log(`Query: Identifying current open betting round`);

  try {
    // 1. Find the single 'open' betting round
    const { data: openRoundData, error: openRoundError } = await supabaseServerClient
      .from('betting_rounds')
      .select('id, name') // Select id and name
      .eq('status', 'open')
      .limit(1) // Ensure only one open round is expected/fetched
      .single(); // Use .single() to expect zero or one row

    if (openRoundError) {
      // If error is 'PGRST116', it means no rows found, which is expected if no round is open
      if (openRoundError.code === 'PGRST116') {
        console.log('Query: No betting round currently open.');
        return null;
      }
      // Otherwise, it's an unexpected error
      console.error('Error fetching open betting round:', openRoundError);
      throw openRoundError;
    }

    if (!openRoundData) {
      // Should be caught by .single() error PGRST116, but double-check
      console.log('Query: No betting round currently open (checked data).');
      return null;
    }

    const openRoundId = openRoundData.id;
    const openRoundName = openRoundData.name; // Get the name from the betting_rounds table

    console.log(`Query: Found open betting round ID: ${openRoundId}, Name: "${openRoundName}"`);

    // 2. Get fixture IDs associated with this open round
    const { data: roundFixturesData, error: roundFixturesError } = await supabaseServerClient
      .from('betting_round_fixtures')
      .select('fixture_id')
      .eq('betting_round_id', openRoundId);

    if (roundFixturesError) {
      console.error(`Error fetching fixtures for betting round ${openRoundId}:`, roundFixturesError);
      throw roundFixturesError;
    }

    if (!roundFixturesData || roundFixturesData.length === 0) {
      console.warn(`Query: Open betting round ${openRoundId} has no associated fixtures.`); 
      return {
        roundId: openRoundId,
        roundName: openRoundName,
        matches: [],
      };
    }

    // 3. Fetch fixture details for the identified fixtures
    const { data: fixtureDetails, error: fixtureDetailsError } = await supabaseServerClient
      .from('fixtures')
      .select(`
        id,
        kickoff,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .in('id', roundFixturesData.map(f => f.fixture_id));

    if (fixtureDetailsError) {
      console.error(`Error fetching fixture details for betting round ${openRoundId}:`, fixtureDetailsError);
      throw fixtureDetailsError;
    }

    if (!fixtureDetails || fixtureDetails.length === 0) {
      console.warn(`Query: No fixture details found for betting round ${openRoundId}. Returning null.`);
      return null; // Indicate an error occurred
    }

    // Transform the data to match the Match[] type expected by the UI
    const matches: Match[] = fixtureDetails.map((fixture) => {
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
    return {
      roundId: openRoundId,
      roundName: openRoundName,
      matches: matches,
    };

  } catch (error) {
    console.error('An error occurred in getCurrentBettingRoundFixtures:', error);
    return null; // Ensure return here too
  }
}

/**
 * Type alias for the row structure of user_season_answers, based on supabase.ts.
 * This makes the return type of getUserSeasonPredictions clearer.
 */
export type UserSeasonAnswerRow = Database['public']['Tables']['user_season_answers']['Row'];

/**
 * Fetches a user's season-long questionnaire answers for a specific season.
 *
 * @param userId The ID of the user.
 * @param seasonId The ID of the season.
 * @returns A promise resolving to an array of user_season_answers rows or null on error.
 */
export async function getUserSeasonPredictions(
  userId: string,
  seasonId: number
): Promise<UserSeasonAnswerRow[] | null> {
  console.log(`Query: Fetching season predictions for user ID ${userId}, season ID ${seasonId}`);

  try {
    const { data, error } = await supabaseServerClient
      .from('user_season_answers')
      .select('id, user_id, season_id, question_type, answered_team_id, answered_player_id, created_at, updated_at')
      .eq('user_id', userId)
      .eq('season_id', seasonId);

    if (error) {
      console.error(`Error fetching season predictions for user ${userId}, season ${seasonId}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`Query: No season predictions found for user ID ${userId}, season ID ${seasonId}.`);
      return []; // Return empty array if no answers found
    }

    console.log(`Query: Successfully fetched ${data.length} season predictions for user ID ${userId}, season ID ${seasonId}.`);
    return data;

  } catch (error) {
    console.error(`An error occurred in getUserSeasonPredictions for user ${userId}, season ${seasonId}:`, error);
    return null; // Indicate an error occurred
  }
}

/**
 * Fetches user season answers for a specific season from the database.
 *
 * @param seasonId The database ID of the season.
 * @param client A Supabase client instance to use for the query.
 * @returns A promise resolving to an array of user_season_answers rows or null on error.
 */
export async function getUserSeasonAnswers(
  seasonId: number,
  client: SupabaseClient<Database>
): Promise<UserSeasonAnswerRow[] | null> {
  console.log(`Query: Fetching user season answers for season ID ${seasonId}`);

  try {
    // Fetch user season answers based on the season ID using the provided client
    const { data, error } = await client
      .from('user_season_answers')
      .select('*') // Select all columns, as UserSeasonAnswerRow implies
      .eq('season_id', seasonId);

    if (error) {
      // Consider re-throwing or logging more specifically before re-throwing
      console.error(`Error fetching user season answers for season ${seasonId}:`, error.message);
      throw error; // Re-throw to be caught by the caller if needed, or return null directly
    }

    // If data is explicitly null or undefined (less likely if error is null, Supabase usually returns empty array)
    if (data == null) { 
      console.log(`Query: No user season answers found for season ID ${seasonId} (data was null/undefined).`);
      return []; // Return empty array consistent with finding no data
    }
    
    // data is guaranteed to be an array here if error is null, even if empty.
    console.log(`Query: Found ${data.length} user season answers for season ID ${seasonId}.`);
    return data; // Return the data (which might be an empty array)

  } catch (error: unknown) {
    console.error(`An error occurred in getUserSeasonAnswers(${seasonId}):`, error instanceof Error ? error.message : String(error));
    return null; // Indicate an error occurred, consistent with other query functions
  }
}