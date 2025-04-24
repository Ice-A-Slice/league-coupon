import { renderHook, act } from '@testing-library/react-hooks';
import fetchMock from 'jest-fetch-mock';
import { useFixtures } from './useFixtures';
import { Match } from '../../../types/match';

// ... fetch mock setup ...

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

  // ... beforeEach ...

  test('should return initial loading state and empty matches', () => { /* ... */ });

  test('should fetch matches successfully and update state', async () => { /* ... */ });

  test('should handle fetch error and update state', async () => { /* ... */ });

  test('should handle fetch throwing an error (e.g., network error)', async () => { /* ... */ });

  test('should refetch data when refetch function is called', async () => {
    // ... initial fetch setup ...
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMatches,
      // ... rest of mock response ...
    });

    const { result } = renderHook(() => useFixtures(defaultProps));

    // ... wait for initial load ...

    // Mock the next fetch response - Corrected data structure
    const updatedMatches: Match[] = [
        { id: 101, homeTeam: 'Team A', awayTeam: 'Team B' },
        { id: 102, homeTeam: 'Team C', awayTeam: 'Team D' },
        { id: 103, homeTeam: 'Team E', awayTeam: 'Team F' }, // Added a match
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedMatches,
      // ... rest of mock response ...
    });

    // ... call refetch and assertions ...
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2); 
    expect(result.current.isLoading).toBe(false); 
    expect(result.current.matches).toEqual(updatedMatches); 
    expect(result.current.error).toBeNull();
  });

  test('should refetch data when dependencies (props) change', async () => {
    // ... initial fetch setup ...
     fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMatches,
      // ... rest of mock response ...
    });

    // ... initial render ...

    // Mock the next fetch response - Corrected data structure
    const nextRoundMatches: Match[] = [
        { id: 201, homeTeam: 'Team G', awayTeam: 'Team H' }
    ];
    fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => nextRoundMatches,
       // ... rest of mock response ...
    });

    // ... rerender with new props ...

    // ... assertions ...
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // ... other assertions ...
    expect(result.current.matches).toEqual(nextRoundMatches);
    expect(result.current.error).toBeNull();
  });

});