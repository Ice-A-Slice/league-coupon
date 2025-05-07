// src/lib/leagueDataService.ts

// --- API Response Structures (Helper Interfaces based on typical API patterns) ---
// These are intermediate types to help parse the actual API response.

// --- HELPER INTERFACES FOR /standings ENDPOINT ---

export interface APIFootballStandingsResponse {
  get: string;
  parameters: {
    league: string;
    season: string;
  };
  errors: unknown[]; // Or a more specific error type if known
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: APIFootballLeagueWrapper[];
}

export interface APIFootballLeagueWrapper {
  league: APIFootballLeague;
}

export interface APIFootballLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  standings: APIFootballStandingEntry[][]; // Array of arrays of standing entries
}

export interface APIFootballStandingEntry {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: APIFootballTeamStats;
  home: APIFootballTeamStats;
  away: APIFootballTeamStats;
  update: string; // ISO Date string
}

export interface APIFootballTeamStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
}

// --- End HELPER INTERFACES FOR /standings ENDPOINT ---

// --- HELPER INTERFACES FOR /players/topscorers ENDPOINT ---

export interface APIFootballTopScorersResponse {
  get: string;
  parameters: {
    league: string;
    season: string;
  };
  errors: unknown[]; // Or a more specific error type if known
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: APIFootballPlayerResponseEntry[];
}

export interface APIFootballPlayerResponseEntry {
  player: APIFootballPlayerDetails;
  statistics: APIFootballPlayerStatistics[];
}

export interface APIFootballPlayerDetails {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  birth: {
    date: string;
    place: string;
    country: string;
  };
  nationality: string;
  height: string | null;
  weight: string | null;
  injured: boolean;
  photo: string;
}

export interface APIFootballPlayerStatistics {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  games: {
    appearences: number | null; // API shows number, but null in example for `number` field
    lineups: number | null;
    minutes: number | null;
    number: number | null; // This was 'null' in your example
    position: string | null;
    rating: string | null;
    captain: boolean;
  };
  substitutes: {
    in: number | null;
    out: number | null;
    bench: number | null;
  };
  shots: {
    total: number | null;
    on: number | null;
  };
  goals: {
    total: number;
    conceded: number | null; // API shows 0, let's allow null if it can vary
    assists: number | null;
    saves: null; // Consistently null for attackers
  };
  passes: {
    total: number | null;
    key: number | null;
    accuracy: number | null; // API shows null, but could be a percentage string or number
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
    past: null; // Consistently null in example
  };
  fouls: {
    drawn: number | null;
    committed: number | null;
  };
  cards: {
    yellow: number;
    yellowred: number;
    red: number;
  };
  penalty: {
    won: null; // Consistently null in example
    commited: null; // Consistently null in example
    scored: number;
    missed: number;
    saved: null; // Consistently null in example
  };
}

// --- End HELPER INTERFACES FOR /players/topscorers ENDPOINT ---

/**
 * Represents the structure of a team object as returned by the API within standings or player stats.
 * User to verify all fields and their names (e.g., id, name, logo).
 */
export interface APITeam {
  id: number; // Verify: Field name for team ID (e.g., team.id)
  name: string; // Verify: Field name for team name
  logo?: string | null; // Verify: Field name for team logo URL
}

/**
 * Represents the structure of a player object as returned by the API.
 * User to verify all fields (e.g., id, name, photo).
 */
export interface APIPlayer {
  id: number; // Verify: Field name for player ID
  name: string; // Verify: Field name for player display name
  firstname?: string | null;
  lastname?: string | null;
  photo?: string | null; // Verify: Field name for player photo URL
}

/**
 * Represents game statistics (played, wins, draws, losses, goals for/against)
 * as often provided in standings.
 * User to verify all field names (e.g., all.played, all.win, all.goals.for).
 */
export interface APIStandingsGamesStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals?: {
    for: number;
    against: number;
  } | null;
}

// --- Service Data Models (Types our service methods will return) ---

export interface TeamStanding {
  rank: number;
  team_id: number; // Our internal team ID, mapped from APIStandingsEntry.team.id
  team_name: string;
  logo_url?: string | null;
  points: number;
  goals_difference: number;
  games_played: number;
  games_won: number;
  games_drawn: number;
  games_lost: number;
  form?: string | null; // e.g., "WWLDW"
  description?: string | null; // e.g., "Promotion - Champions League"
  // User to verify: Any other fields to map from APIStandingsEntry
}

export interface LeagueTable {
  competition_api_id: number; // The API's ID for the league/competition
  season_year: number; // The API's representation of the season (e.g., 2019 for 2019/2020)
  league_name: string;
  country_name?: string | null;
  standings: TeamStanding[];
  last_api_update?: string; // ISO timestamp, if available from API, indicating freshness of this specific standing data
}

export interface PlayerStatistic {
  player_api_id: number; // The API's ID for the player
  player_name: string;
  photo_url?: string | null;
  team_api_id: number; // The API's ID for the team the player plays for (in this context)
  team_name: string;
  team_logo_url?: string | null;
  goals: number;
  assists?: number | null;
  matches_played?: number | null;
  // User to verify: Other stats like penalties, cards, minutes played if needed and available from top scorers endpoint.
}

// --- Service Interface ---

export interface ILeagueDataService {
  /**
   * Retrieves the current league table for a given competition and season.
   * @param competitionApiId The API ID of the competition (e.g., Premier League).
   * @param seasonYear The API representation of the season (e.g., 2019 for 2019/2020).
   * @returns A Promise resolving to the LeagueTable object or null if not found/error.
   */
  getCurrentLeagueTable(
    competitionApiId: number, // Changed parameter name for clarity
    seasonYear: number, // Changed parameter name for clarity
  ): Promise<LeagueTable | null>;

  /**
   * Retrieves the current top scorer(s) for a given competition and season.
   * @param competitionApiId The API ID of the competition.
   * @param seasonYear The API representation of the season.
   * @returns A Promise resolving to an array of PlayerStatistic objects or null if not found/error.
   */
  getCurrentTopScorers(
    competitionApiId: number, // Changed parameter name for clarity
    seasonYear: number, // Changed parameter name for clarity
  ): Promise<PlayerStatistic[] | null>;

  /**
   * Retrieves the team with the best goal difference in the current league table.
   * @param competitionApiId The API ID of the competition.
   * @param seasonYear The API representation of the season.
   * @returns A Promise resolving to a TeamStanding object or null if not found/error.
   */
  getTeamWithBestGoalDifference(
    competitionApiId: number, // Changed parameter name for clarity
    seasonYear: number, // Changed parameter name for clarity
  ): Promise<TeamStanding | null>;

  /**
   * Retrieves the team currently in the last place in the league table.
   * @param competitionApiId The API ID of the competition.
   * @param seasonYear The API representation of the season.
   * @returns A Promise resolving to a TeamStanding object or null if not found/error.
   */
  getLastPlaceTeam(
    competitionApiId: number, // Changed parameter name for clarity
    seasonYear: number, // Changed parameter name for clarity
  ): Promise<TeamStanding | null>;
}

// We will implement a class `LeagueDataServiceImpl` that implements `ILeagueDataService` in later subtasks. 

// Define CacheEntry type
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';

export class LeagueDataServiceImpl implements ILeagueDataService {
  private apiKey: string;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

  constructor() {
    // In a real application, the API key should come from a secure configuration source (e.g., environment variables)
    this.apiKey = process.env.NEXT_PUBLIC_FOOTBALL_API_KEY || ''; // Use the correct env variable name
    if (!this.apiKey) {
      console.warn('NEXT_PUBLIC_FOOTBALL_API_KEY is not set. API calls will likely fail.');
    }
  }

  // --- Cache Helper Methods ---
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp < this.CACHE_TTL_MS)) {
      console.log(`Cache HIT for key: ${key}`);
      // Important: Return a copy to prevent accidental mutation of cached object if it's mutable
      // Assert the type after potential deep copy
      const dataCopy = typeof entry.data === 'object' && entry.data !== null 
                       ? JSON.parse(JSON.stringify(entry.data)) 
                       : entry.data;
      return dataCopy as T; // Assert that the retrieved/copied data is of type T
    }
    if (entry) {
        console.log(`Cache STALE for key: ${key}`);
        this.cache.delete(key); // Remove stale entry
    } else {
        console.log(`Cache MISS for key: ${key}`);
    }
    return null;
  }

  private setToCache<T>(key: string, data: T): void {
    // Store a copy to prevent mutations affecting the cache if the returned object is modified
    const dataToCache = typeof data === 'object' && data !== null ? JSON.parse(JSON.stringify(data)) : data;
    this.cache.set(key, { data: dataToCache, timestamp: Date.now() });
    console.log(`Cache SET for key: ${key}`);
  }
  // --- End Cache Helper Methods ---

  async getCurrentLeagueTable(
    competitionApiId: number,
    seasonYear: number,
  ): Promise<LeagueTable | null> {
    const cacheKey = `leagueTable_${competitionApiId}_${seasonYear}`;
    const cachedData = this.getFromCache<LeagueTable>(cacheKey);
    if (cachedData !== null) return cachedData;

    const endpoint = `${API_FOOTBALL_BASE_URL}/standings?league=${competitionApiId}&season=${seasonYear}`;

    try {
      console.log(`FETCHING from API: ${endpoint}`); // Log actual API calls
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText} from ${endpoint}`);
        return null;
      }

      const data: APIFootballStandingsResponse = await response.json();

      if (Array.isArray(data.errors) && data.errors.length > 0) {
        console.error('API returned errors:', data.errors);
        return null;
      }

      if (!data.response || data.response.length === 0 || !data.response[0].league || !data.response[0].league.standings || data.response[0].league.standings.length === 0) {
        console.warn('No league standings data found in API response:', data);
         // Cache the fact that no data was found (e.g., cache null or empty structure) to avoid retrying immediately
        this.setToCache(cacheKey, null); // Or an empty LeagueTable structure if preferred
        return null;
      }
      
      const leagueData = data.response[0].league;
      const transformedStandings: TeamStanding[] = leagueData.standings[0].map(apiEntry => ({
        rank: apiEntry.rank,
        team_id: apiEntry.team.id,
        team_name: apiEntry.team.name,
        logo_url: apiEntry.team.logo,
        points: apiEntry.points,
        goals_difference: apiEntry.goalsDiff,
        games_played: apiEntry.all.played,
        games_won: apiEntry.all.win,
        games_drawn: apiEntry.all.draw,
        games_lost: apiEntry.all.lose,
        form: apiEntry.form,
        description: apiEntry.description,
      }));

      const leagueTableResult: LeagueTable = {
        competition_api_id: leagueData.id,
        season_year: leagueData.season,
        league_name: leagueData.name,
        country_name: leagueData.country,
        standings: transformedStandings,
        last_api_update: leagueData.standings[0]?.[0]?.update,
      };

      this.setToCache(cacheKey, leagueTableResult); // Cache the successful result
      return leagueTableResult;

    } catch (error) {
      console.error('Failed to fetch league table:', error);
      return null;
    }
  }

  async getCurrentTopScorers(
    competitionApiId: number,
    seasonYear: number,
  ): Promise<PlayerStatistic[] | null> {
    const cacheKey = `topScorers_${competitionApiId}_${seasonYear}`;
    const cachedData = this.getFromCache<PlayerStatistic[]>(cacheKey);
    if (cachedData !== null) return cachedData; // Can return empty array from cache

    const endpoint = `${API_FOOTBALL_BASE_URL}/players/topscorers?league=${competitionApiId}&season=${seasonYear}`;

    try {
      console.log(`FETCHING from API: ${endpoint}`); // Log actual API calls
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(`API Error for Top Scorers: ${response.status} ${response.statusText} from ${endpoint}`);
        return null;
      }

      const data: APIFootballTopScorersResponse = await response.json();

      if (Array.isArray(data.errors) && data.errors.length > 0) {
        console.error('API returned errors for Top Scorers:', data.errors);
        return null;
      }

      if (!data.response || data.response.length === 0) {
        console.warn('No top scorers data found in API response:', data);
        this.setToCache(cacheKey, []); // Cache the empty array result
        return []; 
      }

      const transformedTopScorers: PlayerStatistic[] = data.response.map(entry => {
        const playerDetails = entry.player;
        const playerStats = entry.statistics[0];

        return {
          player_api_id: playerDetails.id,
          player_name: playerDetails.name,
          photo_url: playerDetails.photo,
          team_api_id: playerStats.team.id,
          team_name: playerStats.team.name,
          team_logo_url: playerStats.team.logo,
          goals: playerStats.goals.total,
          assists: playerStats.goals.assists,
          matches_played: playerStats.games.appearences,
        };
      });

      this.setToCache(cacheKey, transformedTopScorers); // Cache the successful result
      return transformedTopScorers;

    } catch (error) {
      console.error('Failed to fetch top scorers:', error);
      return null;
    }
  }

  async getTeamWithBestGoalDifference(
    competitionApiId: number,
    seasonYear: number,
  ): Promise<TeamStanding | null> {
    const leagueTable = await this.getCurrentLeagueTable(competitionApiId, seasonYear);

    if (!leagueTable || !leagueTable.standings || leagueTable.standings.length === 0) {
      console.warn('Cannot determine team with best goal difference: No league table data.');
      return null;
    }

    let teamWithBestGD: TeamStanding | null = null;

    for (const team of leagueTable.standings) {
      if (teamWithBestGD === null || team.goals_difference > teamWithBestGD.goals_difference) {
        teamWithBestGD = team;
      }
    }
    
    // If multiple teams have the same best goal difference, this returns the first one encountered.
    // To return all, this method would need to return Promise<TeamStanding[] | null>
    // and collect all teams that match the max goal difference.
    return teamWithBestGD;
  }

  async getLastPlaceTeam(
    competitionApiId: number,
    seasonYear: number,
  ): Promise<TeamStanding | null> {
    const leagueTable = await this.getCurrentLeagueTable(competitionApiId, seasonYear);

    if (!leagueTable || !leagueTable.standings || leagueTable.standings.length === 0) {
      console.warn('Cannot determine last place team: No league table data.');
      return null;
    }

    let lastPlaceTeam: TeamStanding | null = null;

    for (const team of leagueTable.standings) {
      if (lastPlaceTeam === null || team.rank > lastPlaceTeam.rank) {
        lastPlaceTeam = team;
      }
    }
    
    // If multiple teams are tied for last place (e.g. if API provided such data, though unusual for rank),
    // this returns the first one encountered with the highest rank value.
    // Similar to getTeamWithBestGoalDifference, this could be modified to return all tied teams.
    return lastPlaceTeam;
  }
} 