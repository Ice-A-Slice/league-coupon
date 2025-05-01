// src/lib/scoring.test.ts
// Note: We're still having issues with the test. Working on a better approach.

// REMOVED: Entire manual mock implementation block

// Apply the manual mock - Define the mock object INSIDE the factory function
// REMOVED: jest.mock definition

// --- End Manual Mock Implementation ---

import { type SupabaseClient } from '@supabase/supabase-js'; // Keep this type import
import { calculateAndStoreMatchPoints } from './scoring';
import type { Database } from '@/types/supabase';

// Type definitions remain the same...
type MockBettingRound = Database['public']['Tables']['betting_rounds']['Row'];
type MockFixture = Database['public']['Tables']['fixtures']['Row'];
type MockUserBet = Database['public']['Tables']['user_bets']['Row'];
type MockBettingRoundFixture = Database['public']['Tables']['betting_round_fixtures']['Row'];

describe('Scoring Logic - calculateAndStoreMatchPoints', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly score a completed round with simple predictions', async () => {
      // Arrange
      const bettingRoundId = 101;
      const fixtureId1 = 201;
      const fixtureId2 = 202;
      const userId1 = 'user-abc';
      const userId2 = 'user-xyz';

      // --- Mock Data --- 
      const mockRoundClosed: MockBettingRound = { id: bettingRoundId, status: 'closed', name: 'BR 101', competition_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), earliest_fixture_kickoff: null, latest_fixture_kickoff: null, scored_at: null };
      const mockLinks: MockBettingRoundFixture[] = [ { betting_round_id: bettingRoundId, fixture_id: fixtureId1, created_at: new Date().toISOString() }, { betting_round_id: bettingRoundId, fixture_id: fixtureId2, created_at: new Date().toISOString() }];
      const mockFixtures: Partial<MockFixture>[] = [ { id: fixtureId1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' }, { id: fixtureId2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' }];
      const mockBets: MockUserBet[] = [
          // Bet 1: Correct prediction (1 vs 1)
          { id: 'bet1', user_id: userId1, betting_round_id: bettingRoundId, fixture_id: fixtureId1, prediction: '1', points_awarded: null, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() },
          // Bet 2: Incorrect prediction (2 vs X)
          { id: 'bet2', user_id: userId1, betting_round_id: bettingRoundId, fixture_id: fixtureId2, prediction: '2', points_awarded: null, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() },
          // Bet 3: Incorrect prediction (X vs 1)
          { id: 'bet3', user_id: userId2, betting_round_id: bettingRoundId, fixture_id: fixtureId1, prediction: 'X', points_awarded: null, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() },
          // Bet 4: Correct prediction (X vs X)
          { id: 'bet4', user_id: userId2, betting_round_id: bettingRoundId, fixture_id: fixtureId2, prediction: 'X', points_awarded: null, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() },
          // Bet 5: Already scored (should be skipped)
          { id: 'bet5', user_id: userId1, betting_round_id: bettingRoundId, fixture_id: fixtureId1, prediction: '1', points_awarded: 1, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() }, 
      ];

      // Expected payload for the RPC call (bets that need scoring)
      const expectedRpcPayload = [
          { bet_id: 'bet1', points: 1 },
          { bet_id: 'bet2', points: 0 },
          { bet_id: 'bet3', points: 0 },
          { bet_id: 'bet4', points: 1 },
      ];

      // --- Mock Client Setup (Refactored for RPC) --- 
      const mockRpc = jest.fn().mockResolvedValue({ error: null }); // Mock the RPC call itself
      const mockClient = { 
          from: jest.fn(), 
          rpc: mockRpc // Add the mocked rpc function
      } as unknown as SupabaseClient<Database>; 

      // Mock sequence of calls for from()
      (mockClient.from as jest.Mock)
          // 1. Fetch round status (betting_rounds)
          .mockImplementationOnce((tableName: string) => {
              if (tableName !== 'betting_rounds') throw new Error('Test Setup Error: Expected betting_rounds');
              return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValueOnce({ data: mockRoundClosed, error: null })
              };
          })
          // 2. Update round to 'scoring' (betting_rounds)
          .mockImplementationOnce((tableName: string) => {
              if (tableName !== 'betting_rounds') throw new Error('Test Setup Error: Expected betting_rounds update');
              return {
                  update: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValueOnce({ data: { status: 'scoring' }, error: null }) 
              };
          })
          // 3. Fetch fixture links (betting_round_fixtures)
          .mockImplementationOnce((tableName: string) => {
              if (tableName !== 'betting_round_fixtures') throw new Error('Test Setup Error: Expected betting_round_fixtures');
              return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockResolvedValueOnce({ data: mockLinks, error: null })
              };
          })
          // 4. Fetch fixtures (fixtures)
          .mockImplementationOnce((tableName: string) => {
               if (tableName !== 'fixtures') throw new Error('Test Setup Error: Expected fixtures');
              return {
                  select: jest.fn().mockReturnThis(),
                  in: jest.fn().mockResolvedValueOnce({ data: mockFixtures, error: null })
              };
          })
          // 5. Fetch user bets (user_bets)
          .mockImplementationOnce((tableName: string) => {
              if (tableName !== 'user_bets') throw new Error('Test Setup Error: Expected user_bets select');
              return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockResolvedValueOnce({ data: mockBets, error: null })
              };
          });
          
      // --- Act --- 
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // --- Assert --- 
      expect(result.success).toBe(true);
      expect(result.message).toContain("Scoring completed successfully");
      expect(result.details?.betsProcessed).toBe(5); // Processed all 5
      expect(result.details?.betsUpdated).toBe(4); // Sent 4 updates to RPC

      // Verify the RPC call
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('handle_round_scoring', {
          p_betting_round_id: bettingRoundId,
          p_bet_updates: expect.arrayContaining(expectedRpcPayload) // Check if the payload matches
          // Using arrayContaining because order might not be guaranteed depending on implementation
      });
      // Also check the length explicitly to ensure no extra bets were included
      expect(mockRpc.mock.calls[0][1].p_bet_updates).toHaveLength(expectedRpcPayload.length);

      // Verify the overall calls to .from() - reduced because updates are now in RPC
      // 1(round status) + 1(round update scoring) + 1(links) + 1(fixtures) + 1(bets select) = 5
      expect(mockClient.from).toHaveBeenCalledTimes(5);
      
  });

  // TODO: Refactor remaining tests using the Dependency Injection pattern
  it('should return early if the round is already scored', async () => {
      // Arrange
      const bettingRoundId = 102;
      const mockRoundScored: MockBettingRound = { 
        id: bettingRoundId, 
        status: 'scored', 
        name: 'BR 102', 
        competition_id: 1, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString(),
        earliest_fixture_kickoff: null,
        latest_fixture_kickoff: null,
        scored_at: new Date().toISOString() 
      }; 

      // --- Mock Client Setup ---
      const initialFetchSingleMock = jest.fn().mockResolvedValueOnce({ data: mockRoundScored, error: null });
      const initialFetchEqMock = jest.fn().mockReturnValueOnce({ single: initialFetchSingleMock });
      const initialFetchSelectMock = jest.fn().mockReturnValueOnce({ eq: initialFetchEqMock });

      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
            if (tableName === 'betting_rounds') {
                return { select: initialFetchSelectMock }; // Only need select().eq().single() for this path
            }
            // Should not call other tables
            throw new Error(`Unexpected table access in 'already scored' test: ${tableName}`);
          }),
      } as unknown as SupabaseClient<Database>;

      // --- Act --- 
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // --- Assert --- 
      expect(result.success).toBe(true); // Function returns success for already scored/scoring
      expect(result.message).toContain('Scoring skipped: Round already scored');
      expect(mockClient.from).toHaveBeenCalledTimes(1);
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(initialFetchSelectMock).toHaveBeenCalledTimes(1);
      expect(initialFetchEqMock).toHaveBeenCalledTimes(1);
      expect(initialFetchSingleMock).toHaveBeenCalledTimes(1);
  });
  
  it('should return early if the round is already being scored', async () => {
      // Arrange
      const bettingRoundId = 103;
      const mockRoundScoring: MockBettingRound = { 
        id: bettingRoundId, 
        status: 'scoring', // The key difference
        name: 'BR 103', 
        competition_id: 1, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString(),
        earliest_fixture_kickoff: null,
        latest_fixture_kickoff: null,
        scored_at: null 
      }; 

      // --- Mock Client Setup ---
      const initialFetchSingleMock = jest.fn().mockResolvedValueOnce({ data: mockRoundScoring, error: null });
      const initialFetchEqMock = jest.fn().mockReturnValueOnce({ single: initialFetchSingleMock });
      const initialFetchSelectMock = jest.fn().mockReturnValueOnce({ eq: initialFetchEqMock });

      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
            if (tableName === 'betting_rounds') {
                return { select: initialFetchSelectMock };
            }
            throw new Error(`Unexpected table access in 'already scoring' test: ${tableName}`);
          }),
      } as unknown as SupabaseClient<Database>;

      // --- Act --- 
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // --- Assert --- 
      expect(result.success).toBe(true); // Function returns success for already scored/scoring
      expect(result.message).toContain('Scoring skipped: Round already scoring');
      expect(mockClient.from).toHaveBeenCalledTimes(1);
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(initialFetchSelectMock).toHaveBeenCalledTimes(1);
      expect(initialFetchEqMock).toHaveBeenCalledTimes(1);
      expect(initialFetchSingleMock).toHaveBeenCalledTimes(1);
  });

  // ... Keep other it.todo placeholders ...
  // ... etc

  // Refactored tests using dependency injection pattern:
  it('should return an error if the betting round is not found', async () => {
      // Arrange
      const bettingRoundId = 104;
      
      // Create a mock client that returns null for the betting round
      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
              if (tableName === 'betting_rounds') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              single: jest.fn().mockResolvedValue({ data: null, error: null })
                          })
                      })
                  };
              }
              // We don't expect other tables to be accessed in this test
              return {
                  select: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                          single: jest.fn().mockResolvedValue({ data: null, error: null })
                      })
                  })
              };
          })
      } as unknown as SupabaseClient<Database>;

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe(`Betting round with ID ${bettingRoundId} not found.`);
      expect(mockClient.from).toHaveBeenCalledTimes(1); // Only initial fetch
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
  });

  it('should return an error if fetching the betting round fails', async () => {
      // Arrange
      const bettingRoundId = 105;
      const mockError = { message: 'Database connection failed', code: 'DB500' };
      
      // Create a mock client that returns an error for the betting round
      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
              if (tableName === 'betting_rounds') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              single: jest.fn().mockResolvedValue({ data: null, error: mockError })
                          })
                      })
                  };
              }
              // We don't expect other tables to be accessed in this test
              return {
                  select: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                          single: jest.fn().mockResolvedValue({ data: null, error: null })
                      })
                  })
              };
          })
      } as unknown as SupabaseClient<Database>;

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Failed to fetch betting round status.");
      expect(mockClient.from).toHaveBeenCalledTimes(1);
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
  });

  it('should handle rounds with no linked fixtures correctly', async () => {
      // Arrange
      const bettingRoundId = 106;
      const mockRoundClosed: MockBettingRound = {
          id: bettingRoundId,
          status: 'closed',
          name: 'BR 106',
          competition_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          earliest_fixture_kickoff: null,
          latest_fixture_kickoff: null,
          scored_at: null
      };
      const mockLinks: MockBettingRoundFixture[] = []; // No links

      // Create a mock client that returns empty fixture links
      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
              if (tableName === 'betting_rounds') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              single: jest.fn().mockResolvedValue({ data: mockRoundClosed, error: null })
                          })
                      }),
                      update: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              select: jest.fn().mockReturnValue({
                                  single: jest.fn().mockResolvedValue({ data: { status: 'scoring' }, error: null })
                              })
                          })
                      })
                  };
              } else if (tableName === 'betting_round_fixtures') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null })
                      })
                  };
              }
              // Default mock for other tables
              return {
                  select: jest.fn().mockReturnValue({
                      eq: jest.fn().mockResolvedValue({ data: [], error: null })
                  })
              };
          })
      } as unknown as SupabaseClient<Database>;

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("No fixtures linked to this round; marked as scored");
      expect(result.details?.betsProcessed).toBe(0);
      expect(result.details?.betsUpdated).toBe(0);
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
  });

  it('should return early if not all fixtures are finished', async () => {
      // Arrange
      const bettingRoundId = 107;
      const mockRoundClosed: MockBettingRound = {
          id: bettingRoundId,
          status: 'closed',
          name: 'BR 107',
          competition_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          earliest_fixture_kickoff: null,
          latest_fixture_kickoff: null,
          scored_at: null
      };
      const mockLinks: MockBettingRoundFixture[] = [
          { betting_round_id: bettingRoundId, fixture_id: 1001, created_at: new Date().toISOString() },
          { betting_round_id: bettingRoundId, fixture_id: 1002, created_at: new Date().toISOString() },
      ];
      const mockFixtures: Partial<MockFixture>[] = [
          { id: 1001, status_short: 'FT', home_goals: 2, away_goals: 1, result: '1' },
          { id: 1002, status_short: 'NS', home_goals: null, away_goals: null, result: null },
      ];

      // Create a mock client that returns fixtures with one not finished
      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
              if (tableName === 'betting_rounds') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              single: jest.fn().mockResolvedValue({ data: mockRoundClosed, error: null })
                          })
                      }),
                      update: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              select: jest.fn().mockReturnValue({
                                  single: jest.fn().mockResolvedValue({ data: { status: 'scoring' }, error: null })
                              })
                          })
                      })
                  };
              } else if (tableName === 'betting_round_fixtures') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null })
                      })
                  };
              } else if (tableName === 'fixtures') {
                  return {
                      select: jest.fn().mockReturnValue({
                          in: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
                      })
                  };
              }
              // Default mock for other tables
              return {
                  select: jest.fn().mockReturnValue({
                      eq: jest.fn().mockResolvedValue({ data: [], error: null })
                  })
              };
          })
      } as unknown as SupabaseClient<Database>;

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(true); // The implementation returns success: true with a message about deferring
      expect(result.message).toContain("Scoring deferred: Not all fixtures finished");
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(mockClient.from).toHaveBeenCalledWith('fixtures');
  });

  it('should handle rounds with no user bets correctly', async () => {
      // Arrange
      const bettingRoundId = 108;
      const mockRoundClosed: MockBettingRound = {
          id: bettingRoundId,
          status: 'closed',
          name: 'BR 108',
          competition_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          earliest_fixture_kickoff: null,
          latest_fixture_kickoff: null,
          scored_at: null
      };
      const mockLinks: MockBettingRoundFixture[] = [
          { betting_round_id: bettingRoundId, fixture_id: 1003, created_at: new Date().toISOString() },
      ];
      const mockFixtures: Partial<MockFixture>[] = [
          { id: 1003, status_short: 'FT', home_goals: 3, away_goals: 0, result: '1' },
      ];
      const mockBets: MockUserBet[] = []; // No bets

      // Create a mock client that returns empty user bets
      const mockClient = {
          from: jest.fn().mockImplementation((tableName: string) => {
              if (tableName === 'betting_rounds') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              single: jest.fn().mockResolvedValue({ data: mockRoundClosed, error: null })
                          })
                      }),
                      update: jest.fn().mockReturnValue({
                          eq: jest.fn().mockReturnValue({
                              select: jest.fn().mockReturnValue({
                                  single: jest.fn().mockResolvedValue({ data: { status: 'scoring' }, error: null })
                              })
                          })
                      })
                  };
              } else if (tableName === 'betting_round_fixtures') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null })
                      })
                  };
              } else if (tableName === 'fixtures') {
                  return {
                      select: jest.fn().mockReturnValue({
                          in: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
                      })
                  };
              } else if (tableName === 'user_bets') {
                  return {
                      select: jest.fn().mockReturnValue({
                          eq: jest.fn().mockResolvedValue({ data: mockBets, error: null })
                      }),
                      upsert: jest.fn().mockResolvedValue({ error: null })
                  };
              }
              // Default mock for other tables
              return {
                  select: jest.fn().mockReturnValue({
                      eq: jest.fn().mockResolvedValue({ data: [], error: null })
                  })
              };
          })
      } as unknown as SupabaseClient<Database>;

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('No user bets for this round; marked as scored');
      expect(result.details?.betsProcessed).toBe(0);
      expect(result.details?.betsUpdated).toBe(0);
      expect(mockClient.from).toHaveBeenCalledWith('betting_rounds');
      expect(mockClient.from).toHaveBeenCalledWith('betting_round_fixtures');
      expect(mockClient.from).toHaveBeenCalledWith('fixtures');
      expect(mockClient.from).toHaveBeenCalledWith('user_bets');
  });

  it('should handle errors during the RPC call', async () => {
      // Arrange
      const bettingRoundId = 199;
      const mockRpcError = { message: 'Database error during RPC', code: 'DB999' };
      // ... (Setup mock data similar to the first test: round, links, fixtures, bets) ...
      const mockRoundClosed: MockBettingRound = { id: bettingRoundId, status: 'closed', name: 'BR 199', competition_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), earliest_fixture_kickoff: null, latest_fixture_kickoff: null, scored_at: null };
      const mockLinks: MockBettingRoundFixture[] = [{ betting_round_id: bettingRoundId, fixture_id: 299, created_at: new Date().toISOString() }];
      const mockFixtures: Partial<MockFixture>[] = [{ id: 299, home_goals: 1, away_goals: 1, status_short: 'FT', result: 'X' }];
      const mockBets: MockUserBet[] = [{ id: 'bet99', user_id: 'user99', betting_round_id: bettingRoundId, fixture_id: 299, prediction: 'X', points_awarded: null, created_at: new Date().toISOString(), submitted_at: new Date().toISOString() }];

      const mockRpc = jest.fn().mockResolvedValue({ error: mockRpcError }); // Mock RPC to return an error
      const mockClient = { 
          from: jest.fn(), 
          rpc: mockRpc
      } as unknown as SupabaseClient<Database>;

      // Mock the .from() calls needed to reach the RPC step
      (mockClient.from as jest.Mock)
          .mockImplementationOnce(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValueOnce({ data: mockRoundClosed, error: null }) })) // Fetch round
          .mockImplementationOnce(() => ({ update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValueOnce({ data: { status: 'scoring' }, error: null }) })) // Update round to scoring
          .mockImplementationOnce(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValueOnce({ data: mockLinks, error: null }) })) // Fetch links
          .mockImplementationOnce(() => ({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: mockFixtures, error: null }) })) // Fetch fixtures
          .mockImplementationOnce(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValueOnce({ data: mockBets, error: null }) })); // Fetch bets

      // Act
      const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to store scores transactionally via RPC function.");
      expect(result.details?.error).toEqual(mockRpcError);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockClient.from).toHaveBeenCalledTimes(5);
  });

  // TODO: Review and potentially refactor other tests that mock the update/upsert calls
  // For example, the test 'should handle errors during user_bets upsert' needs to be changed
  // to mock an error from the RPC call instead.
  // The test 'should handle errors during the final status update' might become irrelevant
  // or needs rethinking as the RPC handles the final status update.

  // Keep existing tests for early exits (already scored, scoring, no fixtures, no bets, not all finished)
  // as they don't reach the RPC call and their mocking should still be valid.
});