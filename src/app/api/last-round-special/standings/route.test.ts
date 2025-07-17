import { NextRequest } from 'next/server';
import { GET } from './route';
import { getCupStandings } from '@/services/cup/cupScoringService';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Mock the dependencies
jest.mock('@/services/cup/cupScoringService');
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');

const mockGetCupStandings = getCupStandings as jest.MockedFunction<typeof getCupStandings>;
const mockGetSupabaseServiceRoleClient = getSupabaseServiceRoleClient as jest.MockedFunction<typeof getSupabaseServiceRoleClient>;

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
};

// TODO: Re-enable once NextRequest mocking is properly configured
describe('/api/last-round-special/standings - Cup Standings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabaseClient as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/last-round-special/standings');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url.toString());
  };

  const mockStandingsData = [
    {
      userId: 'user-1',
      userName: 'John Doe',
      totalPoints: 150,
      roundsParticipated: 10,
      position: 1,
      lastUpdated: '2024-01-15T10:00:00Z'
    },
    {
      userId: 'user-2',
      userName: 'Jane Smith',
      totalPoints: 140,
      roundsParticipated: 9,
      position: 2,
      lastUpdated: '2024-01-15T10:00:00Z'
    },
    {
      userId: 'user-3',
      userName: 'Bob Wilson',
      totalPoints: 130,
      roundsParticipated: 8,
      position: 3,
      lastUpdated: '2024-01-15T10:00:00Z'
    }
  ];

  const mockProfilesData = [
    {
      id: 'user-1',
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar1.jpg'
    },
    {
      id: 'user-2',
      full_name: 'Jane Smith',
      avatar_url: null
    },
    {
      id: 'user-3',
      full_name: 'Bob Wilson',
      avatar_url: 'https://example.com/avatar3.jpg'
    }
  ];

  describe('GET /api/last-round-special/standings', () => {
    it('should return cup standings with default pagination', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request
      const request = createMockRequest();

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(3);
      expect(data.data[0]).toMatchObject({
        user_id: 'user-1',
        user: {
          id: 'user-1',
          full_name: 'John Doe',
          avatar_url: 'https://example.com/avatar1.jpg'
        },
        total_points: 150,
        rounds_participated: 10,
        position: 1
      });

      // Check pagination metadata
      expect(data.pagination).toMatchObject({
        total_items: 3,
        total_pages: 1,
        current_page: 1,
        page_size: 50,
        has_more: false
      });

      // Verify service was called
      expect(mockGetCupStandings).toHaveBeenCalledWith(undefined);
    });

    it('should return cup standings with custom pagination', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request with pagination
      const request = createMockRequest({ limit: '2', offset: '1' });

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // Limited to 2 results
      expect(data.data[0].user_id).toBe('user-2'); // Offset by 1

      expect(data.pagination).toMatchObject({
        total_items: 3,
        total_pages: 2,
        current_page: 1,
        page_size: 2,
        has_more: true
      });
    });

    it('should handle custom sorting by points descending', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request with sorting
      const request = createMockRequest({ sort: 'points_desc' });

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data[0].total_points).toBe(150); // Highest points first
      expect(data.data[1].total_points).toBe(140);
      expect(data.data[2].total_points).toBe(130);
      expect(data.query_info.sort).toBe('points_desc');
    });

    it('should handle specific season filter', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request with season filter
      const request = createMockRequest({ season_id: '5' });

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.query_info.season_id).toBe(5);

      // Verify service was called with season ID
      expect(mockGetCupStandings).toHaveBeenCalledWith(5);
    });

    it('should return empty results when no standings data exists', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue([]);

      // Create request
      const request = createMockRequest();

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
      expect(data.pagination.total_items).toBe(0);
      expect(data.metadata.message).toContain('No cup standings data available');
    });

    it('should handle profile fetch errors gracefully', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });

      // Create request
      const request = createMockRequest();

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(3);
      
      // Should fall back to basic user info without avatars
      expect(data.data[0].user).toMatchObject({
        id: 'user-1',
        full_name: 'John Doe',
        avatar_url: null
      });
    });

    it('should handle invalid sort parameter', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);

      // Create request with invalid sort
      const request = createMockRequest({ sort: 'invalid_sort' });

      // Execute and expect error
      await expect(GET(request)).rejects.toThrow('Invalid sort parameter');
    });

    it('should handle cup scoring service errors', async () => {
      // Setup mocks
      mockGetCupStandings.mockRejectedValue(new Error('Cup scoring service failed'));

      // Create request
      const request = createMockRequest();

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
      expect(data.metadata).toBeDefined();
    });

    it('should include proper cache headers', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request
      const request = createMockRequest();

      // Execute
      const response = await GET(request);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('max-age=60'); // LIVE_DATA strategy
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=120');
    });

    it('should validate pagination limits', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request with limit exceeding maximum
      const request = createMockRequest({ limit: '200' });

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.pagination.page_size).toBe(100); // Should be capped at max limit
    });

    it('should include metadata and query info in response', async () => {
      // Setup mocks
      mockGetCupStandings.mockResolvedValue(mockStandingsData);
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        select: jest.fn().mockReturnValue({
          ...mockSupabaseClient,
          in: jest.fn().mockResolvedValue({
            data: mockProfilesData,
            error: null
          })
        })
      });

      // Create request
      const request = createMockRequest({ sort: 'points_desc', season_id: '3' });

      // Execute
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.query_info).toMatchObject({
        sort: 'points_desc',
        season_id: 3,
        request_time_ms: expect.any(Number)
      });
      expect(data.metadata).toMatchObject({
        requestId: expect.any(String),
        timestamp: expect.any(String),
        participantCount: 3,
        processingTime: expect.any(Number)
      });
    });
  });
}); 