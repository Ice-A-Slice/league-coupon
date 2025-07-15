import { GET } from './route';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Mock the dependencies
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      body,
      headers: {
        get: jest.fn((name: string) => {
          if (name === 'Cache-Control' && init?.headers?.['Cache-Control']) {
            return init.headers['Cache-Control'];
          }
          return null;
        }),
      },
      json: async () => body,
    })),
  },
}));

// Mock crypto.randomUUID properly
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
  },
});

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
  })),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabaseClient);
});

describe('/api/hall-of-fame/season/[id]/complete', () => {
  const createMockRequest = (seasonId = '1') => {
    const url = `http://localhost/api/hall-of-fame/season/${seasonId}/complete`;
    return new Request(url);
  };

  const createMockParams = (id: string) => Promise.resolve({ id });

  describe('GET /api/hall-of-fame/season/[id]/complete', () => {
    it('should return complete season data with both league and cup winners', async () => {
      // Mock season data
      const mockSeasonData = {
        id: 1,
        name: 'Premier League 2021/22',
        api_season_year: 2021,
        start_date: '2021-08-01',
        end_date: '2022-05-31',
        completed_at: '2022-05-31T23:59:59Z',
        winner_determined_at: '2022-06-01T00:00:00Z',
        last_round_special_activated: true,
        last_round_special_activated_at: '2022-04-01T00:00:00Z',
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      // Mock winners data
      const mockWinnersData = [
        {
          id: 1,
          season_id: 1,
          user_id: 'user-1',
          league_id: 7,
          total_points: 167,
          game_points: 137,
          dynamic_points: 30,
          created_at: '2022-06-01T00:00:00Z',
          competition_type: 'league',
          profile: {
            id: 'user-1',
            full_name: 'Heimir Þorsteinsson',
            avatar_url: null,
            updated_at: '2022-06-01T00:00:00Z'
          }
        },
        {
          id: 2,
          season_id: 1,
          user_id: 'user-1',
          league_id: 7,
          total_points: 45,
          game_points: 45,
          dynamic_points: 0,
          created_at: '2022-06-01T00:00:00Z',
          competition_type: 'last_round_special',
          profile: {
            id: 'user-1',
            full_name: 'Heimir Þorsteinsson',
            avatar_url: null,
            updated_at: '2022-06-01T00:00:00Z'
          }
        }
      ];

      // Setup mocks
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: mockWinnersData, error: null }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('1');
      const params = createMockParams('1');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(1);
      expect(responseData.data.league_winner).not.toBeNull();
      expect(responseData.data.cup_winner).not.toBeNull();
      expect(responseData.data.league_winner?.competition_type).toBe('league');
      expect(responseData.data.cup_winner?.competition_type).toBe('last_round_special');
      expect(responseData.data.season.last_round_special_activated).toBe(true);
      expect(responseData.metadata.has_league_winner).toBe(true);
      expect(responseData.metadata.has_cup_winner).toBe(true);
      expect(responseData.metadata.cup_was_activated).toBe(true);
    });

    it('should return season with only league winner when cup was not activated', async () => {
      const mockSeasonData = {
        id: 2,
        name: 'Premier League 2020/21',
        api_season_year: 2020,
        start_date: '2020-08-01',
        end_date: '2021-05-31',
        completed_at: '2021-05-31T23:59:59Z',
        winner_determined_at: '2021-06-01T00:00:00Z',
        last_round_special_activated: false,
        last_round_special_activated_at: null,
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      const mockWinnersData = [
        {
          id: 3,
          season_id: 2,
          user_id: 'user-2',
          league_id: 7,
          total_points: 165,
          game_points: 135,
          dynamic_points: 30,
          created_at: '2021-06-01T00:00:00Z',
          competition_type: 'league',
          profile: {
            id: 'user-2',
            full_name: 'Róbert Wessman',
            avatar_url: null,
            updated_at: '2021-06-01T00:00:00Z'
          }
        }
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: mockWinnersData, error: null }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('2');
      const params = createMockParams('2');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(2);
      expect(responseData.data.league_winner).not.toBeNull();
      expect(responseData.data.cup_winner).toBeNull();
      expect(responseData.data.season.last_round_special_activated).toBe(false);
      expect(responseData.metadata.has_league_winner).toBe(true);
      expect(responseData.metadata.has_cup_winner).toBe(false);
      expect(responseData.metadata.cup_was_activated).toBe(false);
    });

    it('should return season with no winners when season is not completed', async () => {
      const mockSeasonData = {
        id: 3,
        name: 'Premier League 2024/25',
        api_season_year: 2024,
        start_date: '2024-08-01',
        end_date: '2025-05-31',
        completed_at: null,
        winner_determined_at: null,
        last_round_special_activated: false,
        last_round_special_activated_at: null,
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('3');
      const params = createMockParams('3');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(3);
      expect(responseData.data.league_winner).toBeNull();
      expect(responseData.data.cup_winner).toBeNull();
      expect(responseData.data.season.completed_at).toBeNull();
      expect(responseData.metadata.has_league_winner).toBe(false);
      expect(responseData.metadata.has_cup_winner).toBe(false);
    });

    it('should handle legacy data without competition_type correctly', async () => {
      const mockSeasonData = {
        id: 4,
        name: 'Premier League 2018/19',
        api_season_year: 2018,
        start_date: '2018-08-01',
        end_date: '2019-05-31',
        completed_at: '2019-05-31T23:59:59Z',
        winner_determined_at: '2019-06-01T00:00:00Z',
        last_round_special_activated: false,
        last_round_special_activated_at: null,
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      // Legacy data without competition_type (should default to league)
      const mockWinnersData = [
        {
          id: 4,
          season_id: 4,
          user_id: 'user-3',
          league_id: 7,
          total_points: 150,
          game_points: 120,
          dynamic_points: 30,
          created_at: '2019-06-01T00:00:00Z',
          competition_type: null, // Legacy data
          profile: {
            id: 'user-3',
            full_name: 'Alex Thompson',
            avatar_url: null,
            updated_at: '2019-06-01T00:00:00Z'
          }
        }
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: mockWinnersData, error: null }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('4');
      const params = createMockParams('4');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.league_winner).not.toBeNull();
      expect(responseData.data.cup_winner).toBeNull();
      expect(responseData.data.league_winner?.competition_type).toBe('league');
    });

    it('should return 400 for invalid season ID', async () => {
      const request = createMockRequest('invalid');
      const params = createMockParams('invalid');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 400 for floating point season ID', async () => {
      const request = createMockRequest('1.5');
      const params = createMockParams('1.5');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 400 for negative season ID', async () => {
      const request = createMockRequest('-1');
      const params = createMockParams('-1');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 404 when season does not exist', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: { code: 'PGRST116', message: 'No rows found' }
                }))
              }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('999');
      const params = createMockParams('999');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Season not found');
    });

    it('should return 500 on database error for season fetch', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: { code: 'PGRST500', message: 'Database connection error' }
                }))
              }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('1');
      const params = createMockParams('1');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Database error');
      expect(responseData.details).toBe('Database connection error');
    });

    it('should return 500 on database error for winners fetch', async () => {
      const mockSeasonData = {
        id: 1,
        name: 'Premier League 2021/22',
        api_season_year: 2021,
        start_date: '2021-08-01',
        end_date: '2022-05-31',
        completed_at: '2022-05-31T23:59:59Z',
        winner_determined_at: '2022-06-01T00:00:00Z',
        last_round_special_activated: true,
        last_round_special_activated_at: '2022-04-01T00:00:00Z',
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ 
                data: null, 
                error: { code: 'PGRST500', message: 'Winners fetch error' }
              }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('1');
      const params = createMockParams('1');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Database error');
      expect(responseData.details).toBe('Winners fetch error');
    });

    it('should include proper caching headers', async () => {
      const mockSeasonData = {
        id: 1,
        name: 'Premier League 2021/22',
        api_season_year: 2021,
        start_date: '2021-08-01',
        end_date: '2022-05-31',
        completed_at: '2022-05-31T23:59:59Z',
        winner_determined_at: '2022-06-01T00:00:00Z',
        last_round_special_activated: false,
        last_round_special_activated_at: null,
        competition: {
          id: 7,
          name: 'Premier League',
          country_name: 'England',
          logo_url: 'https://example.com/logo.png'
        }
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockSeasonData, error: null }))
              }))
            }))
          };
        } else if (table === 'season_winners') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          };
        }
        return mockSupabaseClient;
      });

      const request = createMockRequest('1');
      const params = createMockParams('1');

      const response = await GET(request, { params });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=600');
    });
  });
}); 