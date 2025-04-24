import { renderHook, waitFor, act } from '@testing-library/react';
// import fetchMock from 'jest-fetch-mock'; // Remove if not used, fetch is globally mocked
import { useFixtures } from './useFixtures';
// Use the correct path for Match type based on previous successful runs
import type { Match } from '@/components/BettingCoupon/types';

// Mock the global fetch function
global.fetch = jest.fn();

// Add back the fetchMock helper constant definition
const fetchMock = global.fetch as jest.Mock;

// Sample props for the hook
const defaultProps = {
  leagueId: 39,
  season: 2024,
  round: 'Regular Season - 35',
};

// Sample match data - Corrected to match the actual Match type
const mockMatches: Match[] = [
  {
    id: 101,
    homeTeam: 'Team A',
    awayTeam: 'Team B',
  },
   {
    id: 102,
    homeTeam: 'Team C',
    awayTeam: 'Team D',
  }
];

describe('useFixtures Hook', () => {

  beforeEach(() => {
    fetchMock.mockClear();
    jest.restoreAllMocks();
  });

  test('should return initial loading state and empty matches', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFixtures(defaultProps));
    expect(result.current.isLoading).toBe(true);
    // ... rest of assertions ...
    expect(result.current.matches).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('should fetch matches successfully and update state', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockMatches, status: 200, statusText: 'OK' });
    const { result } = renderHook(() => useFixtures(defaultProps));
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    // ... rest of assertions ...
    expect(result.current.matches).toEqual(mockMatches);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(defaultProps.round)));
  });

  test('should handle fetch error and update state', async () => {
    const errorMessage = 'Failed to fetch';
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: errorMessage }), status: 500, statusText: 'Internal Server Error' });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useFixtures(defaultProps));
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    // ... rest of assertions ...
    expect(result.current.matches).toEqual([]);
    expect(result.current.error).toContain(errorMessage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('should handle fetch throwing an error (e.g., network error)', async () => {
    const networkError = new Error('Network error');
    fetchMock.mockRejectedValueOnce(networkError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useFixtures(defaultProps));
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    // ... rest of assertions ...
    expect(result.current.matches).toEqual([]);
    expect(result.current.error).toBe(networkError.message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('should refetch data when refetch function is called', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockMatches, status: 200, statusText: 'OK' });
    const { result } = renderHook(() => useFixtures(defaultProps));
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    const updatedMatches: Match[] = [
        { id: 101, homeTeam: 'Team A', awayTeam: 'Team B' },
        { id: 102, homeTeam: 'Team C', awayTeam: 'Team D' },
        { id: 103, homeTeam: 'Team E', awayTeam: 'Team F' },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => updatedMatches, status: 200, statusText: 'OK' });
    await act(async () => { await result.current.refetch(); });
    // ... rest of assertions ...
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.matches).toEqual(updatedMatches);
    expect(result.current.error).toBeNull();
  });

  test('should refetch data when dependencies (props) change', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockMatches, status: 200, statusText: 'OK' });
    const initialProps = { leagueId: 39, season: 2024, round: 'Round 1' };
    // Ensure renderHook is called here
    const { result, rerender } = renderHook((props) => useFixtures(props), {
      initialProps: initialProps,
    });
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    // ... assertions for initial load ...
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.matches).toEqual(mockMatches);

    const nextRoundMatches: Match[] = [
        { id: 201, homeTeam: 'Team G', awayTeam: 'Team H' }
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => nextRoundMatches, status: 200, statusText: 'OK' });
    const nextProps = { ...initialProps, round: 'Round 2' };
    rerender(nextProps);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => { expect(result.current.isLoading).toBe(false); });
    // ... rest of assertions ...
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(nextProps.round)));
    expect(result.current.matches).toEqual(nextRoundMatches);
    expect(result.current.error).toBeNull();
  });

});