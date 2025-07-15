import { CupWinnerDeterminationService } from '../cupWinnerDeterminationService';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase service
jest.mock('@/utils/supabase/service', () => ({
  getSupabaseServiceRoleClient: jest.fn(),
}));

// Create mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
} as unknown as SupabaseClient<Database>;

describe.skip('CupWinnerDeterminationService', () => {
  let service: CupWinnerDeterminationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CupWinnerDeterminationService(mockSupabaseClient);
  });

  // Helper function to create mock query chain that resolves with data
  const createMockQueryChain = (resolveValue: unknown) => {
    const mockChain = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      single: jest.fn(),
      upsert: jest.fn(),
      not: jest.fn(),
    };

    // Set up chaining - each method returns the chain object
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.single.mockReturnValue(mockChain);
    mockChain.upsert.mockReturnValue(mockChain);
    mockChain.not.mockReturnValue(mockChain);

    // The final method in the chain should resolve with the provided value
    // We'll set up multiple methods to resolve so any can be the final one
    mockChain.eq.mockResolvedValue(resolveValue);
    mockChain.order.mockResolvedValue(resolveValue);
    mockChain.single.mockResolvedValue(resolveValue);
    mockChain.upsert.mockResolvedValue(resolveValue);

    return mockChain;
  };

  describe('calculateCupStandings (Subtask 1)', () => {
    const seasonId = 1;

    it('should calculate standings with proper ranking and tie handling', async () => {
      const mockCupPointsData = [
        // User 1: 30 points (2 rounds)
        { user_id: 'user1', points: 15, betting_round_id: 1, profiles: { full_name: 'Alice' } },
        { user_id: 'user1', points: 15, betting_round_id: 2, profiles: { full_name: 'Alice' } },
        // User 2: 25 points (2 rounds) 
        { user_id: 'user2', points: 10, betting_round_id: 1, profiles: { full_name: 'Bob' } },
        { user_id: 'user2', points: 15, betting_round_id: 2, profiles: { full_name: 'Bob' } },
        // User 3: 25 points (1 round) - tied with User 2
        { user_id: 'user3', points: 25, betting_round_id: 2, profiles: { full_name: 'Charlie' } },
        // User 4: 10 points (1 round)
        { user_id: 'user4', points: 10, betting_round_id: 1, profiles: { full_name: 'Diana' } },
      ];

      const mockChain = createMockQueryChain({
        data: mockCupPointsData,
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.totalParticipants).toBe(4);
      expect(result.maxPoints).toBe(30);
      expect(result.averagePoints).toBe(22.5); // (30+25+25+10)/4

      // Check standings order and ranking
      expect(result.standings).toHaveLength(4);
      
      // User 1 should be rank 1 (30 points)
      expect(result.standings[0]).toEqual({
        user_id: 'user1',
        username: 'Alice',
        total_points: 30,
        rounds_participated: 2,
        rank: 1,
        is_tied: false
      });

      // Users 2 and 3 should be tied at rank 2 (25 points each)
      const tiedUsers = result.standings.filter(s => s.rank === 2);
      expect(tiedUsers).toHaveLength(2);
      expect(tiedUsers.every(u => u.total_points === 25)).toBe(true);
      expect(tiedUsers.every(u => u.is_tied === true)).toBe(true);

      // User 4 should be rank 4 (10 points)
      const user4 = result.standings.find(s => s.user_id === 'user4');
      expect(user4).toEqual({
        user_id: 'user4',
        username: 'Diana',
        total_points: 10,
        rounds_participated: 1,
        rank: 4,
        is_tied: false
      });
    });

    it('should handle no participants scenario', async () => {
      const mockChain = createMockQueryChain({
        data: [],
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.standings).toHaveLength(0);
      expect(result.totalParticipants).toBe(0);
      expect(result.maxPoints).toBe(0);
      expect(result.averagePoints).toBe(0);
    });

    it('should handle database error', async () => {
      const dbError = { message: 'Database connection error' };
      const mockChain = createMockQueryChain({
        data: null,
        error: dbError
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Database connection error');
      expect(result.standings).toHaveLength(0);
    });

    it('should handle null points values', async () => {
      const mockDataWithNulls = [
        { user_id: 'user1', points: null, betting_round_id: 1, profiles: { full_name: 'Alice' } },
        { user_id: 'user1', points: 15, betting_round_id: 2, profiles: { full_name: 'Alice' } },
      ];

      const mockChain = createMockQueryChain({
        data: mockDataWithNulls,
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.standings[0].total_points).toBe(15); // null treated as 0
    });

    it('should handle missing profile information', async () => {
      const mockDataWithoutProfiles = [
        { user_id: 'user1', points: 15, betting_round_id: 1, profiles: null },
      ];

      const mockChain = createMockQueryChain({
        data: mockDataWithoutProfiles,
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.standings[0].username).toBeUndefined();
    });

    it('should sort users with same points consistently by username', async () => {
      const mockTiedData = [
        { user_id: 'user2', points: 20, betting_round_id: 1, profiles: { full_name: 'Zoe' } },
        { user_id: 'user1', points: 20, betting_round_id: 1, profiles: { full_name: 'Alice' } },
      ];

      const mockChain = createMockQueryChain({
        data: mockTiedData,
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.calculateCupStandings(seasonId);

      expect(result.standings[0].username).toBe('Alice'); // Alphabetically first
      expect(result.standings[1].username).toBe('Zoe');
      expect(result.standings.every(s => s.is_tied === true)).toBe(true);
    });
  });

  describe('identifyWinners (Subtask 2)', () => {
    it('should identify single winner correctly', () => {
      const standings = [
        { user_id: 'user1', username: 'Alice', total_points: 30, rounds_participated: 2, rank: 1, is_tied: false },
        { user_id: 'user2', username: 'Bob', total_points: 25, rounds_participated: 2, rank: 2, is_tied: false },
      ];

      const winners = service.identifyWinners(standings);

      expect(winners).toHaveLength(1);
      expect(winners[0].user_id).toBe('user1');
      expect(winners[0].total_points).toBe(30);
      expect(winners[0].is_tied).toBe(false);
    });

    it('should identify multiple tied winners', () => {
      const standings = [
        { user_id: 'user1', username: 'Alice', total_points: 25, rounds_participated: 2, rank: 1, is_tied: true },
        { user_id: 'user2', username: 'Bob', total_points: 25, rounds_participated: 2, rank: 1, is_tied: true },
        { user_id: 'user3', username: 'Charlie', total_points: 20, rounds_participated: 2, rank: 3, is_tied: false },
      ];

      const winners = service.identifyWinners(standings);

      expect(winners).toHaveLength(2);
      expect(winners.every(w => w.rank === 1)).toBe(true);
      expect(winners.every(w => w.total_points === 25)).toBe(true);
      expect(winners.every(w => w.is_tied === true)).toBe(true);
    });

    it('should handle empty standings', () => {
      const winners = service.identifyWinners([]);
      expect(winners).toHaveLength(0);
    });

    it('should handle standings with no rank 1 users', () => {
      const standings = [
        { user_id: 'user1', username: 'Alice', total_points: 25, rounds_participated: 2, rank: 2, is_tied: false },
      ];

      const winners = service.identifyWinners(standings);
      expect(winners).toHaveLength(0);
    });

    it('should respect numberOfWinners parameter but include all tied users', () => {
      const standings = [
        { user_id: 'user1', username: 'Alice', total_points: 25, rounds_participated: 2, rank: 1, is_tied: true },
        { user_id: 'user2', username: 'Bob', total_points: 25, rounds_participated: 2, rank: 1, is_tied: true },
        { user_id: 'user3', username: 'Charlie', total_points: 25, rounds_participated: 2, rank: 1, is_tied: true },
      ];

      // Even if we request only 1 winner, all tied users should be included
      const winners = service.identifyWinners(standings, 1);
      expect(winners).toHaveLength(3); // All 3 tied users included
    });
  });

  describe('determineCupWinners (Subtasks 3 & 4)', () => {
    const seasonId = 1;

    it('should return existing winners if already determined (idempotency)', async () => {
      const existingWinners = [
        { user_id: 'user1', total_points: 120, profiles: { full_name: 'John' } }
      ];
      
      // Mock getExistingCupWinners
      const mockChain = createMockQueryChain({
        data: existingWinners,
        error: null
      });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.determineCupWinners(seasonId);

      expect(result.isAlreadyDetermined).toBe(true);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].user_id).toBe('user1');
      expect(result.winners[0].username).toBe('John');
      expect(result.errors).toHaveLength(0);
    });

    it('should determine new winners successfully', async () => {
      // Set up multiple mock calls in sequence
      const fromCalls = [
        // First call: getExistingCupWinners (no existing winners)
        createMockQueryChain({ data: [], error: null }),
        // Second call: calculateCupStandings data
        createMockQueryChain({
          data: [
            { user_id: 'user1', points: 30, betting_round_id: 1, profiles: { full_name: 'Alice' } },
            { user_id: 'user2', points: 25, betting_round_id: 1, profiles: { full_name: 'Bob' } },
          ],
          error: null
        }),
        // Third call: season lookup for recording winners
        createMockQueryChain({ data: { competition_id: 1 }, error: null }),
        // Fourth call: upsert for recording winners
        createMockQueryChain({ error: null }),
      ];

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(fromCalls[0])
        .mockReturnValueOnce(fromCalls[1])
        .mockReturnValueOnce(fromCalls[2])
        .mockReturnValueOnce(fromCalls[3]);

      const result = await service.determineCupWinners(seasonId);

      expect(result.isAlreadyDetermined).toBe(false);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].user_id).toBe('user1');
      expect(result.winners[0].total_points).toBe(30);
      expect(result.totalParticipants).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle no participants scenario (edge case)', async () => {
      const fromCalls = [
        // First call: getExistingCupWinners (no existing winners)
        createMockQueryChain({ data: [], error: null }),
        // Second call: calculateCupStandings (no participants)
        createMockQueryChain({ data: [], error: null }),
      ];

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(fromCalls[0])
        .mockReturnValueOnce(fromCalls[1]);

      const result = await service.determineCupWinners(seasonId);

      expect(result.isAlreadyDetermined).toBe(false);
      expect(result.winners).toHaveLength(0);
      expect(result.totalParticipants).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle database error during winner recording', async () => {
      const fromCalls = [
        // First call: getExistingCupWinners (no existing winners)
        createMockQueryChain({ data: [], error: null }),
        // Second call: calculateCupStandings data
        createMockQueryChain({
          data: [
            { user_id: 'user1', points: 30, betting_round_id: 1, profiles: { full_name: 'Alice' } },
          ],
          error: null
        }),
        // Third call: season lookup failure
        createMockQueryChain({ data: null, error: { message: 'Season not found' } }),
      ];

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(fromCalls[0])
        .mockReturnValueOnce(fromCalls[1])
        .mockReturnValueOnce(fromCalls[2]);

      const result = await service.determineCupWinners(seasonId);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Season not found');
    });

    it('should handle all zero scores scenario (edge case)', async () => {
      const fromCalls = [
        // First call: getExistingCupWinners (no existing winners)
        createMockQueryChain({ data: [], error: null }),
        // Second call: calculateCupStandings with all zero scores
        createMockQueryChain({
          data: [
            { user_id: 'user1', points: 0, betting_round_id: 1, profiles: { full_name: 'Alice' } },
            { user_id: 'user2', points: 0, betting_round_id: 1, profiles: { full_name: 'Bob' } },
          ],
          error: null
        }),
        // Third call: season lookup
        createMockQueryChain({ data: { competition_id: 1 }, error: null }),
        // Fourth call: upsert
        createMockQueryChain({ error: null }),
      ];

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(fromCalls[0])
        .mockReturnValueOnce(fromCalls[1])
        .mockReturnValueOnce(fromCalls[2])
        .mockReturnValueOnce(fromCalls[3]);

      const result = await service.determineCupWinners(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.winners).toHaveLength(2); // Both tied at 0 points
      expect(result.winners.every(w => w.total_points === 0)).toBe(true);
      expect(result.winners.every(w => w.is_tied === true)).toBe(true);
    });
  });

  describe('determineCupWinnersForCompletedSeasons (Subtask 5)', () => {
    it('should process multiple eligible seasons', async () => {
      const mockEligibleSeasons = [
        { id: 1, name: 'Season 1', completed_at: '2023-01-01', last_round_special_activated: true },
        { id: 2, name: 'Season 2', completed_at: '2023-02-01', last_round_special_activated: true },
      ];

      const fromCalls = [
        // First call: fetch eligible seasons
        createMockQueryChain({ data: mockEligibleSeasons, error: null }),
        // Calls for season 1 processing
        createMockQueryChain({ data: [], error: null }), // getExistingCupWinners
        createMockQueryChain({ data: [{ user_id: 'user1', points: 30, betting_round_id: 1, profiles: { full_name: 'Alice' } }], error: null }), // calculateCupStandings
        createMockQueryChain({ data: { competition_id: 1 }, error: null }), // season lookup
        createMockQueryChain({ error: null }), // upsert
        // Calls for season 2 processing
        createMockQueryChain({ data: [], error: null }), // getExistingCupWinners
        createMockQueryChain({ data: [{ user_id: 'user2', points: 25, betting_round_id: 1, profiles: { full_name: 'Bob' } }], error: null }), // calculateCupStandings
        createMockQueryChain({ data: { competition_id: 1 }, error: null }), // season lookup
        createMockQueryChain({ error: null }), // upsert
      ];

      fromCalls.forEach((mockChain, index) => {
        if (index === 0) {
          (mockSupabaseClient.from as jest.Mock).mockReturnValueOnce(mockChain);
        } else {
          (mockSupabaseClient.from as jest.Mock).mockReturnValueOnce(mockChain);
        }
      });

      const results = await service.determineCupWinnersForCompletedSeasons();

      expect(results).toHaveLength(2);
      expect(results[0].seasonId).toBe(1);
      expect(results[1].seasonId).toBe(2);
      expect(results.every(r => r.errors.length === 0)).toBe(true);
    });

    it('should handle no eligible seasons', async () => {
      const mockChain = createMockQueryChain({ data: [], error: null });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      const results = await service.determineCupWinnersForCompletedSeasons();
      expect(results).toHaveLength(0);
    });

    it('should skip seasons that already have winners', async () => {
      const mockEligibleSeasons = [
        { id: 1, name: 'Season 1', completed_at: '2023-01-01', last_round_special_activated: true },
      ];

      const fromCalls = [
        // First call: fetch eligible seasons
        createMockQueryChain({ data: mockEligibleSeasons, error: null }),
        // Second call: getExistingCupWinners (has existing winners)
        createMockQueryChain({ data: [{ user_id: 'user1', total_points: 120, profiles: { full_name: 'John' } }], error: null }),
      ];

      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce(fromCalls[0])
        .mockReturnValueOnce(fromCalls[1]);

      const results = await service.determineCupWinnersForCompletedSeasons();

      expect(results).toHaveLength(0); // Should skip season with existing winners
    });

    it('should handle database error fetching eligible seasons', async () => {
      const mockChain = createMockQueryChain({ data: null, error: { message: 'Database error' } });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);

      await expect(service.determineCupWinnersForCompletedSeasons()).rejects.toThrow('Database error');
    });

    it('should continue processing other seasons if one fails', async () => {
      const mockEligibleSeasons = [
        { id: 1, name: 'Season 1', completed_at: '2023-01-01', last_round_special_activated: true },
        { id: 2, name: 'Season 2', completed_at: '2023-02-01', last_round_special_activated: true },
      ];

      const fromCalls = [
        // First call: fetch eligible seasons
        createMockQueryChain({ data: mockEligibleSeasons, error: null }),
        // Season 1 processing (fails)
        createMockQueryChain({ data: [], error: null }), // getExistingCupWinners
        createMockQueryChain({ data: null, error: { message: 'Database error for season 1' } }), // calculateCupStandings fails
        // Season 2 processing (succeeds)
        createMockQueryChain({ data: [], error: null }), // getExistingCupWinners
        createMockQueryChain({ data: [{ user_id: 'user2', points: 25, betting_round_id: 1, profiles: { full_name: 'Bob' } }], error: null }), // calculateCupStandings
        createMockQueryChain({ data: { competition_id: 1 }, error: null }), // season lookup
        createMockQueryChain({ error: null }), // upsert
      ];

      fromCalls.forEach(mockChain => {
        (mockSupabaseClient.from as jest.Mock).mockReturnValueOnce(mockChain);
      });

      const results = await service.determineCupWinnersForCompletedSeasons();

      expect(results).toHaveLength(2);
      expect(results[0].errors).toHaveLength(1); // Season 1 failed
      expect(results[1].errors).toHaveLength(0); // Season 2 succeeded
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex tie scenarios correctly', async () => {
      const seasonId = 1;

      const fromCalls = [
        // First call: getExistingCupWinners (no existing winners)
        createMockQueryChain({ data: [], error: null }),
        // Second call: calculateCupStandings with complex tie scenario
        createMockQueryChain({
          data: [
            // 3-way tie at the top with 30 points each
            { user_id: 'user1', points: 30, betting_round_id: 1, profiles: { full_name: 'Alice' } },
            { user_id: 'user2', points: 30, betting_round_id: 1, profiles: { full_name: 'Bob' } },
            { user_id: 'user3', points: 30, betting_round_id: 1, profiles: { full_name: 'Charlie' } },
            // Another user with lower points
            { user_id: 'user4', points: 25, betting_round_id: 1, profiles: { full_name: 'Diana' } },
          ],
          error: null
        }),
        // Third call: season lookup
        createMockQueryChain({ data: { competition_id: 1 }, error: null }),
        // Fourth call: upsert
        createMockQueryChain({ error: null }),
      ];

      fromCalls.forEach(mockChain => {
        (mockSupabaseClient.from as jest.Mock).mockReturnValueOnce(mockChain);
      });

      const result = await service.determineCupWinners(seasonId);

      expect(result.errors).toHaveLength(0);
      expect(result.winners).toHaveLength(3); // All 3 tied winners
      expect(result.winners.every(w => w.total_points === 30)).toBe(true);
      expect(result.winners.every(w => w.rank === 1)).toBe(true);
      expect(result.winners.every(w => w.is_tied === true)).toBe(true);
      expect(result.totalParticipants).toBe(4);
    });

    it('should maintain data consistency across standings calculation and winner determination', async () => {
      const seasonId = 1;

      // Test that the same data produces consistent results
      const mockCupPointsData = [
        { user_id: 'user1', points: 15, betting_round_id: 1, profiles: { full_name: 'Alice' } },
        { user_id: 'user1', points: 10, betting_round_id: 2, profiles: { full_name: 'Alice' } },
      ];

      // Test calculateCupStandings independently
      const mockChain = createMockQueryChain({ data: mockCupPointsData, error: null });
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(mockChain);
      
      const standingsResult = await service.calculateCupStandings(seasonId);

      expect(standingsResult.standings[0].total_points).toBe(25);
      expect(standingsResult.standings[0].rounds_participated).toBe(2);

      // Test identifyWinners with the same data
      const winners = service.identifyWinners(standingsResult.standings);
      expect(winners[0].total_points).toBe(25);
      expect(winners[0].rounds_participated).toBe(2);
    });
  });
}); 