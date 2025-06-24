import {
  fetchFixtureEvents,
  fetchFixtureStatistics,
  fetchFixturePlayerStats,
  fetchComprehensiveMatchData,
} from '../client';
import type {
  ApiEventsResponse,
  ApiStatisticsResponse,
  ApiPlayersStatsResponse,
  ApiFixturesResponse,
} from '../types';

// Mock the global fetch function
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Define mock responses at the top level
const mockEventsResponse: ApiEventsResponse = {
  get: 'fixtures/events',
  parameters: { fixture: '12345' },
  errors: [],
  results: 2,
  paging: { current: 1, total: 1 },
  response: [
    {
      time: { elapsed: 23, extra: null },
      team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
      player: { id: 123, name: 'Marcus Rashford' },
      assist: { id: 456, name: 'Bruno Fernandes' },
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    },
    {
      time: { elapsed: 67, extra: null },
      team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
      player: { id: 789, name: 'Mohamed Salah' },
      assist: null,
      type: 'Card',
      detail: 'Yellow Card',
      comments: 'Unsporting behaviour',
    },
  ],
};

describe('Enhanced Football API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.NEXT_PUBLIC_FOOTBALL_API_KEY = 'test-api-key-for-testing';
    
    // Mock successful responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEventsResponse,
    } as Response);
  });

  describe('fetchFixtureEvents', () => {
    it('should fetch fixture events successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventsResponse,
      } as Response);

      const result = await fetchFixtureEvents(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures/events?fixture=12345',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-apisports-key': 'test-api-key-for-testing',
          }),
        })
      );
      expect(result).toEqual(mockEventsResponse);
    });

    it('should fetch events with optional filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventsResponse,
      } as Response);

      await fetchFixtureEvents(12345, {
        teamId: 33,
        playerId: 123,
        eventType: 'Goal',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures/events?fixture=12345&team=33&player=123&type=goal',
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(fetchFixtureEvents(12345)).rejects.toThrow(
        'API request failed with status 500: Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchFixtureEvents(12345)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('fetchFixtureStatistics', () => {
    const mockStatsResponse: ApiStatisticsResponse = {
      get: 'fixtures/statistics',
      parameters: { fixture: '12345' },
      errors: [],
      results: 2,
      paging: { current: 1, total: 1 },
      response: [
        {
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          statistics: [
            { type: 'Shots on Goal', value: 5 },
            { type: 'Ball Possession', value: '55%' },
            { type: 'Total passes', value: 432 },
          ],
        },
        {
          team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
          statistics: [
            { type: 'Shots on Goal', value: 3 },
            { type: 'Ball Possession', value: '45%' },
            { type: 'Total passes', value: 356 },
          ],
        },
      ],
    };

    it('should fetch fixture statistics successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      } as Response);

      const result = await fetchFixtureStatistics(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures/statistics?fixture=12345',
        expect.any(Object)
      );
      expect(result).toEqual(mockStatsResponse);
    });

    it('should fetch statistics with team filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      } as Response);

      await fetchFixtureStatistics(12345, { teamId: 33 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures/statistics?fixture=12345&team=33',
        expect.any(Object)
      );
    });
  });

  describe('fetchFixturePlayerStats', () => {
    const mockPlayerStatsResponse: ApiPlayersStatsResponse = {
      get: 'fixtures/players',
      parameters: { fixture: '12345' },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          players: [
            {
              player: {
                id: 123,
                name: 'Marcus Rashford',
                firstname: 'Marcus',
                lastname: 'Rashford',
                age: 26,
                birth: { date: '1997-10-31', place: 'Manchester', country: 'England' },
                nationality: 'England',
                height: '180 cm',
                weight: '70 kg',
                injured: false,
                photo: 'photo.jpg',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 10,
                    position: 'Attacker',
                    rating: '8.5',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 1,
                  shots: { total: 4, on: 2 },
                  goals: { total: 1, conceded: 0, assists: 0, saves: null },
                  passes: { total: 32, key: 3, accuracy: '85%' },
                  tackles: { total: 2, blocks: 0, interceptions: 1 },
                  duels: { total: 8, won: 5 },
                  dribbles: { attempts: 6, success: 4, past: null },
                  fouls: { drawn: 2, committed: 1 },
                  cards: { yellow: 0, red: 0 },
                  penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: null },
                },
              ],
            },
          ],
        },
      ],
    };

    it('should fetch player statistics successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlayerStatsResponse,
      } as Response);

      const result = await fetchFixturePlayerStats(12345);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures/players?fixture=12345',
        expect.any(Object)
      );
      expect(result).toEqual(mockPlayerStatsResponse);
    });
  });

  describe('fetchComprehensiveMatchData', () => {
    const mockFixtureResponse: ApiFixturesResponse = {
      get: 'fixtures',
      parameters: { id: '12345' },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          fixture: {
            id: 12345,
            referee: 'Michael Oliver',
            timezone: 'UTC',
            date: '2024-01-15T15:00:00+00:00',
            timestamp: 1705330800,
            periods: { first: 1705330800, second: 1705334400 },
            venue: { id: 556, name: 'Old Trafford', city: 'Manchester' },
            status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
          },
          league: {
            id: 39,
            name: 'Premier League',
            country: 'England',
            logo: 'league.png',
            flag: 'flag.png',
            season: 2024,
            round: 'Regular Season - 20',
          },
          teams: {
            home: { id: 33, name: 'Manchester United', logo: 'logo.png', winner: true },
            away: { id: 34, name: 'Liverpool', logo: 'logo2.png', winner: false },
          },
          goals: { home: 2, away: 1 },
          score: {
            halftime: { home: 1, away: 0 },
            fulltime: { home: 2, away: 1 },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
          },
        },
      ],
    };

    it('should fetch comprehensive match data successfully', async () => {
      // Mock all three API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFixtureResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEventsResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: [
              {
                team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
                statistics: [{ type: 'Ball Possession', value: '55%' }],
              },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: [
              {
                team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
                players: [],
              },
            ],
          }),
        } as Response);

      const result = await fetchComprehensiveMatchData(12345);

      expect(result).toHaveProperty('fixture');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('playerStats');
      expect(result.fixture.response[0].fixture.id).toBe(12345);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock fixture call success, but events call failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFixtureResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: [] }),
        } as Response);

      const result = await fetchComprehensiveMatchData(12345);

      // Should return null when there are errors
      expect(result).toBe(null);
    });

    it('should return null if fixture data fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await fetchComprehensiveMatchData(12345);
      expect(result).toBe(null);
    });
  });

  describe('Error handling', () => {
    it.skip('should handle missing API key by creating a new module instance', async () => {
      // Save original API key
      const originalApiKey = process.env.NEXT_PUBLIC_FOOTBALL_API_KEY;
      
      try {
        // Remove API key from environment
        delete process.env.NEXT_PUBLIC_FOOTBALL_API_KEY;
        
        // Import a fresh instance of the module to get the updated API_KEY constant  
        await jest.isolateModules(async () => {
          const clientModule = await import('../client');
          const { fetchFixtureEvents } = clientModule;
          
          // This should throw because API_KEY will be undefined in the fresh module
          await expect(fetchFixtureEvents(12345)).rejects.toThrow(
            'Football API key is missing. Please set NEXT_PUBLIC_FOOTBALL_API_KEY in your environment variables.'
          );
        });
      } finally {
        // Always restore original API key
        if (originalApiKey) {
          process.env.NEXT_PUBLIC_FOOTBALL_API_KEY = originalApiKey;
        }
      }
    });
  });
}); 