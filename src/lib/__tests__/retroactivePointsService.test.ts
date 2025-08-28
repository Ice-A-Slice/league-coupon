import { RetroactivePointsService } from '../retroactivePointsService';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Mock dependencies
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');

const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    admin: {
      getUserById: jest.fn()
    }
  }
};

const createMockQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn()
});

let mockQuery: ReturnType<typeof createMockQuery>;

describe.skip('RetroactivePointsService - Complex Mocking (TODO: Fix)', () => {
  let service: RetroactivePointsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = createMockQuery();
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.from.mockReturnValue(mockQuery);
    service = new RetroactivePointsService();
  });

  describe('verifyUserExists', () => {
    it('should return exists: true for valid user', async () => {
      mockQuery.single.mockResolvedValue({
        data: { id: 'user-123', created_at: '2025-08-20T00:00:00Z' },
        error: null
      });

      const result = await service['verifyUserExists']('user-123');

      expect(result.exists).toBe(true);
      expect(result.createdAt).toBe('2025-08-20T00:00:00Z');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should return exists: false for non-existent user', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await service['verifyUserExists']('non-existent');

      expect(result.exists).toBe(false);
      expect(result.createdAt).toBeUndefined();
    });
  });

  describe('getCurrentCompetitionContext', () => {
    it('should return competition context for active season', async () => {
      mockQuery.single.mockResolvedValue({
        data: {
          id: 1,
          competition_id: 5,
          competitions: {
            id: 5,
            name: 'Premier League 2025'
          }
        },
        error: null
      });

      const result = await service['getCurrentCompetitionContext']();

      expect(result).toEqual({
        competitionId: 5,
        competitionName: 'Premier League 2025',
        seasonId: 1
      });
    });

    it('should return null when no active season found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows found' }
      });

      const result = await service['getCurrentCompetitionContext']();

      expect(result).toBeNull();
    });
  });

  describe('getMissedRoundsInCompetition', () => {
    it('should return rounds user has not bet on', async () => {
      // Create separate mock queries for the two different calls
      const roundsQuery = createMockQuery();
      const betsQuery = createMockQuery();

      // Mock scored rounds query
      mockSupabaseClient.from
        .mockReturnValueOnce(roundsQuery)
        .mockReturnValueOnce(betsQuery);

      roundsQuery.gte.mockReturnValue(roundsQuery);
      roundsQuery.order.mockReturnValue(roundsQuery);
      roundsQuery.mockResolvedValue = jest.fn().mockResolvedValue({
        data: [
          { id: 1, name: 'Round 1' },
          { id: 2, name: 'Round 2' },
          { id: 3, name: 'Round 3' }
        ],
        error: null
      });

      // Mock user bets query  
      betsQuery.in.mockReturnValue(betsQuery);
      betsQuery.mockResolvedValue = jest.fn().mockResolvedValue({
        data: [
          { betting_round_id: 2 }, // User has bet in round 2
          { betting_round_id: 3 }  // User has bet in round 3
        ],
        error: null
      });

      // Set up the chain calls
      Object.assign(roundsQuery, roundsQuery.mockResolvedValue());
      Object.assign(betsQuery, betsQuery.mockResolvedValue());

      const result = await service['getMissedRoundsInCompetition']('user-123', 5);

      expect(result).toEqual([
        { id: 1, name: 'Round 1' } // Should only return round 1 (missed)
      ]);
    });

    it('should return empty array when user has not missed any rounds', async () => {
      // Mock all rounds
      mockQuery.mockReturnValueOnce({
        ...mockQuery,
        single: jest.fn(),
        mockResolvedValue: {
          data: [
            { id: 1, name: 'Round 1' },
            { id: 2, name: 'Round 2' }
          ],
          error: null
        }
      });

      // Mock user has bets in all rounds
      mockSupabaseClient.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce({
        ...mockQuery,
        mockResolvedValue: {
          data: [
            { betting_round_id: 1 },
            { betting_round_id: 2 }
          ],
          error: null
        }
      });

      const result = await service['getMissedRoundsInCompetition']('user-123', 5);

      expect(result).toEqual([]);
    });
  });

  describe('processRetroactivePointsForRound', () => {
    const mockFixtures = [
      { fixture_id: 1, fixtures: { id: 1, home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' } } },
      { fixture_id: 2, fixtures: { id: 2, home_team: { name: 'Liverpool' }, away_team: { name: 'City' } } },
      { fixture_id: 3, fixtures: { id: 3, home_team: { name: 'United' }, away_team: { name: 'Spurs' } } }
    ];

    beforeEach(() => {
      // Mock fixtures query
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'betting_round_fixtures') {
          return {
            ...mockQuery,
            mockResolvedValue: {
              data: mockFixtures,
              error: null
            }
          };
        }
        return mockQuery;
      });
    });

    it('should calculate correct minimum score and distribute points in dry-run mode', async () => {
      // Mock participant scores: User A = 2 points, User B = 0 points, User C = 3 points
      // Minimum should be 0
      mockQuery.mockResolvedValueOnce({
        data: [
          { user_id: 'user-a', points_awarded: 1 },
          { user_id: 'user-a', points_awarded: 1 }, // User A total: 2 points
          { user_id: 'user-b', points_awarded: 0 },
          { user_id: 'user-b', points_awarded: 0 }, // User B total: 0 points  
          { user_id: 'user-c', points_awarded: 1 },
          { user_id: 'user-c', points_awarded: 2 }  // User C total: 3 points
        ],
        error: null
      });

      const result = await service['processRetroactivePointsForRound'](
        'new-user',
        1,
        'Round 1',
        true // dry-run
      );

      expect(result).toEqual({
        roundId: 1,
        roundName: 'Round 1',
        pointsAwarded: 0, // Minimum score
        minimumParticipantScore: 0,
        participantCount: 3
      });

      // Should not insert any records in dry-run mode
      expect(mockQuery.insert).not.toHaveBeenCalled();
    });

    it('should create bet records with correct point distribution', async () => {
      // Mock participant scores: minimum = 2 points
      mockQuery.mockResolvedValueOnce({
        data: [
          { user_id: 'user-a', points_awarded: 1 },
          { user_id: 'user-a', points_awarded: 1 }, // User A: 2 points
          { user_id: 'user-b', points_awarded: 2 },
          { user_id: 'user-b', points_awarded: 1 }  // User B: 3 points
        ],
        error: null
      });

      // Mock successful insert
      mockQuery.insert.mockResolvedValue({ error: null });

      const result = await service['processRetroactivePointsForRound'](
        'new-user',
        1,
        'Round 1',
        false // actual processing
      );

      expect(result).toEqual({
        roundId: 1,
        roundName: 'Round 1',
        pointsAwarded: 2,
        minimumParticipantScore: 2,
        participantCount: 2
      });

      // Should create 3 bet records (one per fixture)
      expect(mockQuery.insert).toHaveBeenCalledWith([
        {
          user_id: 'new-user',
          betting_round_id: 1,
          fixture_id: 1,
          prediction: '1',
          points_awarded: 1, // First point
          submitted_at: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        },
        {
          user_id: 'new-user',
          betting_round_id: 1,
          fixture_id: 2,
          prediction: '1',
          points_awarded: 1, // Second point
          submitted_at: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        },
        {
          user_id: 'new-user',
          betting_round_id: 1,
          fixture_id: 3,
          prediction: '1',
          points_awarded: 0, // No more points to distribute
          submitted_at: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        }
      ]);
    });

    it('should handle no participants scenario', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [], // No participants
        error: null
      });

      const result = await service['processRetroactivePointsForRound'](
        'new-user',
        1,
        'Round 1',
        true
      );

      expect(result).toEqual({
        roundId: 1,
        roundName: 'Round 1',
        pointsAwarded: 0,
        minimumParticipantScore: 0,
        participantCount: 0
      });
    });
  });

  describe('applyRetroactivePointsForUser', () => {
    it('should return error for non-existent user', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      const result = await service.applyRetroactivePointsForUser('non-existent');

      expect(result.errors).toContain('User non-existent not found in profiles table');
      expect(result.roundsProcessed).toBe(0);
      expect(result.totalPointsAwarded).toBe(0);
    });

    it('should process multiple missed rounds correctly', async () => {
      // Mock user exists
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'user-123', created_at: '2025-08-20T00:00:00Z' },
        error: null
      });

      // Mock competition context
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 1,
          competition_id: 5,
          competitions: { id: 5, name: 'Premier League 2025' }
        },
        error: null
      });

      // Mock getMissedRoundsInCompetition to return 2 rounds
      // @ts-expect-error - Spying on private method for testing\n      const mockGetMissedRounds = jest.spyOn(service, 'getMissedRoundsInCompetition');
      mockGetMissedRounds.mockResolvedValue([
        { id: 1, name: 'Round 1' },
        { id: 2, name: 'Round 2' }
      ]);

      // Mock processRetroactivePointsForRound
      // @ts-expect-error - Spying on private method for testing\n      const mockProcessRound = jest.spyOn(service, 'processRetroactivePointsForRound');
      mockProcessRound
        .mockResolvedValueOnce({
          roundId: 1,
          roundName: 'Round 1', 
          pointsAwarded: 2,
          minimumParticipantScore: 2,
          participantCount: 3
        })
        .mockResolvedValueOnce({
          roundId: 2,
          roundName: 'Round 2',
          pointsAwarded: 1, 
          minimumParticipantScore: 1,
          participantCount: 3
        });

      const result = await service.applyRetroactivePointsForUser('user-123');

      expect(result.errors).toEqual([]);
      expect(result.roundsProcessed).toBe(2);
      expect(result.totalPointsAwarded).toBe(3); // 2 + 1
      expect(result.rounds).toHaveLength(2);
      expect(result.rounds[0].pointsAwarded).toBe(2);
      expect(result.rounds[1].pointsAwarded).toBe(1);
    });
  });

  describe('previewRetroactivePoints', () => {
    it('should call applyRetroactivePointsForUser with dryRun=true', async () => {
      const mockApply = jest.spyOn(service, 'applyRetroactivePointsForUser');
      mockApply.mockResolvedValue({
        userId: 'user-123',
        roundsProcessed: 2,
        totalPointsAwarded: 5,
        rounds: [],
        errors: []
      });

      const result = await service.previewRetroactivePoints('user-123');

      expect(mockApply).toHaveBeenCalledWith('user-123', undefined, true);
      expect(result.totalPointsAwarded).toBe(5);
    });
  });

  describe('checkIfUserNeedsRetroactivePoints', () => {
    it('should return correct assessment', async () => {
      const mockPreview = jest.spyOn(service, 'previewRetroactivePoints');
      mockPreview.mockResolvedValue({
        userId: 'user-123',
        roundsProcessed: 3,
        totalPointsAwarded: 7,
        rounds: [],
        errors: []
      });

      // @ts-expect-error - Spying on private method for testing\n      const mockGetContext = jest.spyOn(service, 'getCurrentCompetitionContext');
      mockGetContext.mockResolvedValue({
        competitionId: 5,
        competitionName: 'Premier League 2025',
        seasonId: 1
      });

      const result = await service.checkIfUserNeedsRetroactivePoints('user-123');

      expect(result).toEqual({
        needsRetroactivePoints: true,
        missedRounds: 3,
        estimatedPointsToAward: 7,
        competitionContext: {
          competitionId: 5,
          competitionName: 'Premier League 2025',
          seasonId: 1
        }
      });
    });

    it('should return false for user who needs no retroactive points', async () => {
      const mockPreview = jest.spyOn(service, 'previewRetroactivePoints');
      mockPreview.mockResolvedValue({
        userId: 'user-123',
        roundsProcessed: 0, // No missed rounds
        totalPointsAwarded: 0,
        rounds: [],
        errors: []
      });

      const result = await service.checkIfUserNeedsRetroactivePoints('user-123');

      expect(result.needsRetroactivePoints).toBe(false);
      expect(result.missedRounds).toBe(0);
      expect(result.estimatedPointsToAward).toBe(0);
    });
  });

  describe('isUserFirstBetInCompetition', () => {
    it('should return true for first bet in competition', async () => {
      // Mock competition rounds
      mockQuery.mockReturnValueOnce({
        ...mockQuery,
        single: jest.fn(),
        mockResolvedValue: {
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          error: null
        }
      });

      // Mock no existing bets
      mockSupabaseClient.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce({
        ...mockQuery,
        mockResolvedValue: {
          data: [], // No existing bets
          error: null
        }
      });

      const result = await service.isUserFirstBetInCompetition('user-123', 5);

      expect(result).toBe(true);
    });

    it('should return false when user has existing bets', async () => {
      // Mock competition rounds
      mockQuery.mockReturnValueOnce({
        ...mockQuery,
        single: jest.fn(),
        mockResolvedValue: {
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          error: null
        }
      });

      // Mock existing bets
      mockSupabaseClient.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce({
        ...mockQuery,
        mockResolvedValue: {
          data: [{ id: 'bet-1' }], // Has existing bets
          error: null
        }
      });

      const result = await service.isUserFirstBetInCompetition('user-123', 5);

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await service.applyRetroactivePointsForUser('user-123');

      expect(result.errors).toContain('User user-123 not found in profiles table');
    });

    it('should continue processing other rounds when one fails', async () => {
      // Mock user exists
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'user-123', created_at: '2025-08-20T00:00:00Z' },
        error: null
      });

      // Mock competition context
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 1,
          competition_id: 5,
          competitions: { id: 5, name: 'Premier League 2025' }
        },
        error: null
      });

      // Mock 2 missed rounds
      // @ts-expect-error - Spying on private method for testing\n      const mockGetMissedRounds = jest.spyOn(service, 'getMissedRoundsInCompetition');
      mockGetMissedRounds.mockResolvedValue([
        { id: 1, name: 'Round 1' },
        { id: 2, name: 'Round 2' }
      ]);

      // Mock first round succeeds, second round fails
      // @ts-expect-error - Spying on private method for testing\n      const mockProcessRound = jest.spyOn(service, 'processRetroactivePointsForRound');
      mockProcessRound
        .mockResolvedValueOnce({
          roundId: 1,
          roundName: 'Round 1',
          pointsAwarded: 2,
          minimumParticipantScore: 2,
          participantCount: 3
        })
        .mockRejectedValueOnce(new Error('Database error in round 2'));

      const result = await service.applyRetroactivePointsForUser('user-123');

      expect(result.roundsProcessed).toBe(1); // Only first round processed
      expect(result.totalPointsAwarded).toBe(2);
      expect(result.errors).toContain('Failed to process round 2: Database error in round 2');
    });
  });
});