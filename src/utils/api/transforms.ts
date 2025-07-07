/**
 * Data transformation utilities for API responses
 */

/**
 * Transform database season winner data to clean format
 */
export interface TransformedSeasonWinner {
  id: number;
  season_id: number;
  user_id: string;
  league_id: number;
  total_points: number;
  game_points: number;
  dynamic_points: number;
  created_at: string;
  season?: TransformedSeason;
  user?: TransformedUser;
  profile?: TransformedUser; // Alternative naming for user data
}

/**
 * Transform database season data to clean format
 */
export interface TransformedSeason {
  id: number;
  name: string;
  api_season_year: number;
  competition_id: number;
  start_date: string;
  end_date: string;
  completed_at: string | null;
  winner_determined_at: string | null;
  competition?: TransformedCompetition;
}

/**
 * Transform database user/profile data to clean format
 */
export interface TransformedUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  updated_at?: string;
}

/**
 * Transform database competition data to clean format
 */
export interface TransformedCompetition {
  id: number;
  name: string;
  country_name: string;
  logo_url: string | null;
  api_league_id?: number;
}

/**
 * Transform season winner data from database format
 */
export function transformSeasonWinner(data: Record<string, unknown>): TransformedSeasonWinner {
  if (!data) {
    throw new Error('Season winner data is required');
  }

  const transformed: TransformedSeasonWinner = {
    id: Number(data.id) || 0,
    season_id: Number(data.season_id) || 0,
    user_id: String(data.user_id || ''),
    league_id: Number(data.league_id) || 0,
    total_points: Number(data.total_points) || 0,
    game_points: Number(data.game_points) || 0,
    dynamic_points: Number(data.dynamic_points) || 0,
    created_at: formatDate(data.created_at as string | Date | null | undefined)
  };

  // Transform nested season data
  if (data.season) {
    transformed.season = transformSeason(data.season as Record<string, unknown>);
  }

  // Transform nested user data (handle both 'user' and 'profile' keys)
  if (data.user) {
    transformed.user = transformUser(data.user as Record<string, unknown>);
  } else if (data.profile) {
    transformed.user = transformUser(data.profile as Record<string, unknown>);
  }

  return transformed;
}

/**
 * Transform season data from database format
 */
export function transformSeason(data: Record<string, unknown>): TransformedSeason {
  if (!data) {
    throw new Error('Season data is required');
  }

  const transformed: TransformedSeason = {
    id: Number(data.id) || 0,
    name: String(data.name || ''),
    api_season_year: Number(data.api_season_year) || 0,
    competition_id: Number(data.competition_id) || 0,
    start_date: formatDate(data.start_date as string | Date | null | undefined),
    end_date: formatDate(data.end_date as string | Date | null | undefined),
    completed_at: data.completed_at ? formatDate(data.completed_at as string | Date | null | undefined) : null,
    winner_determined_at: data.winner_determined_at ? formatDate(data.winner_determined_at as string | Date | null | undefined) : null
  };

  // Transform nested competition data
  if (data.competition) {
    transformed.competition = transformCompetition(data.competition as Record<string, unknown>);
  }

  return transformed;
}

/**
 * Transform user/profile data from database format
 */
export function transformUser(data: Record<string, unknown>): TransformedUser {
  if (!data) {
    throw new Error('User data is required');
  }

  return {
    id: String(data.id || ''),
    full_name: String(data.full_name || ''),
    avatar_url: data.avatar_url ? String(data.avatar_url) : null,
    ...(data.updated_at ? { updated_at: formatDate(data.updated_at as string | Date | null | undefined) } : {})
  };
}

/**
 * Transform competition data from database format
 */
export function transformCompetition(data: Record<string, unknown>): TransformedCompetition {
  if (!data) {
    throw new Error('Competition data is required');
  }

  return {
    id: Number(data.id) || 0,
    name: String(data.name || ''),
    country_name: String(data.country_name || ''),
    logo_url: data.logo_url ? String(data.logo_url) : null,
    ...(data.api_league_id ? { api_league_id: Number(data.api_league_id) } : {})
  };
}

/**
 * Transform array of season winners
 */
export function transformSeasonWinners(data: Record<string, unknown>[]): TransformedSeasonWinner[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(item => transformSeasonWinner(item));
}

/**
 * Transform Hall of Fame statistics data
 */
export interface TransformedHallOfFameStats {
  user: TransformedUser;
  total_wins: number;
  total_points: number;
  average_points: number;
  best_points: number;
  worst_points: number;
  first_win_date: string | null;
  latest_win_date: string | null;
  seasons_won?: TransformedSeasonDetail[];
}

/**
 * Transform season detail for statistics
 */
export interface TransformedSeasonDetail {
  season_id: number;
  season_name: string;
  season_year: number;
  completed_at: string | null;
  competition: TransformedCompetition;
  points: number;
}

/**
 * Transform Hall of Fame statistics
 */
export function transformHallOfFameStats(data: Record<string, unknown>): TransformedHallOfFameStats {
  if (!data) {
    throw new Error('Hall of Fame stats data is required');
  }

  const transformed: TransformedHallOfFameStats = {
    user: transformUser(data.user as Record<string, unknown>),
    total_wins: Number(data.total_wins) || 0,
    total_points: Number(data.total_points) || 0,
    average_points: Number(data.average_points) || 0,
    best_points: Number(data.best_points) || 0,
    worst_points: Number(data.worst_points) || 0,
    first_win_date: data.first_win_date ? formatDate(data.first_win_date as string | Date | null | undefined) : null,
    latest_win_date: data.latest_win_date ? formatDate(data.latest_win_date as string | Date | null | undefined) : null
  };

  // Transform seasons won if included
  if (data.seasons_won && Array.isArray(data.seasons_won)) {
    transformed.seasons_won = data.seasons_won.map((season: Record<string, unknown>) => ({
      season_id: Number(season.season_id) || 0,
      season_name: String(season.season_name || ''),
      season_year: Number(season.season_year) || 0,
      completed_at: season.completed_at ? formatDate(season.completed_at as string | Date | null | undefined) : null,
      competition: transformCompetition(season.competition as Record<string, unknown>),
      points: Number(season.points) || 0
    }));
  }

  return transformed;
}

/**
 * Transform array of Hall of Fame statistics
 */
export function transformHallOfFameStatsList(data: Record<string, unknown>[]): TransformedHallOfFameStats[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(item => transformHallOfFameStats(item));
}

/**
 * Format date to ISO string consistently
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString();
  } catch (_error) {
    console.warn('Invalid date format:', date);
    return '';
  }
}

/**
 * Remove null/undefined values from object
 */
export function removeNullValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeNullValues(item)) as T;
  }

  if (typeof obj === 'object') {
    const cleaned = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        (cleaned as Record<string, unknown>)[key] = removeNullValues(value);
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Convert empty strings to null
 */
export function emptyStringsToNull<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => emptyStringsToNull(item)) as T;
  }

  if (typeof obj === 'object') {
    const converted = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      if (value === '') {
        (converted as Record<string, unknown>)[key] = null;
      } else {
        (converted as Record<string, unknown>)[key] = emptyStringsToNull(value);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Ensure numeric values are actual numbers
 */
export function ensureNumericValues(obj: Record<string, unknown>, numericFields: string[]): Record<string, unknown> {
  const result = { ...obj };

  for (const field of numericFields) {
    if (result[field] !== undefined && result[field] !== null) {
      const numValue = Number(result[field]);
      if (!isNaN(numValue)) {
        result[field] = numValue;
      }
    }
  }

  return result;
}

/**
 * Sort array by specified field and direction
 */
export function sortData<T>(
  data: T[],
  sortField: string,
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return [...data].sort((a, b) => {
    const aValue = getNestedValue(a, sortField);
    const bValue = getNestedValue(b, sortField);

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) {
      return direction === 'desc' ? 1 : -1;
    }
    if (bValue === null || bValue === undefined) {
      return direction === 'desc' ? -1 : 1;
    }

    // Handle date strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return direction === 'desc' 
          ? bDate.getTime() - aDate.getTime()
          : aDate.getTime() - bDate.getTime();
      }
    }

    // Handle numeric values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'desc' ? bValue - aValue : aValue - bValue;
    }

    // Handle string values
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return direction === 'desc' 
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue);
    }

    // Fallback comparison
    return direction === 'desc' ? -1 : 1;
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && current !== null && (current as Record<string, unknown>)[key] !== undefined ? (current as Record<string, unknown>)[key] : null;
  }, obj);
}

/**
 * Paginate array data
 */
export function paginateData<T>(
  data: T[],
  limit: number,
  offset: number
): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.slice(offset, offset + limit);
}

/**
 * Create summary statistics from array of numbers
 */
export function createStatsSummary(numbers: number[]): {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  median: number;
} {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      min: 0,
      max: 0,
      median: 0
    };
  }

  const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
  
  if (validNumbers.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      min: 0,
      max: 0,
      median: 0
    };
  }

  const sum = validNumbers.reduce((acc, n) => acc + n, 0);
  const sorted = [...validNumbers].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    count: validNumbers.length,
    sum,
    average: Math.round(sum / validNumbers.length),
    min: Math.min(...validNumbers),
    max: Math.max(...validNumbers),
    median: Math.round(median)
  };
}

/**
 * Transform data for admin response format
 */
export function transformForAdminResponse(data: unknown, metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data: Array.isArray(data) ? data.map(item => removeNullValues(item)) : removeNullValues(data),
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Transform data for public response format
 */
export function transformForPublicResponse(
  data: unknown,
  queryInfo: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    success: true,
    data: Array.isArray(data) ? data.map(item => removeNullValues(item)) : removeNullValues(data),
    query_info: {
      request_time_ms: Date.now(),
      ...queryInfo
    },
    ...(Object.keys(metadata).length > 0 && { metadata })
  };
} 