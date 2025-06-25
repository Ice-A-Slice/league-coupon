import {
  ApiFixturesResponse,
  ApiLeaguesResponse,
  ApiTeamsResponse,
  ApiPlayersResponse,
  ApiPlayerResponseItem,
  ApiEventsResponse,
  ApiStatisticsResponse,
  ApiPlayersStatsResponse,
  ApiPlayerMatchStats,
} from './types';

const API_BASE_URL = 'https://v3.football.api-sports.io';

// IMPORTANT: Ensure this environment variable is set in your .env.local file
const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_API_KEY;

// Standard headers required by the API
// TODO: Verify the correct header name for your direct API key (e.g., x-apisports-key)
const commonHeaders = {
  'x-apisports-key': API_KEY || '',
};

/**
 * Fetches data from the football API with common error handling.
 * @param endpoint The API endpoint path (e.g., '/fixtures').
 * @param params Optional URL query parameters.
 * @returns The parsed JSON response.
 * @throws Error if the API key is missing, the fetch fails, or the API returns errors.
 */
async function fetchFromApi<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
  if (!API_KEY) {
    throw new Error('Football API key is missing. Please set NEXT_PUBLIC_FOOTBALL_API_KEY in your environment variables.');
  }

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    url.search = params.toString();
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: commonHeaders,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as T;
  
  return data;
}

/**
 * Fetches all fixtures for a given league and season.
 * @param leagueId The ID of the league.
 * @param season The year of the season (e.g., 2024).
 * @returns A promise resolving to the fixture data.
 */
export async function fetchFixtures(
  leagueId: number,
  season: number
): Promise<ApiFixturesResponse> {
  const params = new URLSearchParams({
    league: leagueId.toString(),
    season: season.toString(),
  });
  return fetchFromApi<ApiFixturesResponse>('/fixtures', params);
}

/**
 * Fetches league and season details for a specific league ID and season year.
 * @param leagueId The ID of the league.
 * @param season The year of the season (e.g., 2024).
 * @returns A promise resolving to the league data.
 */
export async function fetchLeagueByIdAndSeason(
  leagueId: number,
  season: number
): Promise<ApiLeaguesResponse> {
  const params = new URLSearchParams({
    id: leagueId.toString(),
    season: season.toString(),
  });
  return fetchFromApi<ApiLeaguesResponse>('/leagues', params);
}

/**
 * Fetches all teams for a given league and season.
 * @param leagueId The ID of the league.
 * @param season The year of the season (e.g., 2024).
 * @returns A promise resolving to the teams data.
 */
export async function fetchTeamsByLeagueAndSeason(
  leagueId: number,
  season: number
): Promise<ApiTeamsResponse> {
  const params = new URLSearchParams({
    league: leagueId.toString(),
    season: season.toString(),
  });
  return fetchFromApi<ApiTeamsResponse>('/teams', params);
}

/**
 * Fetches ALL players for a given league and season, handling pagination.
 * @param leagueId The ID of the league.
 * @param season The year of the season (e.g., 2024).
 * @returns A promise resolving to an array containing ALL player response items, or null on error.
 */
export async function fetchAllPlayersByLeagueAndSeason(
  leagueId: number,
  season: number
): Promise<ApiPlayerResponseItem[] | null> {
  let allPlayers: ApiPlayerResponseItem[] = [];
  let currentPage = 1;
  let totalPages = 1; // Assume 1 initially
  const MAX_PAGES = 100; // Safety break to prevent infinite loops

  try {
    do {
      const params = new URLSearchParams({
        league: leagueId.toString(),
        season: season.toString(),
        page: currentPage.toString(),
      });

      const apiResponse = await fetchFromApi<ApiPlayersResponse>('/players', params);

      if (!apiResponse || !apiResponse.response) {
        break; 
      }

      allPlayers = allPlayers.concat(apiResponse.response);
      totalPages = apiResponse.paging.total; // Update total pages from the first response

      currentPage++;

    } while (currentPage <= totalPages && currentPage < MAX_PAGES);

    if (currentPage >= MAX_PAGES) {
    }

    return allPlayers;

  } catch (_error) {
    return null; // Indicate an error occurred during the process
  }
}

// TODO: Add functions for fetching leagues, countries, teams, players, standings as needed

// Example for fetching leagues (can be expanded later)
// export async function fetchLeagues(paramsOptions: Record<string, string> = {}):
//   Promise<ApiLeaguesResponse> {
//   const params = new URLSearchParams(paramsOptions);
//   return fetchFromApi<ApiLeaguesResponse>('/leagues', params);
// }

// Example for fetching countries (can be expanded later)
// export async function fetchCountries(): Promise<ApiCountriesResponse> {
//   return fetchFromApi<ApiCountriesResponse>('/countries');
// }

// === ENHANCED API FUNCTIONS FOR STORY GENERATION ===

/**
 * Fetches match events for a specific fixture.
 * @param fixtureId The ID of the fixture.
 * @param teamId Optional: Filter events by team ID.
 * @param playerId Optional: Filter events by player ID.
 * @param eventType Optional: Filter events by type ('Goal', 'Card', 'Subst', 'Var').
 * @returns A promise resolving to the events data.
 */
export async function fetchFixtureEvents(
  fixtureId: number,
  options?: {
    teamId?: number;
    playerId?: number;
    eventType?: 'Goal' | 'Card' | 'Subst' | 'Var';
  }
): Promise<ApiEventsResponse> {
  const params = new URLSearchParams({
    fixture: fixtureId.toString(),
  });

  if (options?.teamId) {
    params.append('team', options.teamId.toString());
  }
  if (options?.playerId) {
    params.append('player', options.playerId.toString());
  }
  if (options?.eventType) {
    params.append('type', options.eventType.toLowerCase());
  }

  return fetchFromApi<ApiEventsResponse>('/fixtures/events', params);
}

/**
 * Fetches match statistics for a specific fixture.
 * @param fixtureId The ID of the fixture.
 * @param teamId Optional: Filter statistics by team ID.
 * @param statisticType Optional: Filter by specific statistic type.
 * @param includeHalftime Optional: Include halftime statistics (available from 2024 season).
 * @returns A promise resolving to the statistics data.
 */
export async function fetchFixtureStatistics(
  fixtureId: number,
  options?: {
    teamId?: number;
    statisticType?: string;
    includeHalftime?: boolean;
  }
): Promise<ApiStatisticsResponse> {
  const params = new URLSearchParams({
    fixture: fixtureId.toString(),
  });

  if (options?.teamId) {
    params.append('team', options.teamId.toString());
  }
  if (options?.statisticType) {
    params.append('type', options.statisticType);
  }
  if (options?.includeHalftime) {
    params.append('half', 'true');
  }

  return fetchFromApi<ApiStatisticsResponse>('/fixtures/statistics', params);
}

/**
 * Fetches player statistics for a specific fixture.
 * @param fixtureId The ID of the fixture.
 * @param teamId Optional: Filter player statistics by team ID.
 * @returns A promise resolving to the player statistics data.
 */
export async function fetchFixturePlayerStats(
  fixtureId: number,
  teamId?: number
): Promise<ApiPlayersStatsResponse> {
  const params = new URLSearchParams({
    fixture: fixtureId.toString(),
  });

  if (teamId) {
    params.append('team', teamId.toString());
  }

  return fetchFromApi<ApiPlayersStatsResponse>('/fixtures/players', params);
}

/**
 * Enhanced function to fetch comprehensive match data including basic fixture info,
 * events, statistics, and player performance for story generation.
 * @param fixtureId The ID of the fixture.
 * @returns A promise resolving to comprehensive match data or null on error.
 */
export async function fetchComprehensiveMatchData(fixtureId: number): Promise<{
  fixture: ApiFixturesResponse;
  events: ApiEventsResponse;
  statistics: ApiStatisticsResponse;
  playerStats: ApiPlayerMatchStats[];
} | null> {
  try {
    const [fixture, events, statistics, playerStats] = await Promise.all([
      fetchFromApi<ApiFixturesResponse>('/fixtures', new URLSearchParams({ id: fixtureId.toString() })),
      fetchFixtureEvents(fixtureId),
      fetchFixtureStatistics(fixtureId),
      fetchFixturePlayerStats(fixtureId),
    ]);

    // Flatten player stats from all teams
    const allPlayerStats = playerStats?.response?.flatMap(teamStats => teamStats.players) ?? [];

    return {
      fixture,
      events,
      statistics,
      playerStats: allPlayerStats,
    };

  } catch (_error) {
    return null;
  }
} 