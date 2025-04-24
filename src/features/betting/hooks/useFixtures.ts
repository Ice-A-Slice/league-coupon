import { useState, useEffect, useCallback } from 'react';
import type { Match } from "@/components/BettingCoupon/types"; // Adjust path if necessary

interface UseFixturesProps {
  leagueId: number;
  season: number;
  round: string;
}

/**
 * Defines the structure of the data returned by the useFixtures hook.
 */
interface UseFixturesReturn {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch football fixtures for a specific league, season, and round.
 * Handles loading and error states, and provides a refetch function.
 *
 * @param leagueId - The ID of the league.
 * @param season - The season year.
 * @param round - The specific round name (e.g., "Regular Season - 35").
 * @returns An object containing the fixture matches, loading state, error state, and a refetch function.
 */
export function useFixtures({ leagueId, season, round }: UseFixturesProps): UseFixturesReturn {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use useCallback to memoize the fetch function
  const fetchFixtures = useCallback(async () => {
    // Prevent fetching if round is empty or invalid - adjust condition as needed
    if (!round) {
        setMatches([]);
        setIsLoading(false);
        setError(null); // Clear previous errors if round becomes invalid
        return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors on new fetch
    console.log(`Fetching fixtures for: league=${leagueId}, season=${season}, round=${round}`);

    try {
      const response = await fetch(`/api/fixtures?league=${leagueId}&season=${season}&round=${encodeURIComponent(round)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Attempt to parse error JSON
        throw new Error(errorData.error || `Fixtures fetch failed: ${response.statusText} (Status: ${response.status})`);
      }

      const data: Match[] = await response.json();
      setMatches(data || []); // Ensure it's always an array
      console.log('useFixtures: Successfully fetched fixtures.', data);

    } catch (err: unknown) {
      console.error('useFixtures: Fixture fetch error:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching fixtures.';
      setError(message);
      setMatches([]); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, season, round]); // Dependencies for useCallback

  // Initial fetch on mount and when dependencies change
  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]); // Dependency is the memoized fetch function

  // Expose the fetch function as refetch
  const refetch = useCallback(async () => {
    // No need to check isMounted here, React handles cleanup
    await fetchFixtures();
  }, [fetchFixtures]);

  return { matches, isLoading, error, refetch };
} 