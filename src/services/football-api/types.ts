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

// --- Team Types ---

/**
 * Represents the core team details object from the /teams API response.
 */
export interface ApiTeamDetails {
  id: number;
  name: string;
  code: string | null; // e.g., "MUN"
  country: string | null;
  founded: number | null;
  national: boolean | null;
  logo: string | null;
}

/**
 * Represents the venue details object from the /teams API response.
 */
export interface ApiVenueDetails {
  id: number | null;
  name: string | null;
  address: string | null;
  city: string | null;
  capacity: number | null;
  surface: string | null; // e.g., "grass"
  image: string | null;
}

/**
 * Represents a single item in the main 'response' array of the /teams API.
 */
export interface ApiTeamResponseItem {
  team: ApiTeamDetails;
  venue: ApiVenueDetails;
}

/**
 * Represents the overall structure of the /teams API response.
 */
export interface ApiTeamsResponse {
  get: string; // e.g., "teams"
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiTeamResponseItem[];
}

// --- Player Types ---

export interface ApiPlayerBirth {
  date: string | null;
  place: string | null;
  country: string | null;
}

export interface ApiPlayerDetails {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  birth: ApiPlayerBirth | null;
  nationality: string | null;
  height: string | null; // e.g., "178 cm"
  weight: string | null; // e.g., "74 kg"
  injured: boolean | null;
  photo: string | null;
}

export interface ApiPlayerStatsTeam {
  id: number | null;
  name: string | null;
  logo: string | null;
}

export interface ApiPlayerStatsLeague {
  id: number | null;
  name: string | null;
  country: string | null;
  logo: string | null;
  flag: string | null;
  season: number | null;
}

export interface ApiPlayerStatsGames {
  appearences: number | null;
  lineups: number | null;
  minutes: number | null;
  number: number | null;
  position: string | null; // e.g., "Attacker"
  rating: string | null; // Often a string representation
  captain: boolean | null;
}

export interface ApiPlayerStatsSubstitutes {
  in: number | null;
  out: number | null;
  bench: number | null;
}

export interface ApiPlayerStatsShots {
  total: number | null;
  on: number | null;
}

export interface ApiPlayerStatsGoals {
  total: number | null;
  conceded: number | null;
  assists: number | null;
  saves: number | null;
}

export interface ApiPlayerStatsPasses {
  total: number | null;
  key: number | null;
  accuracy: number | null; // Percentage or value?
}

export interface ApiPlayerStatsTackles {
  total: number | null;
  blocks: number | null;
  interceptions: number | null;
}

export interface ApiPlayerStatsDuels {
  total: number | null;
  won: number | null;
}

export interface ApiPlayerStatsDribbles {
  attempts: number | null;
  success: number | null;
  past: number | null;
}

export interface ApiPlayerStatsFouls {
  drawn: number | null;
  committed: number | null;
}

export interface ApiPlayerStatsCards {
  yellow: number | null;
  yellowred: number | null;
  red: number | null;
}

export interface ApiPlayerStatsPenalty {
  won: number | null;
  commited: number | null; // Note: Often spelled 'committed' in code
  scored: number | null;
  missed: number | null;
  saved: number | null;
}

export interface ApiPlayerStats {
  team: ApiPlayerStatsTeam | null;
  league: ApiPlayerStatsLeague | null;
  games: ApiPlayerStatsGames | null;
  substitutes: ApiPlayerStatsSubstitutes | null;
  shots: ApiPlayerStatsShots | null;
  goals: ApiPlayerStatsGoals | null;
  passes: ApiPlayerStatsPasses | null;
  tackles: ApiPlayerStatsTackles | null;
  duels: ApiPlayerStatsDuels | null;
  dribbles: ApiPlayerStatsDribbles | null;
  fouls: ApiPlayerStatsFouls | null;
  cards: ApiPlayerStatsCards | null;
  penalty: ApiPlayerStatsPenalty | null;
}

/**
 * Represents a single item in the main 'response' array of the /players API.
 */
export interface ApiPlayerResponseItem {
  player: ApiPlayerDetails;
  statistics: ApiPlayerStats[]; // Array of stats (e.g., for transfers)
}

/**
 * Represents the overall structure of the /players API response.
 */
export interface ApiPlayersResponse {
  get: string; // e.g., "players"
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiPlayerResponseItem[];
}

// === NEW ENHANCED API TYPES FOR STORY GENERATION ===

/**
 * Represents the time information for a match event
 */
export interface ApiEventTime {
  elapsed: number; // Minutes elapsed
  extra: number | null; // Extra time minutes
}

/**
 * Represents the team information in an event
 */
export interface ApiEventTeam {
  id: number;
  name: string;
  logo: string | null;
}

/**
 * Represents the player information in an event
 */
export interface ApiEventPlayer {
  id: number;
  name: string;
}

/**
 * Represents the assist information in a goal event
 */
export interface ApiEventAssist {
  id: number | null;
  name: string | null;
}

/**
 * Represents a single match event (goal, card, substitution, VAR)
 */
export interface ApiEvent {
  time: ApiEventTime;
  team: ApiEventTeam;
  player: ApiEventPlayer;
  assist: ApiEventAssist | null;
  type: 'Goal' | 'Card' | 'Subst' | 'Var';
  detail: string; // e.g., "Normal Goal", "Yellow Card", "Substitution 1", etc.
  comments: string | null;
}

/**
 * Represents the response structure for /fixtures/events
 */
export interface ApiEventsResponse {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiEvent[];
}

/**
 * Represents a single statistic value for a team
 */
export interface ApiStatistic {
  type: string; // e.g., "Shots on Goal", "Ball Possession", etc.
  value: string | number | null; // Can be percentage, number, or null
}

/**
 * Represents statistics for one team in a fixture
 */
export interface ApiTeamStatistics {
  team: ApiEventTeam;
  statistics: ApiStatistic[];
}

/**
 * Represents the response structure for /fixtures/statistics
 */
export interface ApiStatisticsResponse {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiTeamStatistics[];
}

/**
 * Represents player statistics for a specific match
 */
export interface ApiPlayerMatchStats {
  player: ApiPlayerDetails;
  statistics: Array<{
    games: {
      minutes: number | null;
      number: number | null;
      position: string | null;
      rating: string | null;
      captain: boolean | null;
      substitute: boolean | null;
    };
    offsides: number | null;
    shots: {
      total: number | null;
      on: number | null;
    };
    goals: {
      total: number | null;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: string | null;
    };
    tackles: {
      total: number | null;
      blocks: number | null;
      interceptions: number | null;
    };
    duels: {
      total: number | null;
      won: number | null;
    };
    dribbles: {
      attempts: number | null;
      success: number | null;
      past: number | null;
    };
    fouls: {
      drawn: number | null;
      committed: number | null;
    };
    cards: {
      yellow: number | null;
      red: number | null;
    };
    penalty: {
      won: number | null;
      commited: number | null;
      scored: number | null;
      missed: number | null;
      saved: number | null;
    };
  }>;
}

/**
 * Represents team-specific player statistics for a fixture
 */
export interface ApiTeamPlayerStats {
  team: ApiEventTeam;
  players: ApiPlayerMatchStats[];
}

/**
 * Represents the response structure for /fixtures/players
 */
export interface ApiPlayersStatsResponse {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiTeamPlayerStats[];
}