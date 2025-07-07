'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  HallOfFameResponse, 
  StatsResponse, 
  HallOfFameFilters, 
  LeaderboardFilters 
} from '@/types/hall-of-fame';

interface UseHallOfFameResult {
  data: HallOfFameResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseHallOfFameStatsResult {
  data: StatsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching Hall of Fame season winners
 */
export function useHallOfFame(
  filters: HallOfFameFilters,
  competitionId?: number
): UseHallOfFameResult {
  const [data, setData] = useState<HallOfFameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        limit: filters.limit.toString(),
        offset: ((filters.page - 1) * filters.limit).toString(),
        sort: filters.sort,
      });

      if (competitionId) {
        params.append('competition_id', competitionId.toString());
      }

      const response = await fetch(`/api/hall-of-fame?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Hall of Fame data: ${response.status}`);
      }

      const result: HallOfFameResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Hall of Fame data');
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching Hall of Fame data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, competitionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * Custom hook for fetching Hall of Fame statistics and leaderboard
 */
export function useHallOfFameStats(
  filters: LeaderboardFilters,
  competitionId?: number
): UseHallOfFameStatsResult {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        limit: filters.limit.toString(),
        sort: filters.sort,
        include_seasons: filters.includeSeasons.toString(),
      });

      if (competitionId) {
        params.append('competition_id', competitionId.toString());
      }

      const response = await fetch(`/api/hall-of-fame/stats?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Hall of Fame stats: ${response.status}`);
      }

      const result: StatsResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Hall of Fame stats');
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching Hall of Fame stats:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, competitionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * Custom hook for fetching a specific season winner
 */
export function useSeasonWinner(seasonId: number) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/hall-of-fame/season/${seasonId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Season winner not found');
        }
        throw new Error(`Failed to fetch season winner: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch season winner');
      }

      setData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching season winner:', err);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (seasonId > 0) {
      fetchData();
    }
  }, [fetchData, seasonId]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
} 