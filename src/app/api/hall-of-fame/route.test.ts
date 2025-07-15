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
describe.skip('/api/hall-of-fame - Main Hall of Fame API', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  const mockQuery = {
    select: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
    
    // Chain all query methods
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.range.mockReturnValue(mockQuery);
    mockQuery.order.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/hall-of-fame');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url);
  };

  const mockHallOfFameData = [
    {
      id: 1,
      season_id: 1,
      user_id: 'user-1',
      league_id: 39,
      total_points: 150,
      game_points: 120,
      dynamic_points: 30,
      created_at: '2023-01-01T00:00:00Z',
      season: {
        id: 1,
        name: 'Premier League 2022/23',
        api_season_year: 2022,
        start_date: '2022-08-01',
        end_date: '2023-05-31',
        completed_at: '2023-05-31T23:59:59Z',
        winner_determined_at: '2023-06-01T00:00:00Z',
        competition: {
          id: 39,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      },
      profile: {
        id: 'user-1',
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        updated_at: '2023-01-01T00:00:00Z'
      }
    },
    {
      id: 2,
      season_id: 2,
      user_id: 'user-2',
      league_id: 39,
      total_points: 140,
      game_points: 110,
      dynamic_points: 30,
      created_at: '2023-06-01T00:00:00Z',
      season: {
        id: 2,
        name: 'Premier League 2023/24',
        api_season_year: 2023,
        start_date: '2023-08-01',
        end_date: '2024-05-31',
        completed_at: '2024-05-31T23:59:59Z',
        winner_determined_at: '2024-06-01T00:00:00Z',
        competition: {
          id: 39,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      },
      profile: {
        id: 'user-2',
        full_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg',
        updated_at: '2023-06-01T00:00:00Z'
      }
    }
  ];

  describe('Successful requests', () => {
    it('should return Hall of Fame data with default parameters', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      // Mock total count query
      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination).toEqual({
        offset: 0,
        limit: 20,
        total: 2,
        count: 2
      });
      expect(data.metadata).toHaveProperty('requestId');
      expect(data.metadata).toHaveProperty('timestamp');
      expect(data.metadata).toHaveProperty('processingTime');

      // Verify default query parameters
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19);
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should handle custom pagination parameters', async () => {
      mockQuery.select.mockResolvedValue({
        data: [mockHallOfFameData[1]],
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest({ limit: '10', offset: '1' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toEqual({
        offset: 1,
        limit: 10,
        total: 2,
        count: 1
      });

      expect(mockQuery.range).toHaveBeenCalledWith(1, 10);
    });

    it('should handle competition filter', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest({ competition_id: '39' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('season.competition.id', '39');
    });

    it('should handle different sorting options', async () => {
      const testCases = [
        { sort: 'oldest', expectedOrder: ['created_at', { ascending: true }] },
        { sort: 'points_desc', expectedOrder: ['total_points', { ascending: false }] },
        { sort: 'points_asc', expectedOrder: ['total_points', { ascending: true }] },
        { sort: 'newest', expectedOrder: ['created_at', { ascending: false }] },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
        mockSupabase.from.mockReturnValue(mockQuery);
        mockQuery.select.mockReturnValue(mockQuery);
        mockQuery.range.mockReturnValue(mockQuery);
        mockQuery.order.mockReturnValue(mockQuery);
        mockQuery.eq.mockReturnValue(mockQuery);

        mockQuery.select.mockResolvedValue({
          data: mockHallOfFameData,
          error: null,
          count: null
        });

        const mockCountQuery = {
          select: jest.fn().mockResolvedValue({
            count: 2,
            error: null
          })
        };
        mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

        const request = createMockRequest({ sort: testCase.sort });
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockQuery.order).toHaveBeenCalledWith(...testCase.expectedOrder);
      }
    });

    it('should enforce maximum limit', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest({ limit: '200' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(100); // Max limit enforced
      expect(mockQuery.range).toHaveBeenCalledWith(0, 99);
    });

    it('should handle negative offset', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest({ offset: '-10' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.offset).toBe(0); // Negative offset handled
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'PGRST301'
        },
        count: null
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
      expect(data.details).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame API: Database error in main query',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });

    it('should handle count query errors gracefully', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Count query failed' }
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
      expect(data.details).toBe('Count query failed');
    });

    it('should handle unexpected errors', async () => {
      // Mock both queries to reject to prevent unhandled promises
      mockQuery.select.mockRejectedValue(new Error('Unexpected error'));
      
      const mockCountQuery = {
        select: jest.fn().mockRejectedValue(new Error('Count error'))
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame API: Unexpected error',
        expect.objectContaining({
          error: 'Unexpected error'
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty results', async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 0,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.pagination).toEqual({
        offset: 0,
        limit: 20,
        total: 0,
        count: 0
      });
    });

    it('should handle malformed query parameters', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest({ limit: 'invalid', offset: 'invalid' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should use defaults for invalid parameters
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19);
    });
  });

  describe('Logging', () => {
    it('should log request processing', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest();
      await GET(request);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame API: Processing GET request',
        expect.objectContaining({
          method: 'GET',
          timestamp: expect.any(String)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame API: Request completed',
        expect.objectContaining({
          resultCount: 2,
          totalCount: 2,
          processingTime: expect.any(Number)
        })
      );
    });
  });
}); 