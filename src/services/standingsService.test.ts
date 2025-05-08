import { calculateStandings, calculateStandingsWithDynamicPoints, UserPoints, getUserDynamicQuestionnairePoints } from './standingsService';
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

// Mock the getUserDynamicQuestionnairePoints function
jest.mock('./standingsService', () => {
  const originalModule = jest.requireActual('./standingsService');
  return {
    ...originalModule,
    getUserDynamicQuestionnairePoints: jest.fn(),
  };
});

// Get the mock function for type safety
const mockGetUserDynamicQuestionnairePoints = getUserDynamicQuestionnairePoints as jest.MockedFunction<typeof getUserDynamicQuestionnairePoints>;
const mockRpc = jest.fn();

describe('Standings Service', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (getSupabaseServiceRoleClient as jest.Mock).mockReturnValue({ rpc: mockRpc });
    
    // Default to returning an empty map, tests can override
    mockGetUserDynamicQuestionnairePoints.mockResolvedValue(new Map<string, number>());
  });

  describe('calculateStandings integration tests', () => {
    it('should return null if aggregation fails', async () => {
      mockRpc.mockResolvedValueOnce({ error: new Error('RPC Error'), data: null });
      const result = await calculateStandings();
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: new Error('RPC Error') }), 'Error calling get_user_total_points RPC.');
      expect(logger.error).toHaveBeenCalledWith('Standings calculation failed because user game points could not be aggregated.');
    });

    it('should return null if getUserDynamicQuestionnairePoints returns null', async () => {
      // Mock Game Points (via RPC) - provide some valid data
      const mockUserPointsRpcData = [
        { user_id: 'user1', total_points: 100 },
      ];
      mockRpc.mockResolvedValueOnce({ error: null, data: mockUserPointsRpcData });

      // Mock Dynamic Points Fetch Failure
      mockGetUserDynamicQuestionnairePoints.mockResolvedValueOnce(null);

      const result = await calculateStandings();

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Standings calculation failed because dynamic points could not be fetched.');
    });
  });

  // New test suite for the extracted function
  describe('calculateStandingsWithDynamicPoints', () => {
    it('should correctly calculate standings for multiple users with ties', async () => {
      // Mock Game Points
      const mockUserPointsData: UserPoints[] = [
        { user_id: 'user1', total_points: 100 },
        { user_id: 'user2', total_points: 150 },
        { user_id: 'user3', total_points: 100 },
        { user_id: 'user4', total_points: 200 },
        { user_id: 'user5', total_points: 150 },
      ];

      // Mock Dynamic Points
      const mockDynamicPoints = new Map<string, number>([
        ['user1', 10],
        ['user2', 5],
        ['user3', 12],
        ['user4', 0],
        // user5 deliberately omitted, should default to 0
      ]);

      const result = await calculateStandingsWithDynamicPoints(mockUserPointsData, mockDynamicPoints);

      // Assert against new structure and combined scores
      expect(result).toEqual([
        { user_id: 'user4', game_points: 200, dynamic_points: 0,  combined_total_score: 200, rank: 1 },
        { user_id: 'user2', game_points: 150, dynamic_points: 5,  combined_total_score: 155, rank: 2 },
        { user_id: 'user5', game_points: 150, dynamic_points: 0,  combined_total_score: 150, rank: 3 },
        { user_id: 'user3', game_points: 100, dynamic_points: 12, combined_total_score: 112, rank: 4 },
        { user_id: 'user1', game_points: 100, dynamic_points: 10, combined_total_score: 110, rank: 5 },
      ]);

      // Keep logger checks if still relevant
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ dynamicMapSize: 4 }), 'Successfully fetched dynamic points map.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 5 }), 'Successfully merged game and dynamic points.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 5 }), 'Successfully sorted users by combined score.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ rankedUserCount: 5 }), 'Successfully assigned ranks to users based on combined score.');
      expect(logger.info).toHaveBeenCalledWith('Standings calculation complete.');
    });

    it('should handle an empty array of user points', async () => {
      const result = await calculateStandingsWithDynamicPoints([], new Map<string, number>());
      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ dynamicMapSize: 0 }), 'Successfully fetched dynamic points map.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 0 }), 'Successfully merged game and dynamic points.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userCount: 0 }), 'Successfully sorted users by combined score.');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ rankedUserCount: 0 }), 'Successfully assigned ranks to users based on combined score.');
    });

    it('should handle a single user', async () => {
      const mockUserPointsData = [{ user_id: 'user1', total_points: 50 }];
      const mockDynamicPoints = new Map<string, number>([['user1', 7]]);
      
      const result = await calculateStandingsWithDynamicPoints(mockUserPointsData, mockDynamicPoints);
      
      expect(result).toEqual([
        { user_id: 'user1', game_points: 50, dynamic_points: 7, combined_total_score: 57, rank: 1 }
      ]);
    });

    it('should assign rank 1 to all users if all have the same score', async () => {
      const mockUserPointsData = [
        { user_id: 'user1', total_points: 75 },
        { user_id: 'user2', total_points: 75 },
        { user_id: 'user3', total_points: 75 },
      ];
      
      const mockDynamicPoints = new Map<string, number>([
        ['user1', 10],
        ['user2', 10],
        ['user3', 10],
      ]);
      
      const result = await calculateStandingsWithDynamicPoints(mockUserPointsData, mockDynamicPoints);
      
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ user_id: 'user1', game_points: 75, dynamic_points: 10, combined_total_score: 85, rank: 1 }),
        expect.objectContaining({ user_id: 'user2', game_points: 75, dynamic_points: 10, combined_total_score: 85, rank: 1 }),
        expect.objectContaining({ user_id: 'user3', game_points: 75, dynamic_points: 10, combined_total_score: 85, rank: 1 }),
      ]));
      expect(result?.length).toBe(3);
    });

    it('should correctly rank users with zero points', async () => {
      const mockUserPointsData = [
        { user_id: 'user1', total_points: 10 },
        { user_id: 'user2', total_points: 0 },
        { user_id: 'user3', total_points: 5 },
        { user_id: 'user4', total_points: 0 },
      ];
      
      const mockDynamicPoints = new Map<string, number>([
        ['user1', 5],
        ['user2', 8],
        ['user3', 0],
        ['user4', 0],
      ]);
      
      const result = await calculateStandingsWithDynamicPoints(mockUserPointsData, mockDynamicPoints);
      
      expect(result).toEqual([
        { user_id: 'user1', game_points: 10, dynamic_points: 5, combined_total_score: 15, rank: 1 },
        { user_id: 'user2', game_points: 0, dynamic_points: 8, combined_total_score: 8, rank: 2 },
        { user_id: 'user3', game_points: 5, dynamic_points: 0, combined_total_score: 5, rank: 3 },
        { user_id: 'user4', game_points: 0, dynamic_points: 0, combined_total_score: 0, rank: 4 },
      ]);
    });

    it('should return null if dynamicPointsMap is null', async () => {
      const mockUserPointsData = [{ user_id: 'user1', total_points: 100 }];
      
      const result = await calculateStandingsWithDynamicPoints(mockUserPointsData, null);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Standings calculation failed because dynamic points could not be fetched.');
    });
  });
});

// For the getUserDynamicQuestionnairePoints tests, we need to use a different approach
// since we've mocked the function itself
describe('getUserDynamicQuestionnairePoints Tests', () => {
  // We need to get the original implementation to test it
  const originalGetUserDynamicQuestionnairePoints = jest.requireActual('./standingsService').getUserDynamicQuestionnairePoints;
  
  // Define mocks for the Supabase client
  const mockBettingRoundsSingle = jest.fn();
  const mockDynamicPointsEq = jest.fn();
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockBettingRoundsSingle.mockReset();
    mockDynamicPointsEq.mockReset();
    
    // Set up the Supabase client mock
    (getSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'betting_rounds') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: mockBettingRoundsSingle
                  })
                })
              })
            })
          };
        }
        
        if (tableName === 'user_round_dynamic_points') {
          return {
            select: jest.fn().mockReturnValue({
              eq: mockDynamicPointsEq
            })
          };
        }
        
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: new Error(`Unexpected table ${tableName}`)
            }),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error(`Unexpected table ${tableName}`)
            })
          })
        };
      })
    });
  });
  
  it('should return a map of user points for the latest scored round', async () => {
    const mockRoundId = 101;
    mockBettingRoundsSingle.mockResolvedValueOnce({
      data: { id: mockRoundId, scored_at: new Date().toISOString() },
      error: null
    });
    
    const mockPointsData = [
      { user_id: 'user1', total_points: 10 },
      { user_id: 'user2', total_points: 5 }
    ];
    mockDynamicPointsEq.mockResolvedValueOnce({ data: mockPointsData, error: null });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeInstanceOf(Map);
    expect(result?.size).toBe(2);
    expect(result?.get('user1')).toBe(10);
    expect(result?.get('user2')).toBe(5);
  });
  
  it('should return an empty map if no scored rounds are found', async () => {
    mockBettingRoundsSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeInstanceOf(Map);
    expect(result?.size).toBe(0);
  });
  
  it('should return an empty map if a scored round is found but has no dynamic points entries', async () => {
    mockBettingRoundsSingle.mockResolvedValueOnce({
      data: { id: 102, scored_at: new Date().toISOString() },
      error: null
    });
    mockDynamicPointsEq.mockResolvedValueOnce({ data: [], error: null });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeInstanceOf(Map);
    expect(result?.size).toBe(0);
  });
  
  it('should return null if fetching betting rounds fails (non-PGRST116 error)', async () => {
    const dbError = new Error('DB connection error');
    mockBettingRoundsSingle.mockResolvedValueOnce({ data: null, error: dbError });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: dbError }),
      'Error fetching most recently scored round.'
    );
  });
  
  it('should return null if fetching dynamic points fails', async () => {
    const mockRoundId = 103;
    mockBettingRoundsSingle.mockResolvedValueOnce({
      data: { id: mockRoundId, scored_at: new Date().toISOString() },
      error: null
    });
    
    const dbError = new Error('DB error fetching points');
    mockDynamicPointsEq.mockResolvedValueOnce({ data: null, error: dbError });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: dbError, roundId: mockRoundId }),
      'Error fetching dynamic points for round.'
    );
  });
  
  it('should skip entries with missing user_id or non-numeric total_points and log a warning', async () => {
    mockBettingRoundsSingle.mockResolvedValueOnce({
      data: { id: 104, scored_at: new Date().toISOString() },
      error: null
    });
    
    const mockPointsData = [
      { user_id: 'user1', total_points: 10 },
      { user_id: null, total_points: 5 }, // Missing user_id
      { user_id: 'user3', total_points: 'invalid' }, // Non-numeric total_points
      { user_id: 'user4', total_points: 7 }
    ];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDynamicPointsEq.mockResolvedValueOnce({ data: mockPointsData as any, error: null });
    
    const result = await originalGetUserDynamicQuestionnairePoints();
    
    expect(result).toBeInstanceOf(Map);
    expect(result?.size).toBe(2);
    expect(result?.get('user1')).toBe(10);
    expect(result?.get('user4')).toBe(7);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});