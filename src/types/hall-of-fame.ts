// Hall of Fame API response types and interfaces

export interface Competition {
  id: number;
  name: string;
  country_name: string;
  logo_url: string;
  api_league_id?: number;
}

export interface Season {
  id: number;
  name: string;
  api_season_year: number;
  competition_id: number;
  start_date: string;
  end_date: string;
  completed_at: string | null;
  winner_determined_at: string | null;
  competition: Competition;
}

export interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  updated_at: string;
}

export interface SeasonWinner {
  id: number;
  season_id: number;
  user_id: string;
  league_id: number;
  total_points: number;
  game_points: number;
  dynamic_points: number;
  competition_type: string | null;
  created_at: string;
  season: Season;
  user: User;
}

export interface PaginationMetadata {
  total_items: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  has_more: boolean;
}

export interface HallOfFameResponse {
  success: boolean;
  data: SeasonWinner[];
  pagination: PaginationMetadata;
  query_info: {
    sort: string;
    competition_id: number | null;
    request_time_ms: number;
  };
  error?: string;
}

export interface PlayerStats {
  user: User;
  total_wins: number;
  league_wins: number;
  cup_wins: number;
  total_points: number;
  average_points: number;
  best_points: number;
  worst_points: number;
  first_win_date: string | null;
  latest_win_date: string | null;
  seasons_won?: SeasonDetails[];
}

export interface SeasonDetails {
  season_id: number;
  season_name: string;
  season_year: number;
  completed_at: string;
  competition: Competition;
  points: number;
}

export interface OverallStats {
  total_players: number;
  total_seasons_completed: number;
  total_points_awarded: number;
  average_points_per_season: number;
  total_league_wins: number;
  total_cup_wins: number;
  top_player: {
    user: User;
    total_wins: number;
    total_points: number;
  } | null;
}

export interface StatsResponse {
  success: boolean;
  data: {
    leaderboard: PlayerStats[];
    overall_stats: OverallStats;
  };
  query_info: {
    sort: string;
    competition_id: number | null;
    include_seasons: boolean;
    limit: number;
    total_records: number;
    request_time_ms: number;
  };
  error?: string;
}

// Component prop types
export interface HallOfFameViewProps {
  currentUserId?: string;
  competitionId?: number;
  className?: string;
}

export type HallOfFameViewType = 'seasons' | 'leaderboard';

export type HallOfFameSortOption = 'newest' | 'oldest' | 'points_desc' | 'points_asc';
export type LeaderboardSortOption = 'wins_desc' | 'wins_asc' | 'points_desc' | 'points_asc' | 'recent';

export interface HallOfFameFilters {
  sort: HallOfFameSortOption;
  limit: number;
  page: number;
}

export interface LeaderboardFilters {
  sort: LeaderboardSortOption;
  limit: number;
  includeSeasons: boolean;
} 