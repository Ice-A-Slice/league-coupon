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
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Explicitly reset the mock implementation for chained methods if needed
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

  // --- Tests for getCurrentBettingRoundFixtures ---
  describe('getCurrentBettingRoundFixtures', () => {

    it('should return null if no NS fixtures are found', async () => {
      // Arrange: Mock DB to return empty array
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).toBeNull();
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('status_short', 'NS');
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.order).toHaveBeenCalledWith('kickoff', { ascending: true });
    });

    it('should return a single fixture if only one NS fixture exists', async () => {
      // Arrange: Mock DB to return one fixture
      const mockFixture = createMockFixture(201, '2024-09-01T12:00:00Z', 50, 'Regular Season - 5');
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [mockFixture],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(1);
      expect(result?.matches[0].id).toBe(201);
      expect(result?.roundId).toBe(50);
      expect(result?.roundName).toBe('Round 5'); // Check custom name extraction
      expect(supabaseServerClient.from).toHaveBeenCalledWith('fixtures');
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.eq).toHaveBeenCalledWith('status_short', 'NS');
      // @ts-expect-error // Type mismatch due to simplified mock
      expect(supabaseServerClient.order).toHaveBeenCalledWith('kickoff', { ascending: true });
    });

    it('should group multiple fixtures within the time gap', async () => {
      // Arrange: 3 fixtures, 48 hours apart (within 72h threshold)
      const fixture1 = createMockFixture(301, '2024-09-05T12:00:00Z', 60, 'Regular Season - 6');
      const fixture2 = createMockFixture(302, '2024-09-07T12:00:00Z', 60, 'Regular Season - 6'); // 48h gap
      const fixture3 = createMockFixture(303, '2024-09-09T12:00:00Z', 60, 'Regular Season - 6'); // 48h gap
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1, fixture2, fixture3],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(3);
      expect(result?.matches.map(m => m.id)).toEqual([301, 302, 303]);
      expect(result?.roundId).toBe(60);
      expect(result?.roundName).toBe('Round 6');
    });

    it('should stop grouping when the time gap exceeds the threshold', async () => {
      // Arrange: 3 fixtures, first gap 48h, second gap 80h (over 72h threshold)
      const fixture1 = createMockFixture(401, '2024-09-10T12:00:00Z', 70, 'Regular Season - 7');
      const fixture2 = createMockFixture(402, '2024-09-12T12:00:00Z', 70, 'Regular Season - 7'); // 48h gap
      const fixture3 = createMockFixture(403, '2024-09-15T20:00:00Z', 70, 'Regular Season - 7'); // 80h gap
      // @ts-expect-error // Type mismatch due to simplified mock
       (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1, fixture2, fixture3],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(2); // Should only include the first two
      expect(result?.matches.map(m => m.id)).toEqual([401, 402]);
      expect(result?.roundId).toBe(70);
      expect(result?.roundName).toBe('Round 7');
    });

    it('should group fixtures with a gap just under the threshold', async () => {
       // Arrange: Gap of 71 hours (just under 72h)
      const fixture1 = createMockFixture(501, '2024-09-20T12:00:00Z', 80, 'Regular Season - 8');
      const fixture2 = createMockFixture(502, '2024-09-23T11:00:00Z', 80, 'Regular Season - 8'); // 71h gap
      // @ts-expect-error // Type mismatch due to simplified mock
       (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1, fixture2],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(2);
      expect(result?.matches.map(m => m.id)).toEqual([501, 502]);
      expect(result?.roundId).toBe(80);
      expect(result?.roundName).toBe('Round 8');
    });

    it('should generate mixed round names correctly (e.g., Round 9/10)', async () => {
      // Arrange: Fixtures from different API rounds within the time gap
      const fixture1 = createMockFixture(601, '2024-10-01T12:00:00Z', 90, 'Regular Season - 9');
      const fixture2 = createMockFixture(602, '2024-10-02T12:00:00Z', 90, 'Regular Season - 9'); // 24h gap
      const fixture3 = createMockFixture(603, '2024-10-03T12:00:00Z', 100, 'Regular Season - 10'); // 24h gap, different round
      const fixture4 = createMockFixture(604, '2024-10-05T12:00:00Z', 100, 'Regular Season - 10'); // 48h gap
      // Fixture 5 has a large gap, should not be included
      const fixture5 = createMockFixture(605, '2024-10-10T12:00:00Z', 110, 'Regular Season - 11'); // 120h gap
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1, fixture2, fixture3, fixture4, fixture5],
         error: null,
      });

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(4); // Includes fixtures 1-4
      expect(result?.matches.map(m => m.id)).toEqual([601, 602, 603, 604]);
      expect(result?.roundId).toBe(90); // ID from the first fixture
      expect(result?.roundName).toBe('Round 9/10'); // Custom mixed name
    });

    it('should skip fixtures with missing kickoff times but continue grouping', async () => {
      // Arrange
      const fixture1 = createMockFixture(701, '2024-11-01T12:00:00Z', 120, 'Regular Season - 12');
      // Fixture 2 is missing kickoff
      const fixture2 = { ...createMockFixture(702, '', 120, 'Regular Season - 12'), kickoff: null };
      const fixture3 = createMockFixture(703, '2024-11-02T12:00:00Z', 120, 'Regular Season - 12'); // Small gap from fixture1
      const fixture4 = createMockFixture(704, '2024-11-05T12:00:00Z', 120, 'Regular Season - 12'); // Large gap from fixture3
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1, fixture2, fixture3, fixture4],
         error: null,
      });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Fixture ID 702 missing kickoff time. Skipping.');
      expect(result?.matches).toHaveLength(2); // Includes 1 and 3
      expect(result?.matches.map(m => m.id)).toEqual([701, 703]);
      expect(result?.roundName).toBe('Round 12');
      consoleWarnSpy.mockRestore();
    });

    it('should use fallback round name if number extraction fails', async () => {
      // Arrange
      const fixture1 = createMockFixture(801, '2024-12-01T12:00:00Z', 130, 'Round without number');
      // @ts-expect-error // Type mismatch due to simplified mock
      (supabaseServerClient.order as jest.Mock).mockResolvedValueOnce({
         data: [fixture1],
         error: null,
      });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const result = await getCurrentBettingRoundFixtures();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(1);
      expect(result?.matches[0].id).toBe(801);
      expect(result?.roundId).toBe(130);
      expect(result?.roundName).toBe('Round ID 130'); // Fallback name
      expect(consoleWarnSpy).toHaveBeenCalledWith("Could not extract numeric round numbers from the group. Using fallback name.");
      consoleWarnSpy.mockRestore();
    });
  });
});

// **Note:** The original mocking approach, while potentially causing lint warnings about accessing
// methods directly on the client mock, was working correctly for the tests.
// Reverting to that simpler structure. The refined chained mocking introduced access issues 
// within the test execution context. 