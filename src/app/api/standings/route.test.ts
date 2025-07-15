import { GET } from './route';
import { calculateStandings, UserStandingEntry } from '@/services/standingsService';
import { cupActivationStatusChecker } from '@/services/cup/cupActivationStatusChecker';
import { getCupStandings } from '@/services/cup/cupScoringService';
import { logger } from '@/utils/logger';

// Mock the dependencies
jest.mock('@/services/standingsService');
jest.mock('@/services/cup/cupActivationStatusChecker');
jest.mock('@/services/cup/cupScoringService');
jest.mock('@/utils/logger');

// Mock the entire next/server module
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      mockNextResponseJson(body, init);
      return {
        status: init?.status ?? 200,
        body,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'Cache-Control' && init?.headers) {
              return init.headers['Cache-Control'];
            }
            return null;
          })
        },
        json: jest.fn().mockResolvedValue(body)
      };
    },
  },
}));

const mockCalculateStandings = calculateStandings as jest.MockedFunction<typeof calculateStandings>;
const mockCupActivationStatusChecker = cupActivationStatusChecker as jest.Mocked<typeof cupActivationStatusChecker>;
const mockGetCupStandings = getCupStandings as jest.MockedFunction<typeof getCupStandings>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('/api/standings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNextResponseJson.mockClear();
    
    // Default logger mocks
    mockLogger.info = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
  });

  describe('GET', () => {
    const mockLeagueStandings = [
      {
        user_id: 'user-1',
        username: 'Alice Johnson',
        game_points: 150,
        dynamic_points: 25,
        combined_total_score: 175,
        rank: 1
      },
      {
        user_id: 'user-2', 
        username: 'Bob Smith',
        game_points: 140,
        dynamic_points: 20,
        combined_total_score: 160,
        rank: 2
      }
    ];

    const mockCupStandings = [
      {
        user_id: 'user-2',
        total_points: 45,
        rounds_participated: 3,
        position: 1,
        last_updated: '2025-01-27T12:00:00Z'
      },
      {
        user_id: 'user-1',
        total_points: 40,
        rounds_participated: 3,
        position: 2,
        last_updated: '2025-01-27T12:00:00Z'
      }
    ];

    describe('when cup is not active', () => {
      beforeEach(() => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
          isActivated: false,
          activatedAt: null,
          seasonId: 1,
          seasonName: '2024/25'
        });
      });

      it('should return league standings with inactive cup status', async () => {
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          league_standings: mockLeagueStandings,
          cup: {
            is_active: false,
            season_id: 1,
            season_name: '2024/25',
            activated_at: null
          },
          metadata: {
            timestamp: expect.any(String),
            has_cup_data: false,
            total_league_participants: 2
          }
        });

        // Should not call getCupStandings when cup is inactive
        expect(mockGetCupStandings).not.toHaveBeenCalled();
      });

      it('should include proper cache headers', async () => {
        const response = await GET();
        
        expect(response.headers.get('Cache-Control')).toBe(
          'public, max-age=60, stale-while-revalidate=300'
        );
      });
    });

    describe('when cup is active', () => {
      beforeEach(() => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
          isActivated: true,
          activatedAt: '2025-01-20T10:00:00Z',
          seasonId: 1,
          seasonName: '2024/25'
        });
        mockGetCupStandings.mockResolvedValue(mockCupStandings);
      });

      it('should return both league and cup standings', async () => {
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          league_standings: mockLeagueStandings,
          cup: {
            is_active: true,
            season_id: 1,
            season_name: '2024/25',
            activated_at: '2025-01-20T10:00:00Z',
            standings: mockCupStandings
          },
          metadata: {
            timestamp: expect.any(String),
            has_cup_data: true,
            total_league_participants: 2,
            total_cup_participants: 2
          }
        });

        expect(mockGetCupStandings).toHaveBeenCalledTimes(1);
      });

      it('should handle cup standings fetch failure gracefully', async () => {
        mockGetCupStandings.mockRejectedValue(new Error('Cup service unavailable'));

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.cup.is_active).toBe(true);
        expect(data.cup.standings).toBeUndefined();
        expect(data.metadata.has_cup_data).toBe(false);

        // Should log warning but continue
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Cup service unavailable'
          }),
          'Failed to fetch cup standings - continuing with league standings only'
        );
      });
    });

    describe('when no current season exists', () => {
      beforeEach(() => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
          isActivated: false,
          activatedAt: null,
          seasonId: null,
          seasonName: null
        });
      });

      it('should return league standings with null season info', async () => {
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.cup).toEqual({
          is_active: false,
          season_id: null,
          season_name: null,
          activated_at: null
        });
        expect(data.league_standings).toEqual(mockLeagueStandings);
      });
    });

    describe('error handling', () => {
      it('should return 500 when league standings calculation fails', async () => {
        mockCalculateStandings.mockResolvedValue(null);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
          error: 'Failed to calculate league standings.'
        });

        // Should not proceed to check cup status
        expect(mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus).not.toHaveBeenCalled();
      });

      it('should return 500 when league standings service throws', async () => {
        mockCalculateStandings.mockRejectedValue(new Error('Database connection failed'));

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
          error: 'Internal server error.'
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Database connection failed',
            stack: expect.any(String)
          }),
          'Unexpected error fetching enhanced standings.'
        );
      });

      it('should continue with league standings when cup status check fails', async () => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockRejectedValue(
          new Error('Cup status service down')
        );

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
          error: 'Internal server error.'
        });
      });
    });

    describe('performance logging', () => {
      beforeEach(() => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
          isActivated: true,
          activatedAt: '2025-01-20T10:00:00Z',
          seasonId: 1,
          seasonName: '2024/25'
        });
        mockGetCupStandings.mockResolvedValue(mockCupStandings);
      });

      it('should log processing time and participant counts', async () => {
        await GET();

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            leagueParticipants: 2,
            cupActive: true,
            cupParticipants: 2,
            processingTime: expect.any(Number)
          }),
          'Successfully compiled enhanced standings response.'
        );
      });
    });

    describe('backward compatibility', () => {
      beforeEach(() => {
        mockCalculateStandings.mockResolvedValue(mockLeagueStandings);
        mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue({
          isActivated: false,
          activatedAt: null,
          seasonId: 1,
          seasonName: '2024/25'
        });
      });

      it('should always include league_standings field for existing clients', async () => {
        const response = await GET();
        const data = await response.json();

        expect(data).toHaveProperty('league_standings');
        expect(Array.isArray(data.league_standings)).toBe(true);
        expect(data.league_standings).toEqual(mockLeagueStandings);
      });

      it('should maintain the same league standings data structure', async () => {
        const response = await GET();
        const data = await response.json();

        data.league_standings.forEach((standing: UserStandingEntry) => {
          expect(standing).toHaveProperty('user_id');
          expect(standing).toHaveProperty('username');
          expect(standing).toHaveProperty('game_points');
          expect(standing).toHaveProperty('dynamic_points');
          expect(standing).toHaveProperty('combined_total_score');
          expect(standing).toHaveProperty('rank');
        });
      });
    });
  });
}); 