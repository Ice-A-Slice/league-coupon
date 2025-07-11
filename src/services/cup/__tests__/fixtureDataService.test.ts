import { fixtureDataService } from '../fixtureDataService';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/supabase/client');
jest.mock('@/utils/logger');

const mockSupabase = {
  from: jest.fn(),
};

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('FixtureDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabase as any);
    mockLogger.error = jest.fn();
  });

  describe('getTeamRemainingGames', () => {
    it('should return empty result when no current season exists', async () => {
      // Mock no current season
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'No current season found' }
            })
          })
        })
      });

      await expect(fixtureDataService.getTeamRemainingGames()).rejects.toThrow('Unable to determine current season');
    });

    it('should return empty result when no fixtures exist for current season', async () => {
      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 1, name: '2024/25' },
              error: null
            })
          })
        })
      });

      // Mock no fixtures
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const result = await fixtureDataService.getTeamRemainingGames();

      expect(result).toEqual({
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      });
    });

    it('should correctly count remaining games for teams with various scenarios', async () => {
      const mockCurrentSeason = { id: 1, name: '2024/25' };
      const mockFixtures = [
        // Team 1 (Arsenal) - 3 remaining games
        {
          id: 1,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: '2025-02-01T15:00:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 20', season_id: 1 }
        },
        {
          id: 2,
          home_team_id: 3,
          away_team_id: 1,
          kickoff: '2025-02-08T15:00:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 3, name: 'Liverpool' },
          away_team: { id: 1, name: 'Arsenal' },
          round: { id: 1, name: 'Regular Season - 21', season_id: 1 }
        },
        {
          id: 3,
          home_team_id: 1,
          away_team_id: 4,
          kickoff: '2025-02-15T15:00:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 4, name: 'Man City' },
          round: { id: 1, name: 'Regular Season - 22', season_id: 1 }
        },
        // Team 2 (Chelsea) - 5 remaining games (edge case)
        {
          id: 4,
          home_team_id: 2,
          away_team_id: 3,
          kickoff: '2025-02-01T17:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 2, name: 'Chelsea' },
          away_team: { id: 3, name: 'Liverpool' },
          round: { id: 1, name: 'Regular Season - 20', season_id: 1 }
        },
        {
          id: 5,
          home_team_id: 4,
          away_team_id: 2,
          kickoff: '2025-02-08T17:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 4, name: 'Man City' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 21', season_id: 1 }
        },
        {
          id: 6,
          home_team_id: 2,
          away_team_id: 5,
          kickoff: '2025-02-15T17:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 2, name: 'Chelsea' },
          away_team: { id: 5, name: 'Tottenham' },
          round: { id: 1, name: 'Regular Season - 22', season_id: 1 }
        },
        {
          id: 7,
          home_team_id: 5,
          away_team_id: 2,
          kickoff: '2025-02-22T17:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 5, name: 'Tottenham' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 23', season_id: 1 }
        },
        // Team 3 (Liverpool) - 6 remaining games
        {
          id: 8,
          home_team_id: 3,
          away_team_id: 4,
          kickoff: '2025-02-15T12:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 3, name: 'Liverpool' },
          away_team: { id: 4, name: 'Man City' },
          round: { id: 1, name: 'Regular Season - 22', season_id: 1 }
        },
        {
          id: 9,
          home_team_id: 3,
          away_team_id: 5,
          kickoff: '2025-02-22T12:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 3, name: 'Liverpool' },
          away_team: { id: 5, name: 'Tottenham' },
          round: { id: 1, name: 'Regular Season - 23', season_id: 1 }
        },
        {
          id: 10,
          home_team_id: 6,
          away_team_id: 3,
          kickoff: '2025-03-01T12:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 6, name: 'Brighton' },
          away_team: { id: 3, name: 'Liverpool' },
          round: { id: 1, name: 'Regular Season - 24', season_id: 1 }
        },
        {
          id: 11,
          home_team_id: 3,
          away_team_id: 6,
          kickoff: '2025-03-08T12:30:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 3, name: 'Liverpool' },
          away_team: { id: 6, name: 'Brighton' },
          round: { id: 1, name: 'Regular Season - 25', season_id: 1 }
        },
        // Team 4 (Man City) - 0 remaining games
        // Already counted in games above
        // Team 5 (Tottenham) - 0 remaining games 
        // Already counted in games above
        // Team 6 (Brighton) - 0 remaining games
        // Already counted in games above
        // Add some completed fixtures for the same teams
        {
          id: 12,
          home_team_id: 1,
          away_team_id: 3,
          kickoff: '2025-01-01T15:00:00Z',
          status_short: 'FT',
          result: 'H',
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 3, name: 'Liverpool' },
          round: { id: 1, name: 'Regular Season - 19', season_id: 1 }
        }
      ];

      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSeason,
              error: null
            })
          })
        })
      });

      // Mock fixtures
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFixtures,
              error: null
            })
          })
        })
      });

      const result = await fixtureDataService.getTeamRemainingGames();

      expect(result.totalTeams).toBe(6);
      expect(result.teamsWithFiveOrFewerGames).toBe(5); // Arsenal(3), Chelsea(5), Man City(0), Tottenham(0), Brighton(0)
      expect(result.percentageWithFiveOrFewerGames).toBeCloseTo(83.33, 1); // 5/6 * 100

      // Check specific teams
      const arsenal = result.teams.find(t => t.teamName === 'Arsenal');
      const chelsea = result.teams.find(t => t.teamName === 'Chelsea');
      const liverpool = result.teams.find(t => t.teamName === 'Liverpool');
      const manCity = result.teams.find(t => t.teamName === 'Man City');
      const tottenham = result.teams.find(t => t.teamName === 'Tottenham');
      const brighton = result.teams.find(t => t.teamName === 'Brighton');

      expect(arsenal?.remainingGames).toBe(3);
      expect(chelsea?.remainingGames).toBe(5);
      expect(liverpool?.remainingGames).toBe(6);
      expect(manCity?.remainingGames).toBe(3);
      expect(tottenham?.remainingGames).toBe(3);
      expect(brighton?.remainingGames).toBe(2);
    });

    it('should handle fixtures with array-style team data', async () => {
      const mockCurrentSeason = { id: 1, name: '2024/25' };
      const mockFixtures = [
        {
          id: 1,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: '2025-02-01T15:00:00Z',
          status_short: 'NS',
          result: null,
          home_team: [{ id: 1, name: 'Arsenal' }], // Array style
          away_team: [{ id: 2, name: 'Chelsea' }], // Array style
          round: { id: 1, name: 'Regular Season - 20', season_id: 1 }
        }
      ];

      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSeason,
              error: null
            })
          })
        })
      });

      // Mock fixtures
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFixtures,
              error: null
            })
          })
        })
      });

      const result = await fixtureDataService.getTeamRemainingGames();

      expect(result.totalTeams).toBe(2);
      expect(result.teams.find(t => t.teamName === 'Arsenal')?.remainingGames).toBe(1);
      expect(result.teams.find(t => t.teamName === 'Chelsea')?.remainingGames).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 1, name: '2024/25' },
              error: null
            })
          })
        })
      });

      // Mock fixtures error
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        })
      });

      await expect(fixtureDataService.getTeamRemainingGames()).rejects.toThrow('Unexpected error while analyzing fixture data');
    });

    it('should correctly filter out completed fixtures', async () => {
      const mockCurrentSeason = { id: 1, name: '2024/25' };
      const pastDate = new Date('2024-01-01T15:00:00Z');
      const futureDate = new Date('2025-12-01T15:00:00Z');
      
      const mockFixtures = [
        // Future fixture - should be counted
        {
          id: 1,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: futureDate.toISOString(),
          status_short: 'NS',
          result: null,
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 20', season_id: 1 }
        },
        // Past fixture with result - should not be counted
        {
          id: 2,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: pastDate.toISOString(),
          status_short: 'FT',
          result: 'H',
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 19', season_id: 1 }
        }
      ];

      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSeason,
              error: null
            })
          })
        })
      });

      // Mock fixtures
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFixtures,
              error: null
            })
          })
        })
      });

      const result = await fixtureDataService.getTeamRemainingGames();

      expect(result.totalTeams).toBe(2);
      expect(result.teams.find(t => t.teamName === 'Arsenal')?.remainingGames).toBe(1);
      expect(result.teams.find(t => t.teamName === 'Chelsea')?.remainingGames).toBe(1);
    });
  });

  describe('getTeamsSummary', () => {
    it('should return teams array from getTeamRemainingGames', async () => {
      const mockCurrentSeason = { id: 1, name: '2024/25' };
      const mockFixtures = [
        {
          id: 1,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: '2025-02-01T15:00:00Z',
          status_short: 'NS',
          result: null,
          home_team: { id: 1, name: 'Arsenal' },
          away_team: { id: 2, name: 'Chelsea' },
          round: { id: 1, name: 'Regular Season - 20', season_id: 1 }
        }
      ];

      // Mock current season
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSeason,
              error: null
            })
          })
        })
      });

      // Mock fixtures
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFixtures,
              error: null
            })
          })
        })
      });

      const result = await fixtureDataService.getTeamsSummary();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('teamId');
      expect(result[0]).toHaveProperty('teamName');
      expect(result[0]).toHaveProperty('remainingGames');
    });
  });
}); 