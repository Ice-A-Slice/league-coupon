import { supabaseServerClient } from './server'; // Import the client we want to mock
import { getFixturesForRound, getCurrentBettingRoundFixtures } from './queries'; // Import functions to test
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

// Remove unused variables
// const mockDbFixtures = [ ... ]; 
// const expectedMatches = [ ... ];

// --- Mock Data for getFixturesForRound ---
const mockDbFixturesForGetRound = [
  // ... existing mock data ...
   {
    id: 101,
    kickoff_time: '2024-08-17T11:30:00+00:00',
    home_team_id: 1,
    away_team_id: 2,
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
const expectedMatchesForGetRound: Match[] = [
  // ... existing expected data ...
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

// --- Mock Data for getCurrentBettingRoundFixtures ---
// Helper to create mock fixture data
const createMockFixture = (id: number, kickoff: string, roundId: number, roundName: string, status: string = 'NS') => ({
  id,
  kickoff,
  status_short: status, // Use status_short
  round_id: roundId,
  round: { name: roundName }, // Simplified nested structure for mock
  home_team: { id: id * 2, name: `Home ${id}` },
  away_team: { id: id * 2 + 1, name: `Away ${id}` },
});

describe('Supabase Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-add @ts-expect-error as this mocking pattern can be tricky with TS
    // @ts-expect-error // Type mismatch due to simplified mock
    (supabaseServerClient.from as jest.Mock).mockClear().mockReturnThis();
    // @ts-expect-error // Type mismatch due to simplified mock
    (supabaseServerClient.select as jest.Mock).mockClear().mockReturnThis();
    // @ts-expect-error // Type mismatch due to simplified mock
    (supabaseServerClient.eq as jest.Mock).mockClear().mockReturnThis();
    // @ts-expect-error // Type mismatch due to simplified mock
    (supabaseServerClient.order as jest.Mock).mockClear();
  });

  describe('getFixturesForRound', () => {
    const testRound = 'Test Round 1';
    const testSeasonYear = 2024;
    const testLeagueId = 99;

    it('should return formatted matches when query is successful', async () => {
      // Arrange: Mock the final .order() call to return successful data
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: mockDbFixturesForGetRound, // Use specific mock data
         error: null,
      });

      // Act: Call the function under test
      const result = await getFixturesForRound(testRound, testSeasonYear, testLeagueId);

      // Assert
      expect(result).toEqual(expectedMatchesForGetRound);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      
      // Use stringContaining for less brittle assertion on the select string
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('id,')
      );
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('kickoff,')
      );
       // @ts-expect-error // Type mismatch due to simplified mock
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('home_team:teams!fixtures_home_team_id_fkey(id, name)')
      );
       // @ts-expect-error // Type mismatch due to simplified mock
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('away_team:teams!fixtures_away_team_id_fkey(id, name)')
      );
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('round:rounds!inner(')
      );
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('season:seasons!inner(')
      );
       // @ts-expect-error // Type mismatch due to simplified mock
       expect(supabaseServerClient.select).toHaveBeenCalledWith(
        expect.stringContaining('competition:competitions!inner(')
      );

      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.name', testRound);
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.season.api_season_year', testSeasonYear);
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('round.season.competition.api_league_id', testLeagueId);
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.order).toHaveBeenCalledWith('kickoff', { ascending: true });
    });

    it('should return null and log error when query fails', async () => {
      // Arrange: Mock the final .order() call to return an error
      const mockError = new Error('Supabase query failed');
      // @ts-expect-error // Type mismatch due to simplified mock
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
        // @ts-expect-error // Type mismatch due to simplified mock
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
        // @ts-expect-error // Type mismatch due to simplified mock
        expect(supabaseServerClient.order).toHaveBeenCalledTimes(1);
    });
  });

  // --- Tests for getCurrentBettingRoundFixtures (Refactored) ---
  describe('getCurrentBettingRoundFixtures', () => {
    // Mocks for the different stages of the function
    let fromBettingRoundsMock: jest.Mock;
    let fromBettingRoundFixturesMock: jest.Mock;
    let fromFixturesMock: jest.Mock;
    let fromUserSeasonAnswersMock: jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();

      fromBettingRoundsMock = jest.fn();
      fromBettingRoundFixturesMock = jest.fn();
      fromFixturesMock = jest.fn(); // This will now be what .in() resolves to
      fromUserSeasonAnswersMock = jest.fn().mockResolvedValue({ data: [], error: null }); // Default empty answers

      // @ts-expect-error - Assigning mock implementation
      supabaseServerClient.from = jest.fn((tableName: string) => {
        if (tableName === 'betting_rounds') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: fromBettingRoundsMock
                  }))
                }))
              }))
            }))
          };
        }
        if (tableName === 'betting_round_fixtures') {
          return {
            select: jest.fn(() => ({ 
              eq: fromBettingRoundFixturesMock
            }))
          };
        }
        if (tableName === 'fixtures') {
          return {
            select: jest.fn(() => ({ 
              // .in(...).order(...) is the terminal chain for this path in the actual code
              in: jest.fn(() => ({
                order: fromFixturesMock
              }))
            }))
          };
        }
        if (tableName === 'user_season_answers') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: fromUserSeasonAnswersMock
              }))
            }))
          };
        }
        // Fallback for any unexpected table name
        return { 
          select: jest.fn().mockReturnThis(), 
          eq: jest.fn().mockReturnThis(), 
          limit: jest.fn().mockReturnThis(), 
          single: jest.fn(), 
          in: jest.fn().mockReturnThis(), 
          order: jest.fn() 
        };
      });
    });

    it('should return null if no open betting round is found', async () => {
      // Arrange: Mock the .single() call for betting_rounds to return a "no rows" error
      fromBettingRoundsMock.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toBeNull();
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      // Ensure other mocks were not called
      expect(fromBettingRoundFixturesMock).not.toHaveBeenCalled();
      expect(fromFixturesMock).not.toHaveBeenCalled();
    });

    it('should return null on unexpected error fetching open round', async () => {
      // Arrange: Mock the .single() call to throw a different error
      const mockError = new Error('DB connection failed');
      fromBettingRoundsMock.mockResolvedValueOnce({ data: null, error: mockError });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toBeNull();
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching open betting round:', mockError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error occurred in getCurrentBettingRoundFixtures:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should return round info with empty matches if open round has no fixtures', async () => {
      // Arrange:
      // 1. Mock finding the open round (successful)
      fromBettingRoundsMock.mockResolvedValueOnce({ data: { id: 99, name: 'Open Round 99' }, error: null });
      // 2. Mock finding no associated fixtures (returns empty array)
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: [], error: null });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toEqual({
        roundId: 99,
        roundName: 'Open Round 99',
        matches: [],
      });
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(fromBettingRoundFixturesMock).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Query: Open betting round 99 has no associated fixtures.');
      // Ensure final fixtures query was NOT made
      expect(fromFixturesMock).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should return the correct round and fixtures when an open round exists', async () => {
      // Arrange:
      const openRound = { id: 101, name: 'Current Open Round' };
      const roundFixtureLinks = [{ fixture_id: 201 }, { fixture_id: 202 }];
      const fixtureDetails = [
          createMockFixture(201, '2024-09-10T12:00:00Z', openRound.id, openRound.name, 'NS'),
          createMockFixture(202, '2024-09-10T14:00:00Z', openRound.id, openRound.name, 'NS'),
      ];

      // 1. Mock finding the open round
      fromBettingRoundsMock.mockResolvedValueOnce({ data: openRound, error: null });
      // 2. Mock finding associated fixture IDs
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: roundFixtureLinks, error: null });
      // 3. Mock fetching fixture details
      fromFixturesMock.mockResolvedValueOnce({ data: fixtureDetails, error: null });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.roundId).toBe(openRound.id);
      expect(result?.roundName).toBe(openRound.name);
      expect(result?.matches).toHaveLength(2);
      expect(result?.matches.map(m => m.id)).toEqual([201, 202]);

      // Verify mock calls
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(fromBettingRoundFixturesMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      expect(fromFixturesMock).toHaveBeenCalledTimes(1);

      // We might want more specific checks on the *arguments* passed to the final methods
      // e.g., checking that eq() was called with the correct roundId, and in() with the fixtureIds
      // However, the current mock setup makes this very verbose. This check confirms the flow.
    });

    it('should return null on error fetching round fixtures', async () => {
      // Arrange:
      fromBettingRoundsMock.mockResolvedValueOnce({ data: { id: 102, name: 'Another Open Round' }, error: null });
      const mockError = new Error('Failed to get round fixtures');
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: null, error: mockError }); // Error here
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toBeNull();
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(fromBettingRoundFixturesMock).toHaveBeenCalledTimes(1);
      expect(fromFixturesMock).not.toHaveBeenCalled(); // Final query shouldn't happen
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching fixtures for betting round 102:', mockError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error occurred in getCurrentBettingRoundFixtures:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should return null on error fetching fixture details', async () => {
      // Arrange:
      const openRound = { id: 103, name: 'Round With Fixture Fetch Error' };
      const roundFixtureLinks = [{ fixture_id: 301 }];
      const mockError = new Error('Failed to get fixture details');

      fromBettingRoundsMock.mockResolvedValueOnce({ data: openRound, error: null });
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: roundFixtureLinks, error: null });
      fromFixturesMock.mockResolvedValueOnce({ data: null, error: mockError });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toBeNull();
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(fromBettingRoundsMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(fromBettingRoundFixturesMock).toHaveBeenCalledTimes(1);
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      expect(fromFixturesMock).toHaveBeenCalledTimes(1);
      // Correct the expected log message
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching fixture details for betting round 103:', mockError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error occurred in getCurrentBettingRoundFixtures:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should fetch user season answers when userId is provided', async () => {
      // Arrange
      const openRound = {
        id: 104,
        name: 'Test Round with User',
        competitions: {
          seasons: [{ id: 123 }]
        }
      };
      const roundFixtureLinks = [{ fixture_id: 401 }];
      const fixtureDetails = [
        {
          id: 401,
          kickoff: '2024-08-17T11:30:00+00:00',
          home_team: { id: 1, name: 'Home Team' },
          away_team: { id: 2, name: 'Away Team' }
        }
      ];
      const userAnswers = [
        { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null },
        { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 100 }
      ];

      fromBettingRoundsMock.mockResolvedValueOnce({ data: openRound, error: null });
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: roundFixtureLinks, error: null });
      fromFixturesMock.mockResolvedValueOnce({ data: fixtureDetails, error: null });
      fromUserSeasonAnswersMock.mockResolvedValueOnce({ data: userAnswers, error: null });

      // Act
      const result = await getCurrentBettingRoundFixtures('test-user-id');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.userSeasonAnswers).toEqual({
        league_winner: 1,
        top_scorer: 100
      });
      expect(supabaseServerClient.from).toHaveBeenCalledWith('user_season_answers');
      expect(fromUserSeasonAnswersMock).toHaveBeenCalledTimes(1);
    });

    it('should not fetch user season answers when userId is not provided', async () => {
      // Arrange
      const openRound = { id: 105, name: 'Test Round No User' };
      const roundFixtureLinks = [{ fixture_id: 501 }];
      const fixtureDetails = [
        {
          id: 501,
          kickoff: '2024-08-17T11:30:00+00:00',
          home_team: { id: 1, name: 'Home Team' },
          away_team: { id: 2, name: 'Away Team' }
        }
      ];

      fromBettingRoundsMock.mockResolvedValueOnce({ data: openRound, error: null });
      fromBettingRoundFixturesMock.mockResolvedValueOnce({ data: roundFixtureLinks, error: null });
      fromFixturesMock.mockResolvedValueOnce({ data: fixtureDetails, error: null });

      // Act
      const result = await getCurrentBettingRoundFixtures(); // No userId

      // Assert
      expect(result).not.toBeNull();
      expect(result?.userSeasonAnswers).toBeUndefined();
      expect(fromUserSeasonAnswersMock).not.toHaveBeenCalled();
    });

    // Old tests remain commented out
    /*
    it('should return null if no NS fixtures are found', async () => {
// ... existing code ...
    });
    */
  });
});

// **Note:** The original mocking approach, while potentially causing lint warnings about accessing
// methods directly on the client mock, was working correctly for the tests.
// Reverting to that simpler structure. The refined chained mocking introduced access issues 
// within the test execution context. 