/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');

const mockGetSupabaseServiceRoleClient = createSupabaseServiceRoleClient as jest.MockedFunction<typeof createSupabaseServiceRoleClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('/api/hall-of-fame/season/[id] - Season-specific Hall of Fame API', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  const mockQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
    
    // Chain all query methods
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  const createMockRequest = (seasonId: string) => {
    const url = new URL(`http://localhost/api/hall-of-fame/season/${seasonId}`);
    return new NextRequest(url);
  };

  const mockSeasonWinnerData = {
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
  };

  describe('Successful requests', () => {
    it('should return season winner data for valid season ID', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockSeasonWinnerData,
        error: null
      });

      const request = createMockRequest('1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockSeasonWinnerData);
      expect(data.metadata).toHaveProperty('requestId');
      expect(data.metadata).toHaveProperty('timestamp');
      expect(data.metadata).toHaveProperty('processingTime');

      // Verify query was called with correct parameters
      expect(mockQuery.eq).toHaveBeenCalledWith('season_id', 1);
      expect(mockQuery.single).toHaveBeenCalled();
    });

    it('should handle string season ID correctly', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockSeasonWinnerData,
        error: null
      });

      const request = createMockRequest('123');
      const response = await GET(request, { params: { id: '123' } });

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('season_id', 123);
    });

    it('should return correct data structure', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockSeasonWinnerData,
        error: null
      });

      const request = createMockRequest('1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('metadata');
      expect(data.data).toHaveProperty('season');
      expect(data.data).toHaveProperty('profile');
      expect(data.data.season).toHaveProperty('competition');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for invalid season ID', async () => {
      const request = createMockRequest('invalid');
      const response = await GET(request, { params: { id: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid season ID');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Invalid season ID',
        expect.objectContaining({
          seasonId: 'invalid'
        })
      );
    });

    it('should return 400 for negative season ID', async () => {
      const request = createMockRequest('-1');
      const response = await GET(request, { params: { id: '-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid season ID');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Invalid season ID',
        expect.objectContaining({
          seasonId: '-1'
        })
      );
    });

    it('should return 400 for zero season ID', async () => {
      const request = createMockRequest('0');
      const response = await GET(request, { params: { id: '0' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid season ID');
    });

    it('should return 404 when season winner not found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: {
          message: 'No rows returned',
          code: 'PGRST116'
        }
      });

      const request = createMockRequest('999');
      const response = await GET(request, { params: { id: '999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Season winner not found');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Season winner not found',
        expect.objectContaining({
          seasonId: 999
        })
      );
    });

    it('should handle database errors', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'PGRST301'
        }
      });

      const request = createMockRequest('1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
      expect(data.details).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Database error',
        expect.objectContaining({
          error: 'Database connection failed',
          code: 'PGRST301'
        })
      );
    });

    it('should handle unexpected errors', async () => {
      mockQuery.single.mockRejectedValue(new Error('Unexpected error'));

      const request = createMockRequest('1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Unexpected error',
        expect.objectContaining({
          error: 'Unexpected error'
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle very large season IDs', async () => {
      const largeId = '9999999999';
      mockQuery.single.mockResolvedValue({
        data: null,
        error: {
          message: 'No rows returned',
          code: 'PGRST116'
        }
      });

      const request = createMockRequest(largeId);
      const response = await GET(request, { params: { id: largeId } });

      expect(response.status).toBe(404);
      expect(mockQuery.eq).toHaveBeenCalledWith('season_id', parseInt(largeId));
    });

    it('should handle floating point season IDs', async () => {
      const request = createMockRequest('1.5');
      const response = await GET(request, { params: { id: '1.5' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid season ID');
    });

    it('should handle empty season ID', async () => {
      const request = createMockRequest('');
      const response = await GET(request, { params: { id: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid season ID');
    });
  });

  describe('Logging', () => {
    it('should log successful requests', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockSeasonWinnerData,
        error: null
      });

      const request = createMockRequest('1');
      await GET(request, { params: { id: '1' } });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame Season API: Processing request',
        expect.objectContaining({
          method: 'GET',
          seasonId: 1,
          timestamp: expect.any(String)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HallOfFame Season API: Request completed',
        expect.objectContaining({
          seasonId: 1,
          found: true,
          processingTime: expect.any(Number)
        })
      );
    });

    it('should log failed requests', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: {
          message: 'No rows returned',
          code: 'PGRST116'
        }
      });

      const request = createMockRequest('999');
      await GET(request, { params: { id: '999' } });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'HallOfFame Season API: Season winner not found',
        expect.objectContaining({
          seasonId: 999
        })
      );
    });
  });

  describe('Database query structure', () => {
    it('should use correct select query with all required joins', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockSeasonWinnerData,
        error: null
      });

      const request = createMockRequest('1');
      await GET(request, { params: { id: '1' } });

      expect(mockSupabase.from).toHaveBeenCalledWith('season_winners');
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('season:seasons!inner')
      );
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('profile:profiles!inner')
      );
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('competition:competitions!inner')
      );
    });
  });
}); 