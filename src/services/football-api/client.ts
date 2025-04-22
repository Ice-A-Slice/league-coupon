import {
  ApiFixturesResponse,
  ApiLeaguesResponse,
  ApiCountriesResponse,
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

  console.log(`Fetching from API: ${url.toString()}`); // Optional: for debugging

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: commonHeaders,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as T & { errors?: any[] | Record<string, any> }; // Assume general structure with potential errors field

    // Check for API-level errors in the response body
    if (data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
      console.error('API returned errors:', data.errors);
      // Throw a more specific error or handle appropriately
      throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
    }

    return data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
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