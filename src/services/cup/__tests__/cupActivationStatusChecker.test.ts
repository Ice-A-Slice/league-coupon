import { cupActivationStatusChecker } from '../cupActivationStatusChecker';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/client');
jest.mock('@/utils/logger');

const mockSupabase = {
  from: jest.fn(),
};

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('CupActivationStatusChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabase as ReturnType<typeof createClient>);
    mockLogger.error = jest.fn();
  });

  describe('checkCurrentSeasonActivationStatus', () => {
    it('should return activated status when current season has cup activated', async () => {
      const mockSeason = {
        id: 1,
        name: '2024/25',
        last_round_special_activated: true,
        last_round_special_activated_at: '2025-01-27T10:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: true,
        activatedAt: '2025-01-27T10:00:00Z',
        seasonId: 1,
        seasonName: '2024/25'
      });
    });

    it('should return not activated status when current season has cup not activated', async () => {
      const mockSeason = {
        id: 1,
        name: '2024/25',
        last_round_special_activated: false,
        last_round_special_activated_at: null
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });
    });

    it('should handle null last_round_special_activated field', async () => {
      const mockSeason = {
        id: 1,
        name: '2024/25',
        last_round_special_activated: null,
        last_round_special_activated_at: null
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      });
    });

    it('should return default values when no current season exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: null,
        seasonName: null
      });
    });

    it('should throw error when database query fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      await expect(cupActivationStatusChecker.checkCurrentSeasonActivationStatus())
        .rejects.toThrow('Unable to fetch current season data');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Unexpected error'))
          })
        })
      });

      await expect(cupActivationStatusChecker.checkCurrentSeasonActivationStatus())
        .rejects.toThrow('Unexpected error while checking activation status');
    });
  });

  describe('checkSeasonActivationStatus', () => {
    it('should return activated status for specific season when cup is activated', async () => {
      const mockSeason = {
        id: 2,
        name: '2023/24',
        last_round_special_activated: true,
        last_round_special_activated_at: '2024-03-15T14:30:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(2);

      expect(result).toEqual({
        isActivated: true,
        activatedAt: '2024-03-15T14:30:00Z',
        seasonId: 2,
        seasonName: '2023/24'
      });
    });

    it('should return not activated status for specific season when cup is not activated', async () => {
      const mockSeason = {
        id: 2,
        name: '2023/24',
        last_round_special_activated: false,
        last_round_special_activated_at: null
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(2);

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: 2,
        seasonName: '2023/24'
      });
    });

    it('should return default values when season is not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(999);

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: 999,
        seasonName: null
      });
    });

    it('should throw error for invalid season ID', async () => {
      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(0))
        .rejects.toThrow('Valid season ID is required');

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(-1))
        .rejects.toThrow('Valid season ID is required');

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(null as unknown as number))
        .rejects.toThrow('Valid season ID is required');
    });

    it('should throw error when database query fails for specific season', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Season not accessible' }
            })
          })
        })
      });

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(5))
        .rejects.toThrow('Unable to fetch season 5 data');
    });

    it('should handle unexpected errors for specific season gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network timeout'))
          })
        })
      });

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(3))
        .rejects.toThrow('Unexpected error while checking activation status');
    });
  });

  describe('isCurrentSeasonCupActivated', () => {
    it('should return true when current season cup is activated', async () => {
      const mockSeason = {
        id: 1,
        name: '2024/25',
        last_round_special_activated: true,
        last_round_special_activated_at: '2025-01-27T10:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(true);
    });

    it('should return false when current season cup is not activated', async () => {
      const mockSeason = {
        id: 1,
        name: '2024/25',
        last_round_special_activated: false,
        last_round_special_activated_at: null
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(false);
    });

    it('should return false when no current season exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(false);
    });
  });

  describe('isSeasonCupActivated', () => {
    it('should return true when specified season cup is activated', async () => {
      const mockSeason = {
        id: 3,
        name: '2022/23',
        last_round_special_activated: true,
        last_round_special_activated_at: '2023-04-10T16:20:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isSeasonCupActivated(3);
      expect(result).toBe(true);
    });

    it('should return false when specified season cup is not activated', async () => {
      const mockSeason = {
        id: 3,
        name: '2022/23',
        last_round_special_activated: false,
        last_round_special_activated_at: null
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSeason,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isSeasonCupActivated(3);
      expect(result).toBe(false);
    });

    it('should return false when specified season does not exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await cupActivationStatusChecker.isSeasonCupActivated(999);
      expect(result).toBe(false);
    });
  });
}); 