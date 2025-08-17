import { renderHook, waitFor } from '@testing-library/react';
import { useQuestionnaireData } from './useQuestionnaireData';
import type { Team as QuestionnaireTeam, Player } from '@/components/Questionnaire/types'; // Adjust path if necessary

// Mock the global fetch function
global.fetch = jest.fn();

// Helper to cast mock fetch
const fetchMock = global.fetch as jest.Mock;

// Sample props for the hook
const defaultProps = {
  leagueId: 39,
  season: 2024,
};

// Sample data
const mockTeams: QuestionnaireTeam[] = [
  { id: '1', name: 'Team Alpha' },
  { id: '2', name: 'Team Beta' },
];
const mockPlayers: Player[] = [
  { id: '101', name: 'Player One', teamId: '1' },
  { id: '102', name: 'Player Two', teamId: '2' },
];

describe('useQuestionnaireData Hook', () => {

  beforeEach(() => {
    // Reset fetch mock before each test
    fetchMock.mockClear();
    // Reset console mocks if used
    jest.restoreAllMocks();
  });

  test('should return initial loading state and empty data', () => {
    // Mock fetch to be pending indefinitely for both calls
    fetchMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useQuestionnaireData(defaultProps));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.teams).toEqual([]);
    expect(result.current.players).toEqual([]);
    expect(result.current.error).toBeNull();
    // Expect fetch to have been called twice (once for teams, once for players)
    // due to Promise.all. The exact timing/calling isn't guaranteed here,
    // just that the hook starts loading.
    // More specific call checks will be in success/failure tests.
  });

  test('should fetch teams and players successfully', async () => {
    // Mock successful responses for both endpoints
    fetchMock
      .mockResolvedValueOnce({ // First call (teams)
        ok: true,
        json: async () => mockTeams,
        status: 200, statusText: 'OK'
      })
      .mockResolvedValueOnce({ // Second call (players)
        ok: true,
        json: async () => mockPlayers,
        status: 200, statusText: 'OK'
      });

    const { result } = renderHook(() => useQuestionnaireData(defaultProps));

    expect(result.current.isLoading).toBe(true);

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check the results
    expect(result.current.teams).toEqual(mockTeams);
    expect(result.current.players).toEqual(mockPlayers);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(`/api/teams?league=${defaultProps.leagueId}&season=${defaultProps.season}`);
    expect(fetchMock).toHaveBeenCalledWith(`/api/players-all?league=${defaultProps.leagueId}&season=${defaultProps.season}`);
  });

  test('should handle error if teams fetch fails', async () => {
    const errorMsg = 'Teams fetch failed';
    fetchMock
      .mockResolvedValueOnce({ // First call (teams) - FAILS
        ok: false,
        json: async () => ({ error: errorMsg }),
        status: 500, statusText: 'Server Error'
      })
      .mockResolvedValueOnce({ // Second call (players) - SUCCEEDS (but overall fails due to Promise.all)
        ok: true,
        json: async () => mockPlayers,
        status: 200, statusText: 'OK'
      });

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useQuestionnaireData(defaultProps));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.players).toEqual([]); // Data should be cleared if any part fails
    expect(result.current.error).toContain(errorMsg);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should handle error if players fetch fails', async () => {
    const errorMsg = 'Players fetch failed';
    fetchMock
      .mockResolvedValueOnce({ // First call (teams) - SUCCEEDS
        ok: true,
        json: async () => mockTeams,
        status: 200, statusText: 'OK'
      })
      .mockResolvedValueOnce({ // Second call (players) - FAILS
        ok: false,
        json: async () => ({ error: errorMsg }),
        status: 500, statusText: 'Server Error'
      });

     // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useQuestionnaireData(defaultProps));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teams).toEqual([]); // Data should be cleared if any part fails
    expect(result.current.players).toEqual([]);
    expect(result.current.error).toContain(errorMsg);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

    test('should handle error if fetch itself throws (network error)', async () => {
    const networkError = new Error('Network connection failed');
    fetchMock.mockRejectedValueOnce(networkError);
     // Note: Promise.all rejects immediately on the first rejection,
     // so the second fetch might not even be attempted depending on timing.

     // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useQuestionnaireData(defaultProps));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.players).toEqual([]);
    expect(result.current.error).toBe(networkError.message);
    // Can't guarantee fetchMock called twice if the first rejects immediately
    // expect(fetchMock).toHaveBeenCalledTimes(1 or 2);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

}); 