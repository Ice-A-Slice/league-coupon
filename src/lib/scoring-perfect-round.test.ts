// src/lib/scoring-perfect-round.test.ts
// Tests specifically for perfect round bonus functionality

import type { Database } from '@/types/supabase';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type MockFixture = Database['public']['Tables']['fixtures']['Row'];
type MockUserBet = Database['public']['Tables']['user_bets']['Row'];
type MockFixtureLink = Database['public']['Tables']['betting_round_fixtures']['Row'];

// Type for bet update objects used in RPC calls
interface BetUpdate {
  bet_id: string;
  points: number;
}

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the LeagueDataService
jest.mock('./leagueDataService', () => ({
  LeagueDataServiceImpl: jest.fn().mockImplementation(() => ({
    getCurrentSeasonId: jest.fn().mockResolvedValue(123),
  })),
}));

// Mock DynamicPointsCalculator
jest.mock('@/lib/dynamicPointsCalculator', () => ({
  DynamicPointsCalculator: jest.fn().mockImplementation(() => ({
    calculateDynamicPoints: jest.fn().mockResolvedValue({
      totalPoints: 0,
      details: {},
    }),
  })),
}));

// Mock getUserSeasonAnswers function
jest.mock('./supabase/queries', () => ({
  getUserSeasonAnswers: jest.fn().mockResolvedValue([]),
}));

// Helper function to create mock Supabase query builder
function createMockSupabaseClient() {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };

  return {
    from: jest.fn().mockReturnValue(mockBuilder),
    rpc: jest.fn(),
  };
}

describe('Perfect Round Bonus - Scoring Logic', () => {
  let mockClient: {
    from: jest.Mock;
    rpc: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  it('should apply perfect round bonus in regular rounds when all predictions are correct', async () => {
    const bettingRoundId = 101;
    const mockFixtureLinks: Pick<MockFixtureLink, 'fixture_id'>[] = [
      { fixture_id: 1 },
      { fixture_id: 2 },
      { fixture_id: 3 }
    ];
    
    const mockFixturesData: Partial<MockFixture>[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' },
      { id: 2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' },
      { id: 3, home_goals: 1, away_goals: 3, status_short: 'FT', result: '2' }
    ];
    
    const mockUserBets: Partial<MockUserBet>[] = [
      // User 1 - Perfect round (all 3 correct)
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet2', user_id: 'user1', fixture_id: 2, prediction: 'X', points_awarded: null },
      { id: 'bet3', user_id: 'user1', fixture_id: 3, prediction: '2', points_awarded: null },
      // User 2 - Not perfect (2 out of 3 correct)
      { id: 'bet4', user_id: 'user2', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet5', user_id: 'user2', fixture_id: 2, prediction: '1', points_awarded: null }, // Wrong
      { id: 'bet6', user_id: 'user2', fixture_id: 3, prediction: '2', points_awarded: null },
    ];

    // Track RPC calls to verify point calculation
    const rpcCalls: Array<{ funcName: string; params: unknown }> = [];
    (mockClient.rpc as jest.Mock).mockImplementation((funcName: string, params: unknown) => {
      rpcCalls.push({ funcName, params });
      return Promise.resolve({ error: null });
    });

    mockClient.from.mockImplementation((tableName: string) => {
      const builder = createMockSupabaseClient().from();
      
      if (tableName === 'betting_round_fixtures') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockFixtureLinks, error: null });
      } else if (tableName === 'fixtures') {
        (builder.in as jest.Mock).mockResolvedValue({ data: mockFixturesData, error: null });
      } else if (tableName === 'user_bets') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockUserBets, error: null });
      } else if (tableName === 'betting_rounds') {
        // Regular round (not bonus)
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { is_bonus_round: false, competition_id: 1 }, 
          error: null 
        });
      } else if (tableName === 'seasons') {
        // No global bonus mode active
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { bonus_mode_active: false }, 
          error: null 
        });
      } else if (tableName === 'betting_round_fixtures') {
        // For dynamic points processing - mock fixture data
        (builder.select as jest.Mock).mockReturnValue(builder);
        (builder.eq as jest.Mock).mockReturnValue(builder);
        (builder.limit as jest.Mock).mockReturnValue(builder);
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { 
            fixtures: { 
              rounds: { 
                season_id: 1, 
                seasons: { competition_id: 1 } 
              } 
            } 
          }, 
          error: null 
        });
      } else if (tableName === 'competitions') {
        // Mock competition data for dynamic points
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { id: 1, name: 'Test Competition' }, 
          error: null 
        });
      }
      
      return builder;
    });

    const { calculateAndStoreMatchPoints } = await import('./scoring');
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

    // The core match points scoring should work correctly (dynamic points may fail due to mocking)
    expect(result.details?.betsProcessed).toBe(6);
    expect(result.details?.betsUpdated).toBe(6);
    
    // Verify RPC was called with correct bet updates
    expect(mockClient.rpc).toHaveBeenCalledWith('handle_round_scoring', {
      p_betting_round_id: bettingRoundId,
      p_bet_updates: expect.any(Array),
    });
    
    // Get the actual bet updates from the RPC call
    const rpcCall = mockClient.rpc.mock.calls[0];
    const betUpdates = rpcCall[1].p_bet_updates;
    
    // User 1 should get 6 points (3 correct × 2 perfect round bonus)
    const user1Updates = betUpdates.filter((update: BetUpdate) => 
      ['bet1', 'bet2', 'bet3'].includes(update.bet_id)
    );
    expect(user1Updates).toHaveLength(3);
    user1Updates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(2); // 1 base point × 2 perfect round multiplier
    });

    // User 2 should get 2 points (2 correct × 1 no bonus)
    const user2Updates = betUpdates.filter((update: BetUpdate) => 
      ['bet4', 'bet5', 'bet6'].includes(update.bet_id)
    );
    expect(user2Updates).toHaveLength(3);
    
    // User 2 correct predictions should get 1 point each (no bonus)
    const user2CorrectUpdates = user2Updates.filter((update: BetUpdate) => 
      ['bet4', 'bet6'].includes(update.bet_id)
    );
    user2CorrectUpdates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(1); // 1 base point × 1 no bonus
    });
    
    // User 2 incorrect prediction should get 0 points
    const user2IncorrectUpdate = user2Updates.find((update: BetUpdate) => 
      update.bet_id === 'bet5'
    );
    expect(user2IncorrectUpdate?.points).toBe(0);
  });

  it('should NOT apply perfect round bonus in bonus rounds (preserve existing 2x multiplier)', async () => {
    const bettingRoundId = 102;
    const mockFixtureLinks: Pick<MockFixtureLink, 'fixture_id'>[] = [
      { fixture_id: 1 },
      { fixture_id: 2 }
    ];
    
    const mockFixturesData: Partial<MockFixture>[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' },
      { id: 2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' }
    ];
    
    const mockUserBets: Partial<MockUserBet>[] = [
      // User gets all predictions correct in bonus round
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet2', user_id: 'user1', fixture_id: 2, prediction: 'X', points_awarded: null },
    ];

    const rpcCalls: Array<{ funcName: string; params: unknown }> = [];
    (mockClient.rpc as jest.Mock).mockImplementation((funcName: string, params: unknown) => {
      rpcCalls.push({ funcName, params });
      return Promise.resolve({ error: null });
    });

    mockClient.from.mockImplementation((tableName: string) => {
      const builder = createMockSupabaseClient().from();
      
      if (tableName === 'betting_round_fixtures') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockFixtureLinks, error: null });
      } else if (tableName === 'fixtures') {
        (builder.in as jest.Mock).mockResolvedValue({ data: mockFixturesData, error: null });
      } else if (tableName === 'user_bets') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockUserBets, error: null });
      } else if (tableName === 'betting_rounds') {
        // Bonus round
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { is_bonus_round: true, competition_id: 1 }, 
          error: null 
        });
      } else if (tableName === 'seasons') {
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { bonus_mode_active: false }, 
          error: null 
        });
      }
      
      return builder;
    });

    const { calculateAndStoreMatchPoints } = await import('./scoring');
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

    expect(result.details?.betsProcessed).toBe(2);
    expect(result.details?.betsUpdated).toBe(2);
    
    // Get the actual bet updates from the RPC call
    const rpcCall = mockClient.rpc.mock.calls[0];
    const betUpdates = rpcCall[1].p_bet_updates;
    expect(betUpdates).toHaveLength(2);
    
    betUpdates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(2); // 1 base point × 2 bonus round multiplier (NO perfect round bonus)
    });
  });

  it('should handle global season bonus mode same as individual bonus rounds', async () => {
    const bettingRoundId = 103;
    const mockFixtureLinks: Pick<MockFixtureLink, 'fixture_id'>[] = [
      { fixture_id: 1 },
      { fixture_id: 2 }
    ];
    
    const mockFixturesData: Partial<MockFixture>[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' },
      { id: 2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' }
    ];
    
    const mockUserBets: Partial<MockUserBet>[] = [
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet2', user_id: 'user1', fixture_id: 2, prediction: 'X', points_awarded: null },
    ];

    const rpcCalls: Array<{ funcName: string; params: unknown }> = [];
    (mockClient.rpc as jest.Mock).mockImplementation((funcName: string, params: unknown) => {
      rpcCalls.push({ funcName, params });
      return Promise.resolve({ error: null });
    });

    mockClient.from.mockImplementation((tableName: string) => {
      const builder = createMockSupabaseClient().from();
      
      if (tableName === 'betting_round_fixtures') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockFixtureLinks, error: null });
      } else if (tableName === 'fixtures') {
        (builder.in as jest.Mock).mockResolvedValue({ data: mockFixturesData, error: null });
      } else if (tableName === 'user_bets') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockUserBets, error: null });
      } else if (tableName === 'betting_rounds') {
        // Regular round
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { is_bonus_round: false, competition_id: 1 }, 
          error: null 
        });
      } else if (tableName === 'seasons') {
        // Global bonus mode active
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { bonus_mode_active: true }, 
          error: null 
        });
      }
      
      return builder;
    });

    const { calculateAndStoreMatchPoints } = await import('./scoring');
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

    expect(result.details?.betsProcessed).toBe(2);
    expect(result.details?.betsUpdated).toBe(2);
    
    // Get the actual bet updates from the RPC call
    const rpcCall = mockClient.rpc.mock.calls[0];
    const betUpdates = rpcCall[1].p_bet_updates;
    betUpdates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(2); // 1 base × 2 global bonus (NO perfect round bonus)
    });
  });

  it('should handle partial participation correctly with perfect round bonus', async () => {
    const bettingRoundId = 104;
    const mockFixtureLinks: Pick<MockFixtureLink, 'fixture_id'>[] = [
      { fixture_id: 1 },
      { fixture_id: 2 },
      { fixture_id: 3 }
    ];
    
    const mockFixturesData: Partial<MockFixture>[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' },
      { id: 2, home_goals: 0, away_goals: 0, status_short: 'FT', result: 'X' },
      { id: 3, home_goals: 1, away_goals: 3, status_short: 'FT', result: '2' }
    ];
    
    const mockUserBets: Partial<MockUserBet>[] = [
      // User 1 - Only bet on 2 games and got both correct (should get perfect round bonus)
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet2', user_id: 'user1', fixture_id: 2, prediction: 'X', points_awarded: null },
      // User 1 did NOT bet on fixture 3
      
      // User 2 - Bet on all 3 games but got 1 wrong (no perfect round bonus)
      { id: 'bet3', user_id: 'user2', fixture_id: 1, prediction: '1', points_awarded: null },
      { id: 'bet4', user_id: 'user2', fixture_id: 2, prediction: '1', points_awarded: null }, // Wrong
      { id: 'bet5', user_id: 'user2', fixture_id: 3, prediction: '2', points_awarded: null },
    ];

    const rpcCalls: Array<{ funcName: string; params: unknown }> = [];
    (mockClient.rpc as jest.Mock).mockImplementation((funcName: string, params: unknown) => {
      rpcCalls.push({ funcName, params });
      return Promise.resolve({ error: null });
    });

    mockClient.from.mockImplementation((tableName: string) => {
      const builder = createMockSupabaseClient().from();
      
      if (tableName === 'betting_round_fixtures') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockFixtureLinks, error: null });
      } else if (tableName === 'fixtures') {
        (builder.in as jest.Mock).mockResolvedValue({ data: mockFixturesData, error: null });
      } else if (tableName === 'user_bets') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockUserBets, error: null });
      } else if (tableName === 'betting_rounds') {
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { is_bonus_round: false, competition_id: 1 }, 
          error: null 
        });
      } else if (tableName === 'seasons') {
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { bonus_mode_active: false }, 
          error: null 
        });
      }
      
      return builder;
    });

    const { calculateAndStoreMatchPoints } = await import('./scoring');
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

    expect(result.details?.betsProcessed).toBe(5);
    expect(result.details?.betsUpdated).toBe(5);
    
    // Get the actual bet updates from the RPC call
    const rpcCall = mockClient.rpc.mock.calls[0];
    const betUpdates = rpcCall[1].p_bet_updates;
    
    // User 1 should get perfect round bonus (2 bets, both correct = perfect for their participation)
    const user1Updates = betUpdates.filter((update: BetUpdate) => 
      ['bet1', 'bet2'].includes(update.bet_id)
    );
    user1Updates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(2); // 1 base × 2 perfect round multiplier
    });

    // User 2 should NOT get perfect round bonus
    const user2CorrectUpdates = betUpdates.filter((update: BetUpdate) => 
      ['bet3', 'bet5'].includes(update.bet_id)
    );
    user2CorrectUpdates.forEach((update: BetUpdate) => {
      expect(update.points).toBe(1); // 1 base × 1 no bonus
    });
    
    const user2IncorrectUpdate = betUpdates.find((update: BetUpdate) => 
      update.bet_id === 'bet4'
    );
    expect(user2IncorrectUpdate?.points).toBe(0);
  });

  it('should handle single game rounds with perfect round bonus', async () => {
    const bettingRoundId = 105;
    const mockFixtureLinks: Pick<MockFixtureLink, 'fixture_id'>[] = [
      { fixture_id: 1 }
    ];
    
    const mockFixturesData: Partial<MockFixture>[] = [
      { id: 1, home_goals: 2, away_goals: 1, status_short: 'FT', result: '1' }
    ];
    
    const mockUserBets: Partial<MockUserBet>[] = [
      // Single game, correct prediction - should get perfect round bonus
      { id: 'bet1', user_id: 'user1', fixture_id: 1, prediction: '1', points_awarded: null },
    ];

    const rpcCalls: Array<{ funcName: string; params: unknown }> = [];
    (mockClient.rpc as jest.Mock).mockImplementation((funcName: string, params: unknown) => {
      rpcCalls.push({ funcName, params });
      return Promise.resolve({ error: null });
    });

    mockClient.from.mockImplementation((tableName: string) => {
      const builder = createMockSupabaseClient().from();
      
      if (tableName === 'betting_round_fixtures') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockFixtureLinks, error: null });
      } else if (tableName === 'fixtures') {
        (builder.in as jest.Mock).mockResolvedValue({ data: mockFixturesData, error: null });
      } else if (tableName === 'user_bets') {
        (builder.eq as jest.Mock).mockResolvedValue({ data: mockUserBets, error: null });
      } else if (tableName === 'betting_rounds') {
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { is_bonus_round: false, competition_id: 1 }, 
          error: null 
        });
      } else if (tableName === 'seasons') {
        (builder.single as jest.Mock).mockResolvedValue({ 
          data: { bonus_mode_active: false }, 
          error: null 
        });
      }
      
      return builder;
    });

    const { calculateAndStoreMatchPoints } = await import('./scoring');
    const result = await calculateAndStoreMatchPoints(bettingRoundId, mockClient);

    expect(result.details?.betsProcessed).toBe(1);
    expect(result.details?.betsUpdated).toBe(1);
    
    // Get the actual bet updates from the RPC call
    const rpcCall = mockClient.rpc.mock.calls[0];
    const betUpdates = rpcCall[1].p_bet_updates;
    expect(betUpdates).toHaveLength(1);
    expect(betUpdates[0].points).toBe(2); // 1 base × 2 perfect round multiplier
  });
});