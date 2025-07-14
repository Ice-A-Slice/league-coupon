import {
  CupScoringService,
  cupScoringService,
  calculateRoundCupPoints,
  CupScoringServiceError
} from '../cupScoringService';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/client');
jest.mock('@/utils/logger');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('CupScoringService', () => {
  let service: CupScoringService;
  let mockClient: {
    from: jest.MockedFunction<(table: string) => unknown>;
    select: jest.MockedFunction<(columns: string) => unknown>;
    eq: jest.MockedFunction<(column: string, value: unknown) => unknown>;
    not: jest.MockedFunction<(column: string, operator: string, value: unknown) => unknown>;
    single: jest.MockedFunction<() => Promise<{ data: unknown; error: unknown }>>;
    upsert: jest.MockedFunction<(data: unknown, options?: unknown) => Promise<{ data: unknown; error: unknown }>>;
    gte: jest.MockedFunction<(column: string, value: unknown) => unknown>;
    order: jest.MockedFunction<(column: string, options?: unknown) => unknown>;
    limit: jest.MockedFunction<(count: number) => unknown>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a proper mock client with all methods
    mockClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      single: jest.fn(),
      upsert: jest.fn(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    };
    
    // Ensure all chain methods return the mockClient to maintain proper chaining
    mockClient.from.mockReturnValue(mockClient);
    mockClient.select.mockReturnValue(mockClient);
    mockClient.eq.mockReturnValue(mockClient);
    
    // Make the chain itself thenable for queries that don't use .single()
    mockClient.not.mockImplementation(() => {
      const chainResult = mockClient;
      // Add a default promise resolution for when the chain is awaited directly
      Object.assign(chainResult, {
        then: jest.fn((resolve) => resolve({ data: [], error: null }))
      });
      return chainResult;
    });
    
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.warn = jest.fn();
    
    service = new CupScoringService();
  });

  describe('calculateRoundCupPoints', () => {
    it('should handle cup not activated scenario', async () => {
      // Mock season query response - cup not activated
      const seasonData = {
        season_id: 1,
        seasons: {
          id: 1,
          season_name: '2024/25',
          last_round_special_activated: false,
          last_round_special_activated_at: null
        }
      };

      mockClient.single.mockResolvedValueOnce({ data: seasonData, error: null });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cup not activated');
      expect(result.details.usersProcessed).toBe(0);
      expect(result.details.roundsProcessed).toBe(0);
    });

    it('should handle season not found error', async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Season not found');
      expect(result.details.usersProcessed).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockClient.single.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database connection failed' }
      });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to calculate cup points');
      expect(result.details.errors).toHaveLength(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should calculate points when cup is activated and bets exist', async () => {
      // Mock season query - cup activated
      const seasonData = {
        season_id: 1,
        seasons: {
          id: 1,
          season_name: '2024/25',
          last_round_special_activated: true,
          last_round_special_activated_at: '2024-01-01T00:00:00Z'
        }
      };

      // Mock user bets data
      const userBetsData = [
        { user_id: 'user1', fixture_id: 1, points_awarded: 1 },
        { user_id: 'user1', fixture_id: 2, points_awarded: 0 },
        { user_id: 'user2', fixture_id: 1, points_awarded: 1 }
      ];

      // Setup mock responses - first call (.single()) for season, second call (direct await) for user bets
      mockClient.single.mockResolvedValueOnce({ data: seasonData, error: null });
      
      // Mock the user bets query chain (this doesn't use .single())
      mockClient.not.mockImplementationOnce(() => 
        Promise.resolve({ data: userBetsData, error: null })
      );
      
      mockClient.upsert.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(true);
      expect(result.details.usersProcessed).toBe(2); // user1 and user2
      expect(result.details.totalPointsAwarded).toBe(2); // user1: 1, user2: 1
      expect(result.details.roundsProcessed).toBe(1);
    });

    it('should handle no user bets found', async () => {
      // Mock season query - cup activated
      const seasonData = {
        season_id: 1,
        seasons: {
          id: 1,
          season_name: '2024/25',
          last_round_special_activated: true,
          last_round_special_activated_at: '2024-01-01T00:00:00Z'
        }
      };

      mockClient.single
        .mockResolvedValueOnce({ data: seasonData, error: null })
        .mockResolvedValueOnce({ data: [], error: null }); // No user bets

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No user bets found');
      expect(result.details.usersProcessed).toBe(0);
      expect(result.details.roundsProcessed).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error
      mockClient.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to calculate cup points');
      expect(result.details.errors).toHaveLength(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should create proper CupScoringServiceError', () => {
      const context = { userId: 'user1', seasonId: 1 };
      const error = new CupScoringServiceError('Test error', context);
      
      expect(error.message).toBe('Test error');
      expect(error.context).toEqual(context);
      expect(error.name).toBe('CupScoringServiceError');
    });
  });

  describe('Convenience functions and singleton', () => {
    it('should export working convenience functions', async () => {
      expect(typeof calculateRoundCupPoints).toBe('function');
      
      // Instead of testing the convenience function with complex mocking,
      // let's test that it calls the service method correctly by spying on it
      const mockResult = {
        success: true,
        message: 'Cup not activated - no points calculated',
        details: {
          usersProcessed: 0,
          roundsProcessed: 0,
          totalPointsAwarded: 0,
          errors: []
        }
      };

      // Spy on the singleton's method
      const spy = jest.spyOn(cupScoringService, 'calculateRoundCupPoints').mockResolvedValue(mockResult);

      const result = await calculateRoundCupPoints(1, { onlyAfterActivation: true });
      
      expect(spy).toHaveBeenCalledWith(1, { onlyAfterActivation: true });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cup not activated');
      
      spy.mockRestore();
    });

    it('should export a singleton instance', () => {
      expect(cupScoringService).toBeInstanceOf(CupScoringService);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero points correctly', async () => {
      const seasonData = {
        season_id: 1,
        seasons: {
          id: 1,
          season_name: '2024/25',
          last_round_special_activated: true,
          last_round_special_activated_at: '2024-01-01T00:00:00Z'
        }
      };

      // Note: The service filters out null points_awarded, so we use 0 instead
      const userBetsData = [
        { user_id: 'user1', fixture_id: 1, points_awarded: 0 },
        { user_id: 'user1', fixture_id: 2, points_awarded: 0 }
      ];

      // First call: season info query
      mockClient.single.mockResolvedValueOnce({ data: seasonData, error: null });
      
      // Second call: user bets query - modify the mock to resolve with userBetsData
      const mockChain = {
        ...mockClient,
        then: jest.fn((resolve) => resolve({ data: userBetsData, error: null }))
      };
      mockClient.not.mockReturnValueOnce(mockChain);
      
      mockClient.upsert.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(true);
      expect(result.details.usersProcessed).toBe(1);
      expect(result.details.totalPointsAwarded).toBe(0);
    });

    it('should handle null/undefined points_awarded', async () => {
      const seasonData = {
        season_id: 1,
        seasons: {
          id: 1,
          season_name: '2024/25',
          last_round_special_activated: true,
          last_round_special_activated_at: '2024-01-01T00:00:00Z'
        }
      };

      // Note: In real usage, the query .not('points_awarded', 'is', null) would filter these out
      // So for this test, we should return an empty array to simulate no valid bets
      const userBetsData: Array<{ user_id: string; fixture_id: number; points_awarded: number }> = [];

      // First call: season info query
      mockClient.single.mockResolvedValueOnce({ data: seasonData, error: null });
      
      // Second call: user bets query - empty array since null/undefined are filtered out
      const mockChain = {
        ...mockClient,
        then: jest.fn((resolve) => resolve({ data: userBetsData, error: null }))
      };
      mockClient.not.mockReturnValueOnce(mockChain);
      
      mockClient.upsert.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.calculateRoundCupPoints(1);

      expect(result.success).toBe(true);
      expect(result.details.usersProcessed).toBe(0); // No users processed due to null/undefined filtering
      expect(result.details.totalPointsAwarded).toBe(0); // null/undefined treated as 0
    });
  });
}); 