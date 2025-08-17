import { useState, useEffect, useCallback } from 'react';
// Adjust paths as necessary based on your actual component/type locations
import type { Team as QuestionnaireTeam, Player } from "@/components/Questionnaire/types";

interface UseQuestionnaireDataProps {
  leagueId: number;
  season: number;
}

interface UseQuestionnaireDataReturn {
  teams: QuestionnaireTeam[];
  players: Player[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch teams and players data required for the Questionnaire.
 * Fetches data concurrently and manages combined loading/error states.
 *
 * @param leagueId - The ID of the league.
 * @param season - The season year.
 * @returns An object containing teams, players, loading state, and error state.
 */
export function useQuestionnaireData({ leagueId, season }: UseQuestionnaireDataProps): UseQuestionnaireDataReturn {
  const [teams, setTeams] = useState<QuestionnaireTeam[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching questionnaire data for: league=${leagueId}, season=${season}`);

    try {
      const [teamsRes, playersRes] = await Promise.all([
        fetch(`/api/teams?league=${leagueId}&season=${season}`),
        fetch(`/api/players-all?league=${leagueId}&season=${season}`)
      ]);

      // Process Teams
      if (!teamsRes.ok) {
        const errorData = await teamsRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Teams fetch failed: ${teamsRes.statusText}`);
      }
      const teamsData: QuestionnaireTeam[] = await teamsRes.json();
      setTeams(teamsData || []);
      console.log('useQuestionnaireData: Successfully fetched teams.', teamsData);

      // Process Players
      if (!playersRes.ok) {
        const errorData = await playersRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Players fetch failed: ${playersRes.statusText}`);
      }
      const playersData: Player[] = await playersRes.json();
      setPlayers(playersData || []);
      console.log('useQuestionnaireData: Successfully fetched players.', playersData);

    } catch (err: unknown) {
      console.error('useQuestionnaireData: Data fetch error:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching questionnaire data.';
      setError(message);
      setTeams([]); // Clear data on error
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, season]);

  // Initial fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Note: A separate refetch function isn't strictly required here based on current needs,
  // as data only changes infrequently (per discussion). Re-fetching happens if leagueId/season change.
  // If manual refresh was needed, we could expose `fetchData` similar to useFixtures.

  return { teams, players, isLoading, error };
} 