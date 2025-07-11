import { idempotentActivationService } from '../idempotentActivationService';
import { cupActivationStatusChecker } from '../cupActivationStatusChecker';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/client');
jest.mock('@/utils/logger');
jest.mock('../cupActivationStatusChecker');

const mockSupabase = {
  rpc: jest.fn(),
};

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCupActivationStatusChecker = cupActivationStatusChecker as jest.Mocked<typeof cupActivationStatusChecker>;

describe('IdempotentActivationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabase as any);
    mockLogger.error = jest.fn();
    
    // Setup default mocks for cup activation status checker
    mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus = jest.fn();
    mockCupActivationStatusChecker.checkSeasonActivationStatus = jest.fn();
  });

  describe('activateCurrentSeasonCup', () => {
    it('should return success when cup is already activated', async () => {
      // Mock that cup is already activated
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: true,
        activatedAt: '2025-01-27T10:00:00Z',
        seasonId: 1,
        seasonName: '2024/25'
      });

      const result = await idempotentActivationService.activateCurrentSeasonCup();

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(true);
      expect(result.activatedAt).toBe('2025-01-27T10:00:00Z');
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBeNull();
      expect(result.attemptedAt).toBeTruthy();
      
      // Should not call RPC since already activated
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should return failure when no current season exists', async () => {
      // Mock no current season
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: null,
        seasonName: null
      });

      const result = await idempotentActivationService.activateCurrentSeasonCup();

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBeNull();
      expect(result.seasonName).toBeNull();
      expect(result.error).toBe('No current season found');
      expect(result.attemptedAt).toBeTruthy();
      
      // Should not call RPC since no season
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should successfully activate cup when conditions are met', async () => {
      // Mock current season not activated
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });

      // Mock successful RPC response
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          already_activated: false,
          activated_at: '2025-01-27T12:00:00Z',
          season_name: '2024/25',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService.activateCurrentSeasonCup({
        activatedBy: 'test-user',
        reason: 'Test activation'
      });

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeTruthy();
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBeNull();
      expect(result.attemptedAt).toBeTruthy();
      
      // Should call RPC with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('activate_last_round_special', {
        p_season_id: 1,
        p_activation_timestamp: expect.any(String)
      });
    });

    it('should handle race condition when cup gets activated during transaction', async () => {
      // Mock current season not activated initially
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });

      // Mock RPC response indicating already activated in parallel transaction
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: false,
          already_activated: true,
          activated_at: '2025-01-27T11:30:00Z',
          season_name: '2024/25',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService.activateCurrentSeasonCup();

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(true);
      expect(result.activatedAt).toBe('2025-01-27T11:30:00Z');
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBeNull();
    });

    it('should handle RPC error', async () => {
      // Mock current season not activated
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });

      // Mock RPC error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await idempotentActivationService.activateCurrentSeasonCup();

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBe('Failed to activate cup: Database connection failed');
    });

    it('should handle unexpected errors', async () => {
      // Mock status checker to throw error
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await idempotentActivationService.activateCurrentSeasonCup();

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBeNull();
      expect(result.seasonName).toBeNull();
      expect(result.error).toBe('Unexpected error during activation');
    });
  });

  describe('activateSeasonCup', () => {
    it('should return success when cup is already activated for specific season', async () => {
      // Mock that cup is already activated
      mockCupActivationStatusChecker.checkSeasonActivationStatus.mockResolvedValue({
        isActivated: true,
        activatedAt: '2024-03-15T14:30:00Z',
        seasonId: 2,
        seasonName: '2023/24'
      });

      const result = await idempotentActivationService.activateSeasonCup(2);

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(true);
      expect(result.activatedAt).toBe('2024-03-15T14:30:00Z');
      expect(result.seasonId).toBe(2);
      expect(result.seasonName).toBe('2023/24');
      expect(result.error).toBeNull();
      
      // Should not call RPC since already activated
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should return failure when season does not exist', async () => {
      // Mock season not found
      mockCupActivationStatusChecker.checkSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 999,
        seasonName: null
      });

      const result = await idempotentActivationService.activateSeasonCup(999);

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBe(999);
      expect(result.seasonName).toBeNull();
      expect(result.error).toBe('Season 999 not found');
      
      // Should not call RPC since season not found
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should successfully activate cup for specific season', async () => {
      // Mock season exists and not activated
      mockCupActivationStatusChecker.checkSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 2,
        seasonName: '2023/24'
      });

      // Mock successful RPC response
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          already_activated: false,
          activated_at: '2025-01-27T12:00:00Z',
          season_name: '2023/24',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService.activateSeasonCup(2, {
        activatedBy: 'admin',
        reason: 'Manual activation'
      });

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeTruthy();
      expect(result.seasonId).toBe(2);
      expect(result.seasonName).toBe('2023/24');
      expect(result.error).toBeNull();
      
      // Should call RPC with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('activate_last_round_special', {
        p_season_id: 2,
        p_activation_timestamp: expect.any(String)
      });
    });

    it('should validate season ID input', async () => {
      // Test invalid season IDs
      const invalidSeasonIds = [0, -1, null as any, undefined as any];
      
      for (const seasonId of invalidSeasonIds) {
        const result = await idempotentActivationService.activateSeasonCup(seasonId);
        
        expect(result.success).toBe(false);
        expect(result.wasAlreadyActivated).toBe(false);
        expect(result.activatedAt).toBeNull();
        expect(result.seasonId).toBe(seasonId);
        expect(result.seasonName).toBeNull();
        expect(result.error).toBe('Valid season ID is required');
      }
    });

    it('should handle RPC failure for specific season', async () => {
      // Mock season exists and not activated
      mockCupActivationStatusChecker.checkSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 2,
        seasonName: '2023/24'
      });

      // Mock RPC failure
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: false,
          already_activated: false,
          activated_at: null,
          season_name: '2023/24',
          error: 'Database constraint violation'
        },
        error: null
      });

      const result = await idempotentActivationService.activateSeasonCup(2);

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBe(2);
      expect(result.seasonName).toBe('2023/24');
      expect(result.error).toBe('Database constraint violation');
    });
  });

  describe('attemptActivation', () => {
    it('should return true when activation succeeds for current season', async () => {
      // Mock successful current season activation
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          already_activated: false,
          activated_at: '2025-01-27T12:00:00Z',
          season_name: '2024/25',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService.attemptActivation();
      expect(result).toBe(true);
    });

    it('should return true when activation succeeds for specific season', async () => {
      // Mock successful specific season activation
      mockCupActivationStatusChecker.checkSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: 2,
        seasonName: '2023/24'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          already_activated: false,
          activated_at: '2025-01-27T12:00:00Z',
          season_name: '2023/24',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService.attemptActivation(2);
      expect(result).toBe(true);
    });

    it('should return false when activation fails', async () => {
      // Mock no current season
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: false,
        activatedAt: null,
        seasonId: null,
        seasonName: null
      });

      const result = await idempotentActivationService.attemptActivation();
      expect(result).toBe(false);
    });

    it('should return true when already activated', async () => {
      // Mock already activated
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
        isActivated: true,
        activatedAt: '2025-01-27T10:00:00Z',
        seasonId: 1,
        seasonName: '2024/25'
      });

      const result = await idempotentActivationService.attemptActivation();
      expect(result).toBe(true);
    });
  });

  describe('_performActivationTransaction', () => {
    it('should handle successful transaction', async () => {
      // Mock successful RPC response
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          already_activated: false,
          activated_at: '2025-01-27T12:00:00Z',
          season_name: '2024/25',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService._performActivationTransaction(
        1,
        '2024/25',
        { activatedBy: 'test', reason: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeTruthy();
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBeNull();
    });

    it('should handle concurrent activation in transaction', async () => {
      // Mock RPC response indicating already activated
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: false,
          already_activated: true,
          activated_at: '2025-01-27T11:30:00Z',
          season_name: '2024/25',
          error: null
        },
        error: null
      });

      const result = await idempotentActivationService._performActivationTransaction(
        1,
        '2024/25',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.wasAlreadyActivated).toBe(true);
      expect(result.activatedAt).toBe('2025-01-27T11:30:00Z');
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBeNull();
    });

    it('should handle transaction failure', async () => {
      // Mock RPC failure
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: false,
          already_activated: false,
          activated_at: null,
          season_name: '2024/25',
          error: 'Transaction failed'
        },
        error: null
      });

      const result = await idempotentActivationService._performActivationTransaction(
        1,
        '2024/25',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.wasAlreadyActivated).toBe(false);
      expect(result.activatedAt).toBeNull();
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('2024/25');
      expect(result.error).toBe('Transaction failed');
    });

    it('should handle RPC errors', async () => {
      // Mock RPC error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' }
      });

      await expect(idempotentActivationService._performActivationTransaction(1, '2024/25', {}))
        .rejects.toThrow('Failed to activate cup: Function not found');
    });

    it('should handle unexpected errors', async () => {
      // Mock RPC to throw error
      mockSupabase.rpc.mockRejectedValue(new Error('Network error'));

      await expect(idempotentActivationService._performActivationTransaction(1, '2024/25', {}))
        .rejects.toThrow('Database transaction failed');
    });
  });
}); 