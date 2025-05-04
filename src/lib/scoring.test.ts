// src/lib/scoring.test.ts
// Note: We're still having issues with the test. Working on a better approach.

// REMOVED: Entire manual mock implementation block

// Apply the manual mock - Define the mock object INSIDE the factory function
// REMOVED: jest.mock definition

// --- End Manual Mock Implementation ---

// Removed unused import: import { type SupabaseClient } from '@supabase/supabase-js'; // Keep this type import
import { SupabaseClient } from '@supabase/supabase-js'; // Need the actual type now
import { calculateAndStoreMatchPoints } from './scoring';
// Removed unused import: import type { Database, Tables } from '@/types/supabase';
import type { Database } from '@/types/supabase'; // Import only Database
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Type definitions remain the same...
// Removed unused type: type MockBettingRound = Database['public']['Tables']['betting_rounds']['Row'];
type MockFixture = Database['public']['Tables']['fixtures']['Row'];
type MockUserBet = Database['public']['Tables']['user_bets']['Row'];
// Removed unused type: type MockBettingRoundFixture = Database['public']['Tables']['betting_round_fixtures']['Row'];

// Mock the logger to prevent actual logging during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Define types for mock data for clarity
type MockFixtureLink = { fixture_id: number };

// --- Mocks Setup ---

// Define an interface for the mocked client methods we use
// Use more specific types for Jest mocks instead of `any`
// Removed unnecessary eslint-disable comments
/* // Removing the specific mock interface, will try Partial<SupabaseClient>
interface MockSupabaseClient {
  from: jest.Mock<Promise<{ data: any[] | null; error: any | null }>, [string]>; // Mock `from` returning a promise
  rpc: jest.Mock<Promise<{ data: any | null; error: any | null }>, [string, any]>; // Mock `rpc` returning a promise
  // Add other methods if needed by specific tests, e.g.:
  // select: jest.Mock<Promise<{ data: any[] | null; error: any | null }>, []>;
  // eq: jest.Mock<Promise<{ data: any[] | null; error: any | null }>, [string, any]>;
  // single: jest.Mock<Promise<{ data: any | null; error: any | null }>, []>;
  // update: jest.Mock<Promise<{ data: any[] | null; error: any | null }>, [any]>;
}
*/

// Create mocks for specific Supabase functions we need to control
// ... existing code ...

describe('Scoring Logic - calculateAndStoreMatchPoints', () => {
  // Use Partial<SupabaseClient> and define mocks inline
  let mockClient: Partial<SupabaseClient<Database>>;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockRpc = jest.fn();
    // Removed unused `tableName` parameter from mock implementation
    // Initialize only the methods we actually use in the tests
    mockClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn(), // Needed by some mock setups potentially
        // Add other chained methods if needed by tests
      })),
      rpc: mockRpc,
    };

    // Default mock implementation for .from()
    // This ensures basic chaining works, specific tests will override
    // Already handled in the initialization above
    // mockClient.from.mockImplementation(/* Remove unused tableName */ () => mockClient);
  });

  it('should correctly score a completed round with simple predictions', async () => {
    // Arrange
    const bettingRoundId = 101;
    const mockFixtureLinks: MockFixtureLink[] = [
      { fixture_id: 1 }, { fixture_id: 2 }, { fixture_id: 3 }, { fixture_id: 4 }, { fixture_id: 5 }
    ];
    const mockFixturesData: MockFixture[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' }, // Result: 1
      { id: 2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' }, // Result: X
      { id: 3, home_goals: 1, away_goals: 2, status_short: 'FT', result: '2' }, // Result: 2
      { id: 4, home_goals: 3, away_goals: 3, status_short: 'AET', result: 'X'}, // Result: X
      { id: 5, home_goals: 1, away_goals: 0, status_short: 'PEN', result: '1'}, // Result: 1
    ];
    const mockUserBets: MockUserBet[] = [
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null }, // Correct
      { id: 'bet2', user_id: 'user1', fixture_id: 2, prediction: '1', points_awarded: null }, // Incorrect
      { id: 'bet3', user_id: 'user2', fixture_id: 3, prediction: '2', points_awarded: null }, // Correct
      { id: 'bet4', user_id: 'user2', fixture_id: 4, prediction: 'X', points_awarded: 0 },   // Already scored (0 points), should be skipped
      { id: 'bet5', user_id: 'user3', fixture_id: 5, prediction: '2', points_awarded: null }, // Incorrect
    ];

    // Mock database calls
    // Removed unused `tableName` parameter from mock implementation
    // Use mockImplementation directly on the initialized mockClient.from
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'betting_round_fixtures') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockFixtureLinks, error: null })
          })
        };
      } else if (table === 'fixtures') {
        return { select: () => ({ in: () => Promise.resolve({ data: mockFixturesData, error: null }) }) };
      } else if (table === 'user_bets') {
        return { select: () => ({ eq: () => Promise.resolve({ data: mockUserBets, error: null }) }) };
      }
      return mockClient; // Default fallback for chaining
    });

    // Mock RPC call to succeed
    mockRpc.mockResolvedValue({ error: null });

    // --- Act ---
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // --- Assert --- 
    expect(result.success).toBe(true); // Expect overall success
    expect(result.message).toContain("Scoring completed successfully");
    expect(result.details?.betsProcessed).toBe(5); // Processed all 5 bets
    expect(result.details?.betsUpdated).toBe(4); // Sent 4 updates (bet4 was skipped)

    // Verify DB calls
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('user_bets');
    
    // Verify RPC call
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('handle_round_scoring', {
      p_betting_round_id: bettingRoundId,
      p_bet_updates: expect.arrayContaining([
        expect.objectContaining({ bet_id: 'bet1', points: 1 }), // Correct
        expect.objectContaining({ bet_id: 'bet2', points: 0 }), // Incorrect
        expect.objectContaining({ bet_id: 'bet3', points: 1 }), // Correct
        // Bet 4 was already scored
        expect.objectContaining({ bet_id: 'bet5', points: 0 }), // Incorrect
      ]),
    });
    // Ensure bet4 is NOT in the updates
    expect(mockRpc.mock.calls[0][1].p_bet_updates).not.toContainEqual(
      expect.objectContaining({ bet_id: 'bet4' })
    );
    expect(mockRpc.mock.calls[0][1].p_bet_updates).toHaveLength(4); 
  });

  it('should return an error if the betting round fixtures cannot be fetched', async () => {
    // Arrange
    const bettingRoundId = 104;
    const mockLinkError = { message: 'Failed to fetch links', code: '42P01' }; // Example error

    // Mock the fixture link fetch to fail
    // Removed unused `tableName` parameter
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'betting_round_fixtures') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: mockLinkError })
          })
        };
      }
      return mockClient;
    });

    // Act
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch associated fixtures."); 
    expect(result.details?.error).toEqual(mockLinkError);
    expect(mockClient.from).toHaveBeenCalledTimes(1); // Only fixture link fetch attempted
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockRpc).not.toHaveBeenCalled(); // RPC should not be called
  });

  it('should return early if not all fixtures are finished', async () => {
    // Arrange
    const bettingRoundId = 105;
    const mockFixtureLinks: MockFixtureLink[] = [{ fixture_id: 1 }, { fixture_id: 2 }, { fixture_id: 3 }];
    const mockFixturesData: MockFixture[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT' }, // Finished
      { id: 2, home_goals: 1, away_goals: 1, status_short: 'FT' }, // Finished
      { id: 3, home_goals: null, away_goals: null, status_short: 'NS' }, // Not Started
    ];
      
    // Mock DB calls
    // Removed unused `tableName` parameter
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'betting_round_fixtures') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockFixtureLinks, error: null })
            })
          };
      } else if (table === 'fixtures') {
          // Ensure the correct chaining for the fixture fetch
          return { select: () => ({ in: () => Promise.resolve({ data: mockFixturesData, error: null }) }) }; 
      }
      return mockClient;
    });

    // Act
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // Assert
    expect(result.success).toBe(true); // Should return success but indicate deferral
    expect(result.message).toContain("Scoring deferred: Not all fixtures finished");
    // Check the calls that *should* have happened
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('fixtures');
    // Ensure calls related to bets and RPC did NOT happen
    expect(mockClient.from).not.toHaveBeenCalledWith('user_bets'); 
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should handle errors during the RPC call', async () => {
    // Arrange
    const bettingRoundId = 107;
    const mockFixtureLinks: MockFixtureLink[] = [{ fixture_id: 1 }];
    const mockFixturesData: MockFixture[] = [{ id: 1, home_goals: 1, away_goals: 0, status_short: 'FT', result: '1' }];
    const mockUserBets: MockUserBet[] = [{ id: 'bet7', user_id: 'user7', fixture_id: 1, prediction: '1', points_awarded: null }];
    const mockRpcError = { message: 'Transaction failed', code: 'P0001' };

    // Setup mocks for successful fixture/bet fetching
    // Removed unused `tableName` parameter
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'betting_round_fixtures') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockFixtureLinks, error: null })
            })
          };
      } else if (table === 'fixtures') {
          return { select: () => ({ in: () => Promise.resolve({ data: mockFixturesData, error: null }) }) };
      } else if (table === 'user_bets') {
          return { select: () => ({ eq: () => Promise.resolve({ data: mockUserBets, error: null }) }) };
      }
      return mockClient;
    });

    // Mock the RPC call to fail
    mockRpc.mockResolvedValue({ error: mockRpcError }); // Simulate RPC error

    // Act
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // Assert
    expect(result.success).toBe(false); // Expect overall failure due to RPC error
    expect(result.message).toContain("Failed to store scores transactionally via RPC function.");
    expect(result.details?.error).toEqual(mockRpcError);
    expect(mockRpc).toHaveBeenCalledTimes(1); // Ensure RPC was called
    // Verify prior DB calls happened
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('user_bets');
  });

  it('should mark round as scored if no fixtures are linked', async () => {
    // Arrange
    const bettingRoundId = 108;
    const mockFixtureLinks: MockFixtureLink[] = []; // Empty array
    const mockUpdate = jest.fn().mockResolvedValue({ error: null }); // Mock for final status update

    // Removed unused `tableName` parameter
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'betting_round_fixtures') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockFixtureLinks, error: null })
          })
        };
      } else if (table === 'betting_rounds') {
        // Mock the update call for setting status to 'scored'
        return { update: () => ({ eq: () => mockUpdate() }) }; 
      }
      return mockClient;
    });

    // Act
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain("No fixtures linked to this round; marked as scored.");
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('betting_rounds'); // Called to update status
    expect(mockUpdate).toHaveBeenCalledTimes(1); // Check final update was called
    expect(mockClient.from).not.toHaveBeenCalledWith('fixtures'); // Should not fetch fixtures
    expect(mockClient.from).not.toHaveBeenCalledWith('user_bets'); // Should not fetch bets
    expect(mockRpc).not.toHaveBeenCalled(); // RPC not called
  });

  it('should mark round as scored if no user bets are found', async () => {
    // Arrange
    const bettingRoundId = 109;
    const mockFixtureLinks: MockFixtureLink[] = [{ fixture_id: 1 }];
    const mockFixturesData: MockFixture[] = [{ id: 1, home_goals: 1, away_goals: 0, status_short: 'FT', result: '1' }];
    const mockUserBets: MockUserBet[] = []; // Empty array
    const mockUpdate = jest.fn().mockResolvedValue({ error: null }); // Mock for final status update

    // Removed unused `tableName` parameter
    (mockClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'betting_round_fixtures') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtureLinks, error: null })
              })
            };
        } else if (table === 'fixtures') {
            return { select: () => ({ in: () => Promise.resolve({ data: mockFixturesData, error: null }) }) };
        } else if (table === 'user_bets') {
            return { select: () => ({ eq: () => Promise.resolve({ data: mockUserBets, error: null }) }) }; // Return empty bets
        } else if (table === 'betting_rounds') {
            return { update: () => ({ eq: () => mockUpdate() }) }; // Mock final update
        }
        return mockClient;
      });

    // Act
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient as SupabaseClient<Database>);

    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain("No user bets for this round; marked as scored.");
    expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('fixtures');
    expect(mockClient.from).toHaveBeenCalledWith('user_bets');
    expect(mockClient.from).toHaveBeenCalledWith('betting_rounds'); // Called for final update
    expect(mockUpdate).toHaveBeenCalledTimes(1); // Check final update was called
    expect(mockRpc).not.toHaveBeenCalled(); // RPC not called
  });
});