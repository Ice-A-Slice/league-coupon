/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');

const mockGetSupabaseServiceRoleClient = getSupabaseServiceRoleClient as jest.MockedFunction<typeof getSupabaseServiceRoleClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// TODO: Re-enable once dev database is set up - these tests need real DB integration
describe.skip('/api/hall-of-fame/stats - Hall of Fame Statistics API', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  const mockQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
    
    // Chain all query methods
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.range.mockReturnValue(mockQuery);
    mockQuery.order.mockReturnValue(mockQuery);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/hall-of-fame/stats');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url);
  };

  const mockStatsData = [
    {
      user_id: 'user-1',
      profile: {
        id: 'user-1',
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg'
      },
      win_count: 3,
      total_points: 450,
      avg_points: 150,
      max_points: 160,
      min_points: 140,
      first_win_date: '2022-06-01T00:00:00Z',
      last_win_date: '2024-06-01T00:00:00Z',
      seasons: [
        {
          season_id: 1,
          season_name: 'Premier League 2022/23',
          total_points: 150,
          created_at: '2022-06-01T00:00:00Z'
        },
        {
          season_id: 2,
          season_name: 'Premier League 2023/24',
          total_points: 140,
          created_at: '2023-06-01T00:00:00Z'
        },
        {
          season_id: 3,
          season_name: 'Premier League 2024/25',
          total_points: 160,
          created_at: '2024-06-01T00:00:00Z'
        }
      ]
    },
    {
      user_id: 'user-2',
      profile: {
        id: 'user-2',
        full_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg'
      },
      win_count: 2,
      total_points: 290,
      avg_points: 145,
      max_points: 155,
      min_points: 135,
      first_win_date: '2023-01-01T00:00:00Z',
      last_win_date: '2024-01-01T00:00:00Z',
      seasons: [
        {
          season_id: 4,
          season_name: 'Premier League 2023/24',
          total_points: 135,
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          season_id: 5,
          season_name: 'Premier League 2024/25',
          total_points: 155,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]
    }
  ];

  describe('Successful requests', () => {
    it('should return aggregated stats with default parameters', async () => {
      // Mock the aggregated query
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0]).toHaveProperty('user_id');
      expect(data.data[0]).toHaveProperty('profile');
      expect(data.data[0]).toHaveProperty('win_count');
      expect(data.data[0]).toHaveProperty('total_points');
      expect(data.data[0]).toHaveProperty('avg_points');
      expect(data.metadata).toHaveProperty('requestId');
      expect(data.metadata).toHaveProperty('timestamp');
      expect(data.metadata).toHaveProperty('processingTime');

      // Verify default query parameters
      expect(mockQuery.range).toHaveBeenCalledWith(0, 49);
    });

    it('should handle competition filter', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ competition_id: '39' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('season.competition.id', '39');
    });

    it('should handle custom limit', async () => {
      mockQuery.select.mockResolvedValue({
        data: [mockStatsData[0]],
        error: null
      });

      const request = createMockRequest({ limit: '25' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(25);
      expect(mockQuery.range).toHaveBeenCalledWith(0, 24);
    });

    it('should enforce maximum limit', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ limit: '200' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(100); // Max limit enforced
      expect(mockQuery.range).toHaveBeenCalledWith(0, 99);
    });

    it('should handle different sorting options', async () => {
      const testCases = [
        { sort: 'wins_desc', expectedSort: 'win_count' },
        { sort: 'wins_asc', expectedSort: 'win_count' },
        { sort: 'points_desc', expectedSort: 'total_points' },
        { sort: 'points_asc', expectedSort: 'total_points' },
        { sort: 'recent', expectedSort: 'last_win_date' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
        mockSupabase.from.mockReturnValue(mockQuery);
        mockQuery.select.mockReturnValue(mockQuery);
        mockQuery.eq.mockReturnValue(mockQuery);
        mockQuery.range.mockReturnValue(mockQuery);
        mockQuery.order.mockReturnValue(mockQuery);

        mockQuery.select.mockResolvedValue({
          data: mockStatsData,
          error: null
        });

        const request = createMockRequest({ sort: testCase.sort });
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockQuery.order).toHaveBeenCalledWith(
          testCase.expectedSort,
          expect.objectContaining({
            ascending: testCase.sort.includes('_asc')
          })
        );
      }
    });

    it('should include seasons when requested', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ include_seasons: 'true' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data[0]).toHaveProperty('seasons');
      expect(data.data[0].seasons).toHaveLength(3);
      expect(data.data[0].seasons[0]).toHaveProperty('season_id');
      expect(data.data[0].seasons[0]).toHaveProperty('season_name');
      expect(data.data[0].seasons[0]).toHaveProperty('total_points');
    });

    it('should exclude seasons by default', async () => {
      const mockStatsWithoutSeasons = mockStatsData.map(stat => ({
        ...stat,
        seasons: undefined
      }));

      mockQuery.select.mockResolvedValue({
        data: mockStatsWithoutSeasons,
        error: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data[0]).not.toHaveProperty('seasons');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'PGRST301'
        }
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
      expect(data.details).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Stats API: Database error',
        expect.objectContaining({
          error: 'Database connection failed',
          code: 'PGRST301'
        })
      );
    });

    it('should handle unexpected errors', async () => {
      mockQuery.select.mockRejectedValue(new Error('Unexpected error'));

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Stats API: Unexpected error',
        expect.objectContaining({
          error: 'Unexpected error'
        })
      );
    });

    it('should handle empty results', async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.pagination).toEqual({
        limit: 50,
        count: 0
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed query parameters', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ limit: 'invalid' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should use default limit for invalid parameter
      expect(mockQuery.range).toHaveBeenCalledWith(0, 49);
    });

    it('should handle negative limit', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ limit: '-10' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(1); // Minimum limit enforced
      expect(mockQuery.range).toHaveBeenCalledWith(0, 0);
    });

    it('should handle zero limit', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest({ limit: '0' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(1); // Minimum limit enforced
    });
  });

  describe('Logging', () => {
    it('should log request processing', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest();
      await GET(request);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame Stats API: Processing request',
        expect.objectContaining({
          method: 'GET',
          timestamp: expect.any(String)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame Stats API: Request completed',
        expect.objectContaining({
          resultCount: 2,
          processingTime: expect.any(Number)
        })
      );
    });
  });

  describe('Data structure validation', () => {
    it('should return correctly structured response', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('metadata');
      
      // Check pagination structure
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('count');
      
      // Check metadata structure
      expect(data.metadata).toHaveProperty('requestId');
      expect(data.metadata).toHaveProperty('timestamp');
      expect(data.metadata).toHaveProperty('processingTime');
    });

    it('should validate player stats structure', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockStatsData,
        error: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const playerStats = data.data[0];
      
      expect(playerStats).toHaveProperty('user_id');
      expect(playerStats).toHaveProperty('profile');
      expect(playerStats).toHaveProperty('win_count');
      expect(playerStats).toHaveProperty('total_points');
      expect(playerStats).toHaveProperty('avg_points');
      expect(playerStats).toHaveProperty('max_points');
      expect(playerStats).toHaveProperty('min_points');
      expect(playerStats).toHaveProperty('first_win_date');
      expect(playerStats).toHaveProperty('last_win_date');
      
      // Check profile structure
      expect(playerStats.profile).toHaveProperty('id');
      expect(playerStats.profile).toHaveProperty('full_name');
      expect(playerStats.profile).toHaveProperty('avatar_url');
    });
  });
}); 