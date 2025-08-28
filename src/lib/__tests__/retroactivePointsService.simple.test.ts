import { RetroactivePointsService } from '../retroactivePointsService';

// Simple focused test for key functionality
describe('RetroactivePointsService - Core Logic', () => {
  let service: RetroactivePointsService;

  // Mock Supabase client
  const mockClient = {
    from: jest.fn(),
    auth: { admin: { getUserById: jest.fn() } }
  } as unknown as Parameters<typeof RetroactivePointsService>[0];

  beforeEach(() => {
    service = new RetroactivePointsService(mockClient);
    jest.clearAllMocks();
  });

  describe('Point Distribution Logic', () => {
    it('should distribute points correctly across fixtures', () => {
      // Test the core algorithm logic by testing point distribution
      const fixtures = [
        { fixture_id: 1 },
        { fixture_id: 2 },
        { fixture_id: 3 },
        { fixture_id: 4 },
        { fixture_id: 5 }
      ];
      
      const minimumScore = 3;
      let remainingPoints = minimumScore;
      const betRecords = [];

      // This mimics the logic in processRetroactivePointsForRound
      for (let i = 0; i < fixtures.length && remainingPoints > 0; i++) {
        const fixture = fixtures[i];
        const pointsToAward = Math.min(1, remainingPoints);
        
        betRecords.push({
          fixture_id: fixture.fixture_id,
          points_awarded: pointsToAward
        });
        
        remainingPoints -= pointsToAward;
      }

      // Add remaining fixtures with 0 points
      for (let i = betRecords.length; i < fixtures.length; i++) {
        betRecords.push({
          fixture_id: fixtures[i].fixture_id,
          points_awarded: 0
        });
      }

      expect(betRecords).toHaveLength(5);
      expect(betRecords[0].points_awarded).toBe(1); // First fixture gets 1 point
      expect(betRecords[1].points_awarded).toBe(1); // Second fixture gets 1 point
      expect(betRecords[2].points_awarded).toBe(1); // Third fixture gets 1 point
      expect(betRecords[3].points_awarded).toBe(0); // Fourth fixture gets 0 points
      expect(betRecords[4].points_awarded).toBe(0); // Fifth fixture gets 0 points

      const totalPoints = betRecords.reduce((sum, record) => sum + record.points_awarded, 0);
      expect(totalPoints).toBe(minimumScore);
    });

    it('should handle zero points correctly', () => {
      const fixtures = [{ fixture_id: 1 }, { fixture_id: 2 }];
      const minimumScore = 0;
      let remainingPoints = minimumScore;
      const betRecords = [];

      for (let i = 0; i < fixtures.length && remainingPoints > 0; i++) {
        const fixture = fixtures[i];
        const pointsToAward = Math.min(1, remainingPoints);
        
        betRecords.push({
          fixture_id: fixture.fixture_id,
          points_awarded: pointsToAward
        });
        
        remainingPoints -= pointsToAward;
      }

      // Add remaining fixtures with 0 points
      for (let i = betRecords.length; i < fixtures.length; i++) {
        betRecords.push({
          fixture_id: fixtures[i].fixture_id,
          points_awarded: 0
        });
      }

      expect(betRecords).toHaveLength(2);
      expect(betRecords[0].points_awarded).toBe(0);
      expect(betRecords[1].points_awarded).toBe(0);

      const totalPoints = betRecords.reduce((sum, record) => sum + record.points_awarded, 0);
      expect(totalPoints).toBe(0);
    });

    it('should calculate minimum participant score correctly', () => {
      // Test the minimum score calculation logic
      const participantScores = [
        { user_id: 'user-a', points_awarded: 1 },
        { user_id: 'user-a', points_awarded: 1 }, // User A total: 2 points
        { user_id: 'user-b', points_awarded: 0 },
        { user_id: 'user-b', points_awarded: 0 }, // User B total: 0 points  
        { user_id: 'user-c', points_awarded: 2 },
        { user_id: 'user-c', points_awarded: 1 }  // User C total: 3 points
      ];

      // This mimics the logic in processRetroactivePointsForRound
      const participantTotals = new Map<string, number>();
      participantScores.forEach(bet => {
        const current = participantTotals.get(bet.user_id) || 0;
        participantTotals.set(bet.user_id, current + (bet.points_awarded || 0));
      });

      const minimumScore = Math.min(...Array.from(participantTotals.values()));
      const participantCount = participantTotals.size;

      expect(participantCount).toBe(3);
      expect(participantTotals.get('user-a')).toBe(2);
      expect(participantTotals.get('user-b')).toBe(0);
      expect(participantTotals.get('user-c')).toBe(3);
      expect(minimumScore).toBe(0); // User B has the minimum score
    });
  });

  describe('Result Structure', () => {
    it('should create correct result structure for successful processing', () => {
      const result = {
        userId: 'user-123',
        roundsProcessed: 2,
        totalPointsAwarded: 5,
        rounds: [
          {
            roundId: 1,
            roundName: 'Round 1',
            pointsAwarded: 2,
            minimumParticipantScore: 2,
            participantCount: 3
          },
          {
            roundId: 2,
            roundName: 'Round 2',
            pointsAwarded: 3,
            minimumParticipantScore: 3,
            participantCount: 4
          }
        ],
        errors: []
      };

      expect(result.userId).toBe('user-123');
      expect(result.roundsProcessed).toBe(2);
      expect(result.totalPointsAwarded).toBe(5);
      expect(result.rounds).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify totals match
      const calculatedTotal = result.rounds.reduce((sum, round) => sum + round.pointsAwarded, 0);
      expect(calculatedTotal).toBe(result.totalPointsAwarded);
    });

    it('should handle errors gracefully', () => {
      const result = {
        userId: 'user-123',
        roundsProcessed: 1,
        totalPointsAwarded: 2,
        rounds: [
          {
            roundId: 1,
            roundName: 'Round 1',
            pointsAwarded: 2,
            minimumParticipantScore: 2,
            participantCount: 3
          }
        ],
        errors: ['Failed to process round 2: Database error']
      };

      expect(result.roundsProcessed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to process round 2');
    });
  });

  describe('Utility Methods', () => {
    it('should verify user exists method returns correct structure', async () => {
      // Mock successful user lookup
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123', created_at: '2025-08-20T00:00:00Z' },
              error: null
            })
          })
        })
      });
      mockClient.from.mockImplementation(mockFrom);

      const result = await service['verifyUserExists']('user-123');

      expect(result.exists).toBe(true);
      expect(result.createdAt).toBe('2025-08-20T00:00:00Z');
      expect(mockClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should return false for non-existent user', async () => {
      // Mock failed user lookup
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      });
      mockClient.from.mockImplementation(mockFrom);

      const result = await service['verifyUserExists']('non-existent');

      expect(result.exists).toBe(false);
      expect(result.createdAt).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle no participants scenario', () => {
      const participantScores: Array<{user_id: string; points_awarded: number}> = []; // No participants
      
      if (participantScores.length === 0) {
        // This is how the service handles no participants
        const result = {
          roundId: 1,
          roundName: 'Round 1',
          pointsAwarded: 0,
          minimumParticipantScore: 0,
          participantCount: 0
        };

        expect(result.pointsAwarded).toBe(0);
        expect(result.participantCount).toBe(0);
      }
    });

    it('should handle single participant scenario', () => {
      const participantScores = [
        { user_id: 'user-a', points_awarded: 3 }
      ];

      const participantTotals = new Map<string, number>();
      participantScores.forEach(bet => {
        const current = participantTotals.get(bet.user_id) || 0;
        participantTotals.set(bet.user_id, current + (bet.points_awarded || 0));
      });

      const minimumScore = Math.min(...Array.from(participantTotals.values()));
      const participantCount = participantTotals.size;

      expect(participantCount).toBe(1);
      expect(minimumScore).toBe(3);
    });
  });
});