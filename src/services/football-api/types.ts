// src/services/football-api/types.ts

/**
 * Represents a single country object as returned by the API.
 */
export interface ApiCountry {
  name: string;
  code: string | null; // Assuming code can sometimes be null, adjust if guaranteed
  flag: string | null; // Assuming flag can sometimes be null, adjust if guaranteed
}

/**
 * Represents the overall structure of the /countries API response.
 */
export interface ApiCountriesResponse {
  get: string; // e.g., "countries"
  parameters: Record<string, unknown>; // Changed any to unknown
  errors: unknown[]; // Changed any[] to unknown[]
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiCountry[];
}

// --- PASTE NEW CODE BELOW THIS LINE ---

/**
 * Represents the league details within the /leagues API response.
 */
export interface ApiLeagueInfo {
  id: number;
  name: string;
  type: string; // e.g., "League", "Cup"
  logo: string | null;
}

/**
 * Represents the fixture coverage details within a season's coverage.
 */
export interface ApiSeasonCoverageFixtures {
  events: boolean;
  lineups: boolean;
  statistics_fixtures: boolean;
  statistics_players: boolean;
}

/**
 * Represents the data coverage details for a specific league season.
 */
export interface ApiSeasonCoverage {
  fixtures: ApiSeasonCoverageFixtures;
  standings: boolean;
  players: boolean;
  top_scorers: boolean;
  top_assists: boolean;
  top_cards: boolean;
  injuries: boolean;
  predictions: boolean;
  odds: boolean;
}

/**
 * Represents a specific season details within the /leagues API response.
 */
export interface ApiSeason {
  year: number;
  start: string; // Format "YYYY-MM-DD"
  end: string; // Format "YYYY-MM-DD"
  current: boolean;
  coverage: ApiSeasonCoverage;
}

/**
 * Represents a single item in the main 'response' array of the /leagues API.
 */
export interface ApiLeagueResponseItem {
  league: ApiLeagueInfo;
  country: ApiCountry; // Reusing the existing ApiCountry type
  seasons: ApiSeason[]; // Seasons is always an array
}

/**
 * Represents the overall structure of the /leagues API response.
 */
export interface ApiLeaguesResponse {
  get: string; // e.g., "leagues"
  parameters: Record<string, unknown>; // Changed any to unknown
  errors: unknown[]; // Changed any[] to unknown[]
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiLeagueResponseItem[];
}

// Fixture Types

/**
 * Represents the status object within the fixture details.
 */
export interface ApiFixtureStatus {
  long: string; // e.g., "Match Finished"
  short: string; // e.g., "FT", "NS", "PST"
  elapsed: number | null; // Elapsed time in minutes
  extra?: number | null; // Added for potential future compatibility
}

/**
 * Represents the venue object within the fixture details.
 */
export interface ApiFixtureVenue {
  id: number | null; // Can be null for some fixtures
  name: string | null;
  city: string | null;
}

/**
 * Represents the periods object (kickoff times) within the fixture details.
 */
export interface ApiFixturePeriods {
  first: number | null; // Timestamp or null
  second: number | null; // Timestamp or null
}

/**
 * Represents the core fixture details object.
 */
export interface ApiFixtureDetails {
  id: number;
  referee: string | null;
  timezone: string; // e.g., "UTC"
  date: string; // ISO 8601 format timestamp
  timestamp: number; // Unix timestamp
  periods: ApiFixturePeriods;
  venue: ApiFixtureVenue;
  status: ApiFixtureStatus;
}

/**
 * Represents the league information specific to a fixture response.
 */
export interface ApiFixtureLeagueInfo {
  id: number;
  name: string;
  country: string;
  logo: string | null;
  flag: string | null;
  season: number; // Year
  round: string; // e.g., "Regular Season - 1"
  standings?: boolean | null; // Added based on sample
}

/**
 * Represents the team information (home or away) within a fixture response.
 */
export interface ApiFixtureTeamInfo {
  id: number;
  name: string;
  logo: string | null;
  winner: boolean | null; // Can be null if match not finished/drawn
}

/**
 * Represents the home and away team objects within a fixture response.
 */
export interface ApiFixtureTeams {
  home: ApiFixtureTeamInfo;
  away: ApiFixtureTeamInfo;
}

/**
 * Represents the goals object within a fixture response.
 */
export interface ApiFixtureGoals {
  home: number | null; // Score can be null if not started
  away: number | null;
}

/**
 * Represents the score details for a specific period (halftime, fulltime, etc.).
 */
export interface ApiFixtureScoreDetail {
  home: number | null;
  away: number | null;
}

/**
 * Represents the score object containing details for different periods.
 */
export interface ApiFixtureScore {
  halftime: ApiFixtureScoreDetail;
  fulltime: ApiFixtureScoreDetail;
  extratime: ApiFixtureScoreDetail;
  penalty: ApiFixtureScoreDetail;
}

/**
 * Represents a single fixture item in the main 'response' array of the /fixtures API.
 */
export interface ApiFixtureResponseItem {
  fixture: ApiFixtureDetails;
  league: ApiFixtureLeagueInfo;
  teams: ApiFixtureTeams;
  goals: ApiFixtureGoals;
  score: ApiFixtureScore;
}

/**
 * Represents the overall structure of the /fixtures API response.
 */
export interface ApiFixturesResponse {
  get: string; // e.g., "fixtures"
  parameters: Record<string, unknown>; // Changed any to unknown
  errors: unknown[]; // Changed any[] to unknown[]
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiFixtureResponseItem[];
}