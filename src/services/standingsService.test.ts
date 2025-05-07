import { calculateStandings, UserPoints } from './standingsService';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

// Mock the Supabase service role client and logger
jest.mock('@/utils/supabase/service', () => ({
  getSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRpc = jest.fn();

describe('Standings Service', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (getSupabaseServiceRoleClient as jest.Mock).mockReturnValue({ rpc: mockRpc });
  });

  describe('calculateStandings', () => {
    it('should return null if aggregation fails', async () => {
      mockRpc.mockResolvedValueOnce({ error: new Error('RPC Error'), data: null });
      const result = await calculateStandings();
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: new Error('RPC Error') }), 'Error calling get_user_total_points RPC.');
      expect(logger.error).toHaveBeenCalledWith('Standings calculation failed because user points could not be aggregated.');
    });

    it('should correctly calculate standings for multiple users with ties', async () => {
      const mockUserPointsRpcData: UserPoints[] = [
        { user_id: 'user1', total_points: 100 },
        { user_id: 'user2', total_points: 150 },
        { user_id: 'user3', total_points: 100 },
        { user_id: 'user4', total_points: 200 },
        { user_id: 'user5', total_points: 150 },
      ];
      mockRpc.mockResolvedValueOnce({ error: null, data: mockUserPointsRpcData });

      const result = await calculateStandings();

      expect(result).toEqual([
        { user_id: 'user4', total_points: 200, rank: 1 },
        { user_id: 'user2', total_points: 150, rank: 2 },
        { user_id: 'user5', total_points: 150, rank: 2 },
        { user_id: 'user1', total_points: 100, rank: 4 },
        { user_id: 'user3', total_points: 100, rank: 4 },
      ]);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 5 }), 'Successfully aggregated points via RPC.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 5 }), 'Successfully sorted user points.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ rankedUserCount: 5 }), 'Successfully assigned ranks to users.');
      expect(logger.info).toHaveBeenCalledWith('Standings calculation complete.');
    });

    it('should handle an empty array of user points from RPC', async () => {
      mockRpc.mockResolvedValueOnce({ error: null, data: [] });
      const result = await calculateStandings();
      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 0 }), 'Successfully aggregated points via RPC.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 0 }), 'Successfully sorted user points.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ rankedUserCount: 0 }), 'Successfully assigned ranks to users.');
    });

    it('should handle a single user', async () => {
      const mockUserPointsRpcData = [{ user_id: 'user1', total_points: 50 }];
      mockRpc.mockResolvedValueOnce({ error: null, data: mockUserPointsRpcData });
      const result = await calculateStandings();
      expect(result).toEqual([{ user_id: 'user1', total_points: 50, rank: 1 }]);
    });

    it('should assign rank 1 to all users if all have the same score', async () => {
      const mockUserPointsRpcData = [
        { user_id: 'user1', total_points: 75 },
        { user_id: 'user2', total_points: 75 },
        { user_id: 'user3', total_points: 75 },
      ];
      mockRpc.mockResolvedValueOnce({ error: null, data: mockUserPointsRpcData });
      const result = await calculateStandings();
      expect(result).toEqual([
        { user_id: 'user1', total_points: 75, rank: 1 },
        { user_id: 'user2', total_points: 75, rank: 1 },
        { user_id: 'user3', total_points: 75, rank: 1 },
      ]);
    });

    it('should correctly rank users with zero points', async () => {
      const mockUserPointsRpcData = [
        { user_id: 'user1', total_points: 10 },
        { user_id: 'user2', total_points: 0 },
        { user_id: 'user3', total_points: 5 },
        { user_id: 'user4', total_points: 0 },
      ];
      mockRpc.mockResolvedValueOnce({ error: null, data: mockUserPointsRpcData });
      const result = await calculateStandings();
      expect(result).toEqual([
        { user_id: 'user1', total_points: 10, rank: 1 },
        { user_id: 'user3', total_points: 5, rank: 2 },
        { user_id: 'user2', total_points: 0, rank: 3 },
        { user_id: 'user4', total_points: 0, rank: 3 },
      ]);
    });

    // Test case to ensure Number conversion is happening correctly if RPC returns stringified numbers
    it('should handle total_points from RPC as strings or numbers', async () => {
      const mockRpcDataWithStringPoints = [
        { user_id: 'userA', total_points: '120' }, // Points as string
        { user_id: 'userB', total_points: 90 },    // Points as number
      ];
      // The test still validates the runtime conversion logic.
      // The mockRpc function, being a jest.fn(), might be flexible enough to accept this data structure
      // for testing purposes without a specific cast if its generic type isn't strictly UserPoints[].
      mockRpc.mockResolvedValueOnce({ error: null, data: mockRpcDataWithStringPoints });

      const result = await calculateStandings();
      expect(result).toEqual([
        { user_id: 'userA', total_points: 120, rank: 1 },
        { user_id: 'userB', total_points: 90, rank: 2 },
      ]);
    });

  });
}); 