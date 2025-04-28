// src/services/sync/__tests__/syncFixtures.test.ts

// Mock server-only package first to prevent errors
jest.mock('server-only', () => ({}));

// Import the modules we need to test
import { syncFixturesForActiveSeason } from '../syncFixtures';
import type { ApiFixturesResponse } from '@/services/football-api/types';
import type { Tables } from '@/types/supabase';

// --- Mocks Setup ---

// Create mocks for specific Supabase functions we need to control
const mockSingleFn = jest.fn(); // For the seasons .single() query
const mockUpsertFn = jest.fn(); // For fixture .upsert()
let mockEqFn = jest.fn();      // For the fixtures .eq() query (can be reset/redefined in tests)
let mockSelectFn = jest.fn().mockImplementation(() => ({ eq: mockEqFn })); // For fixtures .select()

// Mock the server client module
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockImplementation((table: string) => {
      // console.log(`Mock from called with table: ${table}`); // Optional: Keep for debugging

      if (table === 'seasons') {
        // Handle the season query specifically - return chainable object ending in .single()
        return {
          select: jest.fn().mockReturnThis(), // Allows chaining .select()
          eq: jest.fn().mockReturnThis(),     // Allows chaining .eq()
          single: mockSingleFn               // The final call uses our controllable mock
        };
      }

      if (table === 'fixtures') {
        // Handle fixture queries - return chainable object for select/eq and upsert
        return {
          select: mockSelectFn, // Uses the controllable mockSelectFn
          upsert: mockUpsertFn  // Uses the controllable mockUpsertFn
        };
      }

      // Default fallback for any other table (shouldn't be hit in these tests)
      console.warn(`Unexpected table mocked: ${table}`);
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn(),
      };
    })
  }
}));

// Mock other dependencies
jest.mock('@/lib/seasons', () => ({
  // Keep this mock simple as getCurrentSeasonId is called *within* syncFixturesForActiveSeason
  // The actual seasons query is handled by the supabaseServerClient mock above
  getCurrentSeasonId: jest.fn().mockResolvedValue(1) // Use the actual DB ID from logs
}));

jest.mock('@/services/football-api/client', () => ({
  fetchFixtures: jest.fn()
}));

// Import the mocked fetchFixtures AFTER mocking
import { fetchFixtures } from '@/services/football-api/client';

// --- Helper Functions (Keep as is) ---
interface MockApiLeague { id: number; name: string; country: string; logo: string | null; flag?: string; season?: number; round?: string; }
interface MockApiTeamInfo { id: number; name: string; logo: string | null; winner?: boolean | null; }
interface MockApiTeams { home: MockApiTeamInfo; away: MockApiTeamInfo; }
const createMockApiFixture = (id: number, status: string, home: number | null, away: number | null, kickoff: string = '2024-01-01T12:00:00Z'): ApiFixturesResponse['response'][0] => ({
  fixture: { 
    id, 
    date: kickoff, 
    status: { short: status, long: `Status ${status}`, elapsed: null }, 
    referee: 'Ref', 
    timezone: 'UTC', 
    timestamp: 0, 
    periods: { first: null, second: null }, 
    venue: { id: 0, name: 'Venue', city: 'City' } // Provide dummy non-null values if needed by type
  },
  goals: { home, away },
  score: { 
    halftime: { home: 0, away: 0 }, 
    fulltime: { home, away }, 
    extratime: { home: null, away: null }, 
    penalty: { home: null, away: null } 
  },
  // Provide minimal required fields for league and teams, including name, country, logo
  league: { id: 0, name: 'Mock League', country: 'Mock Country', logo: null } as MockApiLeague, 
  teams: { 
    home: { id: 0, name: 'Home Team', logo: null }, 
    away: { id: 0, name: 'Away Team', logo: null } 
  } as MockApiTeams, 
});
const createMockDbFixture = (id: number, apiFixtureId: number, status: string, home: number | null, away: number | null, kickoff: string = '2024-01-01T12:00:00Z', roundId: number = 1, homeTeamId: number = 33, awayTeamId: number = 48): Partial<Tables<'fixtures'> & { rounds: { season_id: number } }> => ({
  id,
  api_fixture_id: apiFixtureId,
  status_short: status,
  status_long: `Status ${status}`,
  home_goals: home,
  away_goals: away,
  kickoff,
  result: home === null || away === null ? null : (home > away ? '1' : (home < away ? '2' : 'X')),
  home_goals_ht: 0,
  away_goals_ht: 0,
  referee: 'Ref',
  rounds: { season_id: 1 },
  round_id: roundId,
  home_team_id: homeTeamId,
  away_team_id: awayTeamId
});
// --- End Helpers ---


describe('Fixture Synchronization Logic', () => {

  beforeEach(() => {
    // Clear all mock function calls and reset implementations
    jest.clearAllMocks();
    
    // Reset specific mocks to default *successful* states
    mockSingleFn.mockResolvedValue({
      data: {
        api_season_year: 2024,
        competitions: { // Mocking the object structure we confirmed
          api_league_id: 39
        }
      },
      error: null
    });
    mockUpsertFn.mockResolvedValue({ error: null });
    mockEqFn = jest.fn().mockResolvedValue({ data: [], error: null }); // Default: find no existing fixtures
    mockSelectFn = jest.fn().mockImplementation(() => ({ eq: mockEqFn })); // Re-link select to eq

    // Reset fetchFixtures mock
    (fetchFixtures as jest.Mock).mockResolvedValue({ response: [], results: 0 });
    // Reset getCurrentSeasonId mock (though less critical now as seasons query is mocked directly)
    // jest.mocked(getCurrentSeasonId).mockResolvedValue(1); // If needed
  });


  test('Scenario 1: should not update when API and DB data match', async () => {
      // 1. Setup Mocks
      const apiFixtureData = [createMockApiFixture(101, 'FT', 2, 1)];
      const dbFixtureData = [createMockDbFixture(1, 101, 'FT', 2, 1)]; 
      (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
      
      // Override fixture query mock for THIS test
      mockEqFn.mockResolvedValue({ data: dbFixtureData, error: null });

      // 2. Execute
      const result = await syncFixturesForActiveSeason();

      // 3. Assertions
      expect(result.success).toBe(true); // Should now pass
      expect(result.details).toEqual(expect.objectContaining({ updated: 0, skipped: 1 }));
      // We can still check if upsert was NOT called
      expect(mockUpsertFn).not.toHaveBeenCalled();
      // Check that the correct season details were fetched
      expect(mockSingleFn).toHaveBeenCalled(); 
      // Check that fixture fetch was attempted
      expect(mockEqFn).toHaveBeenCalledWith('rounds.season_id', 1);
  });

   test('Scenario 2: should update fixture when status changes', async () => {
       // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', null, null, '2024-01-01T14:00:00Z')]; 
       const dbFixtureData = [createMockDbFixture(1, 101, 'NS', null, null, '2024-01-01T12:00:00Z')]; 
       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       
       // Override fixture query mock for THIS test
       mockEqFn.mockResolvedValue({ data: dbFixtureData, error: null });
       
       // Upsert mock should use default success state from beforeEach

       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(true); // Should now pass
       expect(result.details).toEqual(expect.objectContaining({ updated: 1, skipped: 0 }));
       expect(mockUpsertFn).toHaveBeenCalledTimes(1);
       // Check the payload sent to upsert
       expect(mockUpsertFn).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ // Check essential fields in the payload
                    id: 1, 
                    api_fixture_id: 101,
                    round_id: 1, // Use default from helper
                    home_team_id: 33, // Use default from helper
                    away_team_id: 48, // Use default from helper
                    kickoff: '2024-01-01T14:00:00Z', // Updated kickoff
                    status_short: 'FT', // Updated status
                })
            ]),
            { onConflict: 'id' }
       );
   });


   test('Scenario 7: should return success:false when DB select fails', async () => {
       // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', 2, 1)];
       const dbError = new Error("DB select error");
       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       
       // Override fixture query mock to simulate DB error
       mockEqFn.mockResolvedValue({ data: null, error: dbError });
       
       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(false);
       // Check the specific error message from the function
       expect(result.message).toContain('Failed to fetch existing fixtures from database'); 
       expect(result.details).toBe(dbError);
       expect(mockUpsertFn).not.toHaveBeenCalled();
   });

   test('Scenario 8: should return success:false when DB upsert fails', async () => {
      // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', 3, 0)]; // Score changed
       const dbFixtureData = [createMockDbFixture(1, 101, 'FT', 2, 1)];
       const upsertError = new Error("DB upsert error");

       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       // Override fixture query mock to return existing data
       mockEqFn.mockResolvedValue({ data: dbFixtureData, error: null }); 
       // Override upsert mock to simulate failure
       mockUpsertFn.mockResolvedValue({ error: upsertError }); 

       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(false);
       // Check the specific error message - should be 1 update
       expect(result.message).toContain('Failed to apply 1 fixture updates.'); // Corrected count
       expect(result.details).toBe(upsertError);
       expect(mockUpsertFn).toHaveBeenCalledTimes(1); // Verify upsert was still called
   });

  // ... (Implement tests for scenarios 3, 4, 5, 6, 9, 10 using specific mocks) ...

}); 