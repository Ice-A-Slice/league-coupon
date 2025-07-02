import { LeagueDataServiceImpl, PlayerStatistic } from '../leagueDataService';

// Mock environment variables for testing
const originalEnv = process.env;
process.env = {
  ...originalEnv,
  NEXT_PUBLIC_FOOTBALL_API_KEY: 'mock-test-api-key'
};

// Mock console methods to avoid test output noise
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('LeagueDataServiceImpl - getTopScorers', () => {
  let service: LeagueDataServiceImpl;
  const mockCompetitionId = 39; // Premier League
  const mockSeasonYear = 2023;

  beforeEach(() => {
    service = new LeagueDataServiceImpl();
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  afterAll(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Input Validation', () => {
    it('should return empty array for invalid competitionApiId', async () => {
      const result = await service.getTopScorers(0, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getTopScorers: Invalid competitionApiId provided:', 0
      );
    });

    it('should return empty array for negative competitionApiId', async () => {
      const result = await service.getTopScorers(-1, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getTopScorers: Invalid competitionApiId provided:', -1
      );
    });

    it('should return empty array for invalid seasonYear', async () => {
      const result = await service.getTopScorers(mockCompetitionId, 0);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getTopScorers: Invalid seasonYear provided:', 0
      );
    });

    it('should return empty array for negative seasonYear', async () => {
      const result = await service.getTopScorers(mockCompetitionId, -1);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getTopScorers: Invalid seasonYear provided:', -1
      );
    });
  });

  describe('API Data Handling', () => {
    it('should handle null response from getCurrentTopScorers', async () => {
      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(null);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getTopScorers: getCurrentTopScorers returned null - API may be unavailable'
      );
    });

    it('should handle empty response from getCurrentTopScorers', async () => {
      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue([]);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getTopScorers: No top scorers found for this competition/season'
      );
    });
  });

  describe('Single Top Scorer Scenarios', () => {
    it('should return single player ID when one player has highest goals', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Harry Kane',
          team_api_id: 33,
          team_name: 'Tottenham',
          goals: 25
        },
        {
          player_api_id: 102,
          player_name: 'Mo Salah',
          team_api_id: 40,
          team_name: 'Liverpool',
          goals: 20
        },
        {
          player_api_id: 103,
          player_name: 'Erling Haaland',
          team_api_id: 50,
          team_name: 'Manchester City',
          goals: 15
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([101]);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Maximum goal count is 25'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Found 1 player(s) tied for top scorer:', [101]
      );
    });
  });

  describe('Multiple Top Scorers (Tie Scenarios)', () => {
    it('should return all player IDs when two players are tied for top scorer', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Harry Kane',
          team_api_id: 33,
          team_name: 'Tottenham',
          goals: 25
        },
        {
          player_api_id: 102,
          player_name: 'Mo Salah',
          team_api_id: 40,
          team_name: 'Liverpool',
          goals: 25
        },
        {
          player_api_id: 103,
          player_name: 'Erling Haaland',
          team_api_id: 50,
          team_name: 'Manchester City',
          goals: 20
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toHaveLength(2);
      expect(result).toContain(101);
      expect(result).toContain(102);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Maximum goal count is 25'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Found 2 player(s) tied for top scorer:', expect.arrayContaining([101, 102])
      );
    });

    it('should return all player IDs when three players are tied for top scorer', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Harry Kane',
          team_api_id: 33,
          team_name: 'Tottenham',
          goals: 20
        },
        {
          player_api_id: 102,
          player_name: 'Mo Salah',
          team_api_id: 40,
          team_name: 'Liverpool',
          goals: 20
        },
        {
          player_api_id: 103,
          player_name: 'Erling Haaland',
          team_api_id: 50,
          team_name: 'Manchester City',
          goals: 20
        },
        {
          player_api_id: 104,
          player_name: 'Darwin Nunez',
          team_api_id: 40,
          team_name: 'Liverpool',
          goals: 15
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toHaveLength(3);
      expect(result).toContain(101);
      expect(result).toContain(102);
      expect(result).toContain(103);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Maximum goal count is 20'
      );
    });

    it('should return all player IDs when five or more players are tied', async () => {
      const mockData: PlayerStatistic[] = [
        { player_api_id: 101, player_name: 'Player 1', team_api_id: 33, team_name: 'Team A', goals: 15 },
        { player_api_id: 102, player_name: 'Player 2', team_api_id: 40, team_name: 'Team B', goals: 15 },
        { player_api_id: 103, player_name: 'Player 3', team_api_id: 50, team_name: 'Team C', goals: 15 },
        { player_api_id: 104, player_name: 'Player 4', team_api_id: 60, team_name: 'Team D', goals: 15 },
        { player_api_id: 105, player_name: 'Player 5', team_api_id: 70, team_name: 'Team E', goals: 15 },
        { player_api_id: 106, player_name: 'Player 6', team_api_id: 80, team_name: 'Team F', goals: 10 }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toHaveLength(5);
      expect(result).toContain(101);
      expect(result).toContain(102);
      expect(result).toContain(103);
      expect(result).toContain(104);
      expect(result).toContain(105);
      expect(result).not.toContain(106);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all players having zero goals', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Player 1',
          team_api_id: 33,
          team_name: 'Team A',
          goals: 0
        },
        {
          player_api_id: 102,
          player_name: 'Player 2',
          team_api_id: 40,
          team_name: 'Team B',
          goals: 0
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toHaveLength(2);
      expect(result).toContain(101);
      expect(result).toContain(102);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'getTopScorers: Maximum goal count is 0'
      );
    });

    it('should handle single player in league', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Only Player',
          team_api_id: 33,
          team_name: 'Only Team',
          goals: 5
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([101]);
    });
  });

  describe('Data Validation and Filtering', () => {
    it('should filter out players with invalid goal counts', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Valid Player',
          team_api_id: 33,
          team_name: 'Team A',
          goals: 15
        },
        {
          player_api_id: 102,
          player_name: 'Invalid Player 1',
          team_api_id: 40,
          team_name: 'Team B',
          goals: -1 // Invalid negative goals
        },
        {
          player_api_id: 103,
          player_name: 'Invalid Player 2',
          team_api_id: 50,
          team_name: 'Team C',
          goals: Number.NaN // Invalid NaN goals - explicit NaN creation
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([101]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getTopScorers: Invalid goal count for player', 102, -1
      );
    });

    it('should filter out players with invalid player_api_id', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Valid Player',
          team_api_id: 33,
          team_name: 'Team A',
          goals: 15
        },
        {
          player_api_id: 0, // Invalid ID
          player_name: 'Invalid Player 1',
          team_api_id: 40,
          team_name: 'Team B',
          goals: 10
        },
        {
          player_api_id: -1, // Invalid negative ID
          player_name: 'Invalid Player 2',
          team_api_id: 50,
          team_name: 'Team C',
          goals: 5
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([101]);
    });

    it('should return empty array when no valid players remain after filtering', async () => {
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 0,
          player_name: 'Invalid Player 1',
          team_api_id: 33,
          team_name: 'Team A',
          goals: -1
        },
        {
          player_api_id: -1,
          player_name: 'Invalid Player 2',
          team_api_id: 40,
          team_name: 'Team B',
          goals: Number.NaN
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getTopScorers: No players with valid goal counts found'
      );
    });
  });

  describe('Duplicate Handling', () => {
    it('should remove duplicate player IDs if they somehow appear', async () => {
      // Create a scenario where the same player appears twice (edge case)
      const mockData: PlayerStatistic[] = [
        {
          player_api_id: 101,
          player_name: 'Harry Kane',
          team_api_id: 33,
          team_name: 'Tottenham',
          goals: 25
        },
        {
          player_api_id: 101, // Duplicate player ID
          player_name: 'Harry Kane',
          team_api_id: 33,
          team_name: 'Tottenham',
          goals: 25
        },
        {
          player_api_id: 102,
          player_name: 'Mo Salah',
          team_api_id: 40,
          team_name: 'Liverpool',
          goals: 20
        }
      ];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(mockData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([101]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getTopScorers: Removed duplicate player IDs from results'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      jest.spyOn(service, 'getCurrentTopScorers').mockRejectedValue(new Error('Network error'));

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getTopScorers: Unexpected error occurred:', expect.any(Error)
      );
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = [
        { /* missing required fields */ } as PlayerStatistic,
        null,
        undefined
      ] as (PlayerStatistic | null | undefined)[];

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(malformedData);

      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
    });
  });

  describe('Performance and Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset to test performance
      const largeDataset: PlayerStatistic[] = [];
      for (let i = 1; i <= 1000; i++) {
        largeDataset.push({
          player_api_id: i,
          player_name: `Player ${i}`,
          team_api_id: Math.floor(i / 50) + 1,
          team_name: `Team ${Math.floor(i / 50) + 1}`,
          goals: Math.floor(Math.random() * 30) // Random goals 0-29
        });
      }

      // Set a few players to have the maximum goals to test tie scenario
      largeDataset[0].goals = 30;
      largeDataset[1].goals = 30;
      largeDataset[2].goals = 30;

      jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue(largeDataset);

      const startTime = Date.now();
      const result = await service.getTopScorers(mockCompetitionId, mockSeasonYear);
      const endTime = Date.now();

      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(3);
      expect(result).toHaveLength(3);
      
      // Performance check: should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100); // 100ms should be more than enough
    });

    it('should call getCurrentTopScorers with correct parameters', async () => {
      const spy = jest.spyOn(service, 'getCurrentTopScorers').mockResolvedValue([]);

      await service.getTopScorers(mockCompetitionId, mockSeasonYear);

      expect(spy).toHaveBeenCalledWith(mockCompetitionId, mockSeasonYear);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
}); 