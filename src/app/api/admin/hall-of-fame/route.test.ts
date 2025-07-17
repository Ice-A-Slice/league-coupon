/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

const mockGetSupabaseServiceRoleClient = getSupabaseServiceRoleClient as jest.MockedFunction<typeof getSupabaseServiceRoleClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock environment variable
const originalEnv = process.env;

// TODO: Re-enable once dev database is set up - these tests need real DB integration
describe('/api/admin/hall-of-fame - Admin Hall of Fame Management API', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  const mockQuery = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabase as never);
    
    // Chain all query methods
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.insert.mockReturnValue(mockQuery);
    mockQuery.update.mockReturnValue(mockQuery);
    mockQuery.delete.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.range.mockReturnValue(mockQuery);
    mockQuery.order.mockReturnValue(mockQuery);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (
    method: string,
    searchParams: Record<string, string> = {},
    body: unknown = null,
    authHeader?: string,
    cronSecret?: string
  ) => {
    const url = new URL('http://localhost/api/admin/hall-of-fame');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const request = new NextRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'content-type': 'application/json',
        ...(authHeader && { 'authorization': authHeader }),
        ...(cronSecret && { 'x-cron-secret': cronSecret }),
      }
    });

    return request;
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
    }
  ];

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Admin HallOfFame API: Unauthorized access attempt',
        expect.any(Object)
      );
    });

    it('should accept Bearer token authentication', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 1,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept X-Cron-Secret header authentication', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 1,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest('GET', {}, null, undefined, 'test-secret');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should reject invalid authentication tokens', async () => {
      const request = createMockRequest('GET', {}, null, 'Bearer wrong-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle missing CRON_SECRET configuration', async () => {
      delete process.env.CRON_SECRET;

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Admin HallOfFame API: CRON_SECRET not configured'
      );
    });
  });

  describe('GET /api/admin/hall-of-fame', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should return Hall of Fame data with default parameters', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 1,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.pagination).toEqual({
        offset: 0,
        limit: 50,
        total: 1,
        count: 1
      });

      expect(mockQuery.range).toHaveBeenCalledWith(0, 49);
    });

    it('should handle filters correctly', async () => {
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

      const request = createMockRequest('GET', {
        competition_id: '39',
        season_id: '1',
        user_id: 'user-1',
        sort: 'points_desc'
      }, null, 'Bearer test-secret');
      
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('season.competition.id', '39');
      expect(mockQuery.eq).toHaveBeenCalledWith('season_id', '1');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQuery.order).toHaveBeenCalledWith('total_points', { ascending: false });
    });

    it('should enforce maximum limit', async () => {
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

      const request = createMockRequest('GET', { limit: '300' }, null, 'Bearer test-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(200); // Max limit enforced
      expect(mockQuery.range).toHaveBeenCalledWith(0, 199);
    });
  });

  describe('POST /api/admin/hall-of-fame', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    const mockSeason = {
      id: 1,
      name: 'Premier League 2022/23',
      competition_id: 39
    };

    const mockUser = {
      id: 'user-1',
      full_name: 'John Doe'
    };

    it('should create a new Hall of Fame entry', async () => {
      // Mock season check
      mockQuery.single.mockResolvedValueOnce({
        data: mockSeason,
        error: null
      });

      // Mock user check
      mockQuery.single.mockResolvedValueOnce({
        data: mockUser,
        error: null
      });

      // Mock existing winner check (none exists)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' }
      });

      // Mock insert
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData[0],
        error: null
      });

      const requestBody = {
        season_id: 1,
        user_id: 'user-1',
        total_points: 150,
        game_points: 120,
        dynamic_points: 30
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockHallOfFameData[0]);
      expect(data.operation).toBe('created');
      expect(data.season).toEqual(mockSeason);
      expect(data.user).toEqual(mockUser);

      expect(mockQuery.insert).toHaveBeenCalledWith([{
        season_id: 1,
        user_id: 'user-1',
        league_id: 39,
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        created_at: expect.any(String)
      }]);
    });

    it('should update existing winner when override_existing is true', async () => {
      // Mock season check
      mockQuery.single.mockResolvedValueOnce({
        data: mockSeason,
        error: null
      });

      // Mock user check
      mockQuery.single.mockResolvedValueOnce({
        data: mockUser,
        error: null
      });

      // Mock existing winner check (winner exists)
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 1 },
        error: null
      });

      // Mock update
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData[0],
        error: null
      });

      const requestBody = {
        season_id: 1,
        user_id: 'user-1',
        total_points: 160,
        override_existing: true
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.operation).toBe('updated');
      expect(mockQuery.update).toHaveBeenCalled();
    });

    it('should reject when winner already exists without override', async () => {
      // Mock season check
      mockQuery.single.mockResolvedValueOnce({
        data: mockSeason,
        error: null
      });

      // Mock user check
      mockQuery.single.mockResolvedValueOnce({
        data: mockUser,
        error: null
      });

      // Mock existing winner check (winner exists)
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 1 },
        error: null
      });

      const requestBody = {
        season_id: 1,
        user_id: 'user-1',
        total_points: 150
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Winner already exists');
    });

    it('should validate required fields', async () => {
      const requestBody = {
        season_id: 1,
        // missing user_id and total_points
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should handle non-existent season', async () => {
      // Mock season check (not found)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' }
      });

      const requestBody = {
        season_id: 999,
        user_id: 'user-1',
        total_points: 150
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Season not found');
    });

    it('should handle non-existent user', async () => {
      // Mock season check
      mockQuery.single.mockResolvedValueOnce({
        data: mockSeason,
        error: null
      });

      // Mock user check (not found)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' }
      });

      const requestBody = {
        season_id: 1,
        user_id: 'non-existent-user',
        total_points: 150
      };

      const request = createMockRequest('POST', {}, requestBody, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });
  });

  describe('DELETE /api/admin/hall-of-fame', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should delete winner by winner_id', async () => {
      // Mock find winner
      mockQuery.single.mockResolvedValueOnce({
        data: mockHallOfFameData[0],
        error: null
      });

      // Mock delete
      mockQuery.delete.mockResolvedValue({
        error: null
      });

      const requestBody = {
        winner_id: 1
      };

      const request = createMockRequest('DELETE', {}, requestBody, 'Bearer test-secret');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Winner deleted successfully');
      expect(data.deleted_winner).toEqual(mockHallOfFameData[0]);

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1);
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    it('should delete winner by season_id', async () => {
      // Mock find winner
      mockQuery.single.mockResolvedValueOnce({
        data: mockHallOfFameData[0],
        error: null
      });

      // Mock delete
      mockQuery.delete.mockResolvedValue({
        error: null
      });

      const requestBody = {
        season_id: 1
      };

      const request = createMockRequest('DELETE', {}, requestBody, 'Bearer test-secret');
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('season_id', 1);
    });

    it('should require either winner_id or season_id', async () => {
      const requestBody = {}; // missing both

      const request = createMockRequest('DELETE', {}, requestBody, 'Bearer test-secret');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Either winner_id or season_id must be provided');
    });

    it('should handle non-existent winner', async () => {
      // Mock find winner (not found)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' }
      });

      const requestBody = {
        winner_id: 999
      };

      const request = createMockRequest('DELETE', {}, requestBody, 'Bearer test-secret');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Winner not found');
    });

    it('should handle delete errors', async () => {
      // Mock find winner
      mockQuery.single.mockResolvedValueOnce({
        data: mockHallOfFameData[0],
        error: null
      });

      // Mock delete error
      mockQuery.delete.mockResolvedValue({
        error: { message: 'Delete failed', code: 'PGRST500' }
      });

      const requestBody = {
        winner_id: 1
      };

      const request = createMockRequest('DELETE', {}, requestBody, 'Bearer test-secret');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete winner');
      expect(data.details).toBe('Delete failed');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should handle database errors in GET', async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'PGRST301'
        },
        count: null
      });

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
      expect(data.details).toBe('Database connection failed');
    });

    it('should handle unexpected errors', async () => {
      // The admin API makes two separate queries - we need to mock the first one to throw
      // and not execute the second one
      const errorQuery = {
        select: jest.fn().mockRejectedValue(new Error('Unexpected error')),
        range: jest.fn(),
        order: jest.fn(),
        eq: jest.fn(),
      };
      
      errorQuery.select.mockReturnValue(errorQuery);
      errorQuery.range.mockReturnValue(errorQuery);
      errorQuery.order.mockReturnValue(errorQuery);
      errorQuery.eq.mockReturnValue(errorQuery);
      
      // Only mock the first .from() call to return our error query
      mockSupabase.from.mockReturnValueOnce(errorQuery);

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      
      // Verify that the error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Admin HallOfFame API: Unexpected error',
        expect.objectContaining({
          error: 'Unexpected error'
        })
      );
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should log successful operations', async () => {
      mockQuery.select.mockResolvedValue({
        data: mockHallOfFameData,
        error: null,
        count: null
      });

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({
          count: 1,
          error: null
        })
      };
      mockSupabase.from.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockCountQuery);

      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      await GET(request);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Admin HallOfFame API: Processing GET request',
        expect.objectContaining({
          method: 'GET',
          timestamp: expect.any(String)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Admin HallOfFame API: GET request completed',
        expect.objectContaining({
          resultCount: 1,
          totalCount: 1,
          processingTime: expect.any(Number)
        })
      );
    });
  });
}); 