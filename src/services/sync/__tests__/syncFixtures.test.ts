// src/services/sync/__tests__/syncFixtures.test.ts

// Mock server-only package first to prevent errors
jest.mock('server-only', () => ({}));

// Import the modules we need to test
import { syncFixturesForActiveSeason } from '../syncFixtures';
import type { ApiFixturesResponse } from '@/services/football-api/types';
import type { Tables } from '@/types/supabase';
import { supabaseServerClient } from '@/lib/supabase/server';

// Create a complete mock for the Supabase client with proper chaining
const mockSingleFn = jest.fn();
const mockUpsertFn = jest.fn();

// Mock the modules with a simpler approach
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockImplementation((table) => {
      console.log(`Mock from called with table: ${table}`);
      
      // Create a dynamic mock that can be customized per test
      const mockObj = {
        select: jest.fn().mockImplementation((query) => {
          console.log(`Mock select called with query: ${query}`);
          return {
            eq: jest.fn().mockImplementation((field, value) => {
              console.log(`Mock eq called with field: ${field}, value: ${value}`);
               
              // For fixtures table, we'll customize the response based on the test
              if (table === 'fixtures' && field === 'rounds.season_id') {
                // This will be overridden in specific test cases
                return { data: [] }; 
              }
              
              // Default implementation for single calls (like season query)
               return {
                 single: mockSingleFn
               };
            })
          };
        }),
        upsert: mockUpsertFn
      };
      
      return mockObj;
    })
  }
}));

jest.mock('@/lib/seasons', () => ({
  getCurrentSeasonId: jest.fn().mockResolvedValue(55)
}));

jest.mock('@/services/football-api/client', () => ({
  fetchFixtures: jest.fn()
}));

// Import the mocked modules
// Removed: import { getCurrentSeasonId } from '@/lib/seasons';
import { fetchFixtures } from '@/services/football-api/client';

// Define minimal interfaces for nested 'any' types
interface MockApiLeague { id?: number; name?: string; country?: string; logo?: string; flag?: string; season?: number; round?: string; }
interface MockApiTeams { home?: { id?: number; name?: string; logo?: string; winner?: boolean | null }; away?: { id?: number; name?: string; logo?: string; winner?: boolean | null }; }

// Helper to create mock API fixture data
const createMockApiFixture = (id: number, status: string, home: number | null, away: number | null, kickoff: string = '2024-01-01T12:00:00Z'): ApiFixturesResponse['response'][0] => ({
  fixture: { 
    id, 
    date: kickoff, 
    status: { short: status, long: `Status ${status}`, elapsed: null }, 
    referee: 'Ref', 
    timezone: 'UTC', 
    timestamp: 0, 
    periods: { first: null, second: null }, 
    venue: { id: null, name: null, city: null } 
  },
  goals: { home, away },
  score: { 
    halftime: { home: 0, away: 0 }, 
    fulltime: { home, away }, 
    extratime: { home: null, away: null }, 
    penalty: { home: null, away: null } 
  },
  league: {} as MockApiLeague, // Use defined interface
  teams: {} as MockApiTeams, // Use defined interface
});

// Helper to create mock DB fixture data
// Refined type for rounds
const createMockDbFixture = (id: number, apiFixtureId: number, status: string, home: number | null, away: number | null, kickoff: string = '2024-01-01T12:00:00Z'): Partial<Tables<'fixtures'> & { rounds: { season_id: number } }> => ({
  id,
  api_fixture_id: apiFixtureId,
  status_short: status,
  home_goals: home,
  away_goals: away,
  kickoff,
  result: home === null || away === null ? null : (home > away ? '1' : (home < away ? '2' : 'X')),
  home_goals_ht: 0,
  away_goals_ht: 0,
  referee: 'Ref',
  rounds: { season_id: 55 } // Include nested structure expected by select
});


describe('Fixture Synchronization Logic', () => {

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up default mock responses
    mockSingleFn.mockResolvedValue({
      data: { api_season_year: 2024, competitions: [{ api_league_id: 39 }] },
      error: null
    });
    
    mockUpsertFn.mockResolvedValue({ error: null });
    
    (fetchFixtures as jest.Mock).mockResolvedValue({ response: [], results: 0 });
  });


  test('Scenario 1: should not update when API and DB data match', async () => {
      // 1. Setup Mocks
      const apiFixtureData = [createMockApiFixture(101, 'FT', 2, 1)];
      // Removed unused variable: const dbFixtureData = [createMockDbFixture(1, 101, 'FT', 2, 1)];
      (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
      
      // Override the mock for this specific test to return DB fixture data
      const mockEq1 = jest.fn().mockReturnValue({ data: [createMockDbFixture(1, 101, 'FT', 2, 1)] }); // Use create directly
      const mockSelect1 = jest.fn().mockReturnValue({ eq: mockEq1 });
      (supabaseServerClient.from as jest.Mock).mockImplementation((table) => {
        if (table === 'fixtures') {
          return {
            select: mockSelect1,
            upsert: mockUpsertFn
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: mockSingleFn })
          })
        };
      });

      // 2. Execute
      const result = await syncFixturesForActiveSeason();

      // 3. Assertions
      expect(result.success).toBe(true);
      expect(result.details).toEqual(expect.objectContaining({ updated: 0, skipped: 1 }));
      // We can't easily test the chain calls with this approach
  });

   test('Scenario 2: should update fixture when status changes', async () => {
       // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', null, null, '2024-01-01T14:00:00Z')]; 
       const dbFixtureData = [createMockDbFixture(1, 101, 'NS', null, null, '2024-01-01T12:00:00Z')]; 
       // Set up the mock to return the DB fixture data
       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       
       // Override the mock for this specific test to return DB fixture data
       const mockEq2 = jest.fn().mockReturnValue({ data: dbFixtureData });
       const mockSelect2 = jest.fn().mockReturnValue({ eq: mockEq2 });
       
       // Replace the from implementation for this test
       (supabaseServerClient.from as jest.Mock).mockImplementation((table) => {
         if (table === 'fixtures') {
           return {
             select: mockSelect2,
             upsert: mockUpsertFn
           };
         }
         
         // Default implementation for other tables
         return {
           select: jest.fn().mockReturnValue({
             eq: jest.fn().mockReturnValue({
               single: mockSingleFn
             })
           })
         };
       });

       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(true);
       expect(result.details).toEqual(expect.objectContaining({ updated: 1, skipped: 0 }));
       expect(mockUpsertFn).toHaveBeenCalledTimes(1);
   });


   test('Scenario 7: should return success:false when DB select fails', async () => {
       // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', 2, 1)];
       // Removed unused variable: const dbError = new Error("DB select error");
       // Set up the mock to return the API fixture data
       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       
       // Override the mock for this specific test to return an error
       const dbError2 = new Error("DB select error");
       const mockEq3 = jest.fn().mockReturnValue({ data: null, error: dbError2 });
       const mockSelect3 = jest.fn().mockReturnValue({ eq: mockEq3 });
       
       // Replace the from implementation for this test
       (supabaseServerClient.from as jest.Mock).mockImplementation((table) => {
         if (table === 'fixtures') {
           return {
             select: mockSelect3,
             upsert: mockUpsertFn
           };
         }
         
         // Default implementation for other tables
         return {
           select: jest.fn().mockReturnValue({
             eq: jest.fn().mockReturnValue({
               single: mockSingleFn
             })
           })
         };
       });

       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(false);
       expect(result.message).toContain('Failed to fetch existing fixtures from database');
       expect(result.details).toBe(dbError2);
       expect(mockUpsertFn).not.toHaveBeenCalled();
   });

   test('Scenario 8: should return success:false when DB upsert fails', async () => {
      // 1. Setup Mocks
       const apiFixtureData = [createMockApiFixture(101, 'FT', 3, 0)]; // Score changed
       const dbFixtureData = [createMockDbFixture(1, 101, 'FT', 2, 1)];
       // Removed unused variable: const upsertError = new Error("DB upsert error");

       // Set up the mock to return the API fixture data
       (fetchFixtures as jest.Mock).mockResolvedValue({ response: apiFixtureData, results: 1 });
       
       // Set up the upsert mock to return an error
       const upsertError2 = new Error("DB upsert error");
       mockUpsertFn.mockResolvedValue({ error: upsertError2 });
       
       // Override the mock for this specific test to return DB fixture data
       const mockEq4 = jest.fn().mockReturnValue({ data: dbFixtureData });
       const mockSelect4 = jest.fn().mockReturnValue({ eq: mockEq4 });
       
       // Replace the from implementation for this test
       (supabaseServerClient.from as jest.Mock).mockImplementation((table) => {
         if (table === 'fixtures') {
           return {
             select: mockSelect4,
             upsert: mockUpsertFn
           };
         }
         
         // Default implementation for other tables
         return {
           select: jest.fn().mockReturnValue({
             eq: jest.fn().mockReturnValue({
               single: mockSingleFn
             })
           })
         };
       });

       // 2. Execute
       const result = await syncFixturesForActiveSeason();

       // 3. Assertions
       expect(result.success).toBe(false);
       expect(result.message).toContain('Failed to apply 1 fixture updates');
       expect(result.details).toBe(upsertError2);
       expect(mockUpsertFn).toHaveBeenCalledTimes(1); // Verify upsert was called
   });

  // ... (Implement tests for scenarios 3, 4, 5, 6, 9, 10 using specific mocks) ...

}); 