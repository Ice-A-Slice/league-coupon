import { supabaseServerClient } from './server'; // Import the client we want to mock
import { getFixturesForRound } from './queries'; // Import the function to test
import type { Match } from '@/components/BettingCoupon/types'; // Import necessary types

// Mock the Supabase server client
jest.mock('./server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockReturnThis(), 
    select: jest.fn().mockReturnThis(), // Ensure all chained methods return 'this' initially
    eq: jest.fn().mockReturnThis(),
    order: jest.fn(), // We will mock the final .order() call in each test
  }
}));

// Fix mock data structure to match expected Supabase join result
const mockDbFixtures = [
  {
    id: 101,
    kickoff_time: '2024-08-17T11:30:00+00:00',
    home_team_id: 1,
    away_team_id: 2,
    // Adjust structure based on `select('*, home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)')`
    home_team: { id: 1, name: 'Team Alpha' }, 
    away_team: { id: 2, name: 'Team Beta' }  
  },
  {
    id: 102,
    kickoff_time: '2024-08-17T14:00:00+00:00',
    home_team_id: 3,
    away_team_id: 4,
    home_team: { id: 3, name: 'Team Gamma' },
    away_team: { id: 4, name: 'Team Delta' }
  },
];

// Expected output remains the same
const expectedMatches: Match[] = [
  {
    id: 101,
    homeTeam: 'Team Alpha',
    awayTeam: 'Team Beta',
  },
  {
    id: 102,
    homeTeam: 'Team Gamma',
    awayTeam: 'Team Delta',
  },
];

describe('Supabase Queries', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Explicitly reset the mock implementation for chained methods if needed
    (supabaseServerClient.from as jest.Mock).mockClear().mockReturnThis();
    (supabaseServerClient.select as jest.Mock).mockClear().mockReturnThis();
    (supabaseServerClient.eq as jest.Mock).mockClear().mockReturnThis();
    (supabaseServerClient.order as jest.Mock).mockClear();
  });

  describe('getFixturesForRound', () => {
    const testRound = 'Test Round 1';
    const testSeasonYear = 2024;
    const testLeagueId = 99;

    it('should return formatted matches when query is successful', async () => {
      // Arrange: Mock the final .order() call to return successful data
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({ 
         data: mockDbFixtures,
         error: null,
      });

      // Act: Call the function under test
      const result = await getFixturesForRound(testRound, testSeasonYear, testLeagueId);

      // Assert
      expect(result).toEqual(expectedMatches);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      
      // Use stringContaining for less brittle assertion on the select string
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('id,')
      );
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('kickoff,')
      );
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('home_team:teams!fixtures_home_team_id_fkey(id, name)')
      );
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('away_team:teams!fixtures_away_team_id_fkey(id, name)')
      );
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('round:rounds!inner(')
      );
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('season:seasons!inner(')
      );
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('competition:competitions!inner(')
      );

      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.name', testRound);
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.season.api_season_year', testSeasonYear);
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.season.competition.api_league_id', testLeagueId);
      expect(supabaseServerClient.order).toHaveBeenCalledWith('kickoff', { ascending: true });
    });

    it('should return null and log error when query fails', async () => {
      // Arrange: Mock the final .order() call to return an error
      const mockError = new Error('Supabase query failed');
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({ 
         data: null,
         error: mockError,
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy on console.error

      // Act: Call the function under test
      const result = await getFixturesForRound(testRound, testSeasonYear, testLeagueId);

      // Assert
      expect(result).toBeNull();
      // Update assertion to match actual log message
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching fixtures from Supabase:', 
        mockError // Check that the specific error object was logged
      );
      // We can also check for the second log message if needed
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'An error occurred in getFixturesForRound:', 
        mockError
      );
      
      consoleErrorSpy.mockRestore(); // Restore console.error
    });

    it('should return an empty array when no fixtures are found', async () => {
        // Arrange: Mock the final .order() call to return empty data
        (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({ 
            data: [], // Empty array
            error: null,
        });

        // Act
        const result = await getFixturesForRound(testRound, testSeasonYear, testLeagueId);

        // Assert
        expect(result).toEqual([]);
        // Optionally add checks that the query was still made
        expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
        expect(supabaseServerClient.order).toHaveBeenCalledTimes(1);
    });
  });
}); 