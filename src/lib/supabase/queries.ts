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

// Constants (consider moving to a config file)
const ACTIVE_LEAGUE_API_ID = 39; // Premier League
const ACTIVE_SEASON_YEAR = 2024;
const MAX_TIME_GAP_HOURS = 72; // Max hours between fixtures to be included in the same betting round
const MAX_TIME_GAP_MS = MAX_TIME_GAP_HOURS * 60 * 60 * 1000;

/**
 * Identifies the current betting round by grouping upcoming fixtures chronologically.
 * Fetches 'NS' (Not Started) fixtures for the active league/season, orders them by kickoff,
 * and groups them together as long as the time gap between consecutive fixtures
 * is less than MAX_TIME_GAP_HOURS.
 *
 * @returns {Promise<CurrentRoundFixturesResult>} An object containing the representative round ID/Name 
 *          and the list of matches for the current betting round, or null if no upcoming round is found.
 */
export async function getCurrentBettingRoundFixtures(): Promise<CurrentRoundFixturesResult> {
  console.log(`Query: Identifying current betting round fixtures (League: ${ACTIVE_LEAGUE_API_ID}, Season: ${ACTIVE_SEASON_YEAR})`);

  try {
    // 1. Fetch all upcoming 'NS' fixtures for the active season, ordered by kickoff
    const { data: upcomingFixtures, error: fetchError } = await supabaseServerClient
      .from('fixtures')
      .select(`
        id,
        kickoff,
        status_short,
        round_id, 
        round:rounds!inner(
          name,
          season:seasons!inner(
            api_season_year,
            competition:competitions!inner(
              api_league_id
            )
          )
        ),
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .eq('status_short', 'NS')
      .eq('round.season.competition.api_league_id', ACTIVE_LEAGUE_API_ID)
      .eq('round.season.api_season_year', ACTIVE_SEASON_YEAR)
      .order('kickoff', { ascending: true });

    if (fetchError) {
      console.error('Error fetching upcoming fixtures:', fetchError);
      throw fetchError;
    }

    if (!upcomingFixtures || upcomingFixtures.length === 0) {
      console.log('No upcoming fixtures found for the active season.');
      return null; // No betting round available
    }

    // 2. Group fixtures chronologically
    const currentBettingRoundGroup: typeof upcomingFixtures = [];
    let lastKickoffTimeMs: number | null = null;

    for (const fixture of upcomingFixtures) {
      if (!fixture.kickoff) {
          console.warn(`Fixture ID ${fixture.id} missing kickoff time. Skipping.`);
          continue; // Skip fixtures without a kickoff time
      }
      const currentKickoffTime = new Date(fixture.kickoff);
      const currentKickoffTimeMs = currentKickoffTime.getTime();

      if (currentBettingRoundGroup.length === 0) {
        // Always add the first fixture
        currentBettingRoundGroup.push(fixture);
        lastKickoffTimeMs = currentKickoffTimeMs;
      } else {
        // Check the time gap from the previous fixture in the group
        const timeGapMs = currentKickoffTimeMs - (lastKickoffTimeMs as number); // Non-null assertion OK here

        if (timeGapMs < MAX_TIME_GAP_MS) {
          // Gap is small enough, add to the current group
          currentBettingRoundGroup.push(fixture);
          lastKickoffTimeMs = currentKickoffTimeMs;
        } else {
          // Gap is too large, this fixture belongs to the next round
          break; // Stop grouping
        }
      }
    }

    if (currentBettingRoundGroup.length === 0) {
        console.log('Logical error: No fixtures were added to the betting round group.');
        return null; // Should technically not happen if upcomingFixtures was not empty
    }

    // 3. Determine representative round name and ID (using the first fixture in the group)
    const firstFixtureInGroup = currentBettingRoundGroup[0];
    const representativeRoundId = firstFixtureInGroup.round_id;
    
    // Refined: Safely access nested round name and ensure it's a string
    let representativeRoundName: string;
    if (
        firstFixtureInGroup.round && 
        typeof firstFixtureInGroup.round === 'object' && 
        'name' in firstFixtureInGroup.round &&
        typeof firstFixtureInGroup.round.name === 'string' // Explicitly check if name is a string
    ) {
        representativeRoundName = firstFixtureInGroup.round.name;
    } else {
        representativeRoundName = `Round ID ${representativeRoundId ?? 'Unknown'}`; // Fallback name
    }

    if (!representativeRoundId) {
        console.error("Critical error: First fixture in group is missing round_id", firstFixtureInGroup);
        return null;
    }

    // 4. Transform the grouped data to Match[] format for the UI
    const matches: Match[] = currentBettingRoundGroup.map((fixture) => {
      // Similar transformation logic as in getFixturesForRound
      const homeTeamData = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
      const awayTeamData = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;

      if (!homeTeamData || typeof homeTeamData !== 'object' || !homeTeamData.name || !awayTeamData || typeof awayTeamData !== 'object' || !awayTeamData.name) {
        console.warn(`Fixture ID ${fixture.id} in betting round group missing resolved team data. Excluding.`);
        return null;
      }

      return {
        id: fixture.id,
        homeTeam: homeTeamData.name,
        awayTeam: awayTeamData.name,
        // Add kickoff time if needed by the UI later
        // kickoff: fixture.kickoff 
      };
    }).filter((match): match is Match => match !== null);

    console.log(`Identified current betting round (Rep. Round: ${representativeRoundName}, ID: ${representativeRoundId}) with ${matches.length} fixtures.`);

    return {
      roundId: representativeRoundId,
      roundName: representativeRoundName,
      matches: matches,
    };

  } catch (error) {
    console.error('An error occurred in getCurrentBettingRoundFixtures:', error);
    return null;
  }
} 