import { LeagueDataServiceImpl, TeamStanding, LeagueTable } from '../leagueDataService';

// Mock console methods to avoid test output noise
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

// Mock environment variables for testing
const originalEnv = process.env;

describe('LeagueDataServiceImpl - getBestGoalDifferenceTeams', () => {
  let service: LeagueDataServiceImpl;
  const mockCompetitionId = 39; // Premier League
  const mockSeasonYear = 2023;

  beforeEach(() => {
    // Set required environment variables
    process.env.FOOTBALL_API_KEY = 'test-api-key';
    service = new LeagueDataServiceImpl();
    jest.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Input Validation', () => {
    it('should return empty array for invalid competitionApiId', async () => {
      const result = await service.getBestGoalDifferenceTeams(0, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: Invalid competitionApiId provided:', 0
      );
    });

    it('should return empty array for negative competitionApiId', async () => {
      const result = await service.getBestGoalDifferenceTeams(-1, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: Invalid competitionApiId provided:', -1
      );
    });

    it('should return empty array for invalid seasonYear', async () => {
      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, 0);
      expect(result).toEqual([]);
    });

    it('should return empty array for negative seasonYear', async () => {
      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, -1);
      expect(result).toEqual([]);
    });
  });

  describe('API Data Handling', () => {
    it('should handle null response from getCurrentLeagueTable', async () => {
      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(null);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: getCurrentLeagueTable returned null - API may be unavailable'
      );
    });

    it('should handle empty standings array', async () => {
      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: []
      };
      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: No standings found for this competition/season'
      );
    });
  });

  describe('Single Best Goal Difference Scenarios', () => {
    it('should return single team ID when one team has best goal difference', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Manchester City',
          points: 80,
          goals_difference: 45, // Best goal difference
          games_played: 30,
          games_won: 25,
          games_drawn: 5,
          games_lost: 0
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Liverpool',
          points: 75,
          goals_difference: 35, // Lower goal difference
          games_played: 30,
          games_won: 23,
          games_drawn: 6,
          games_lost: 1
        },
        {
          rank: 3,
          team_id: 50,
          team_name: 'Arsenal',
          points: 70,
          goals_difference: 25, // Even lower goal difference
          games_played: 30,
          games_won: 21,
          games_drawn: 7,
          games_lost: 2
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
    });
  });

  describe('Multiple Best Goal Difference (Tie Scenarios)', () => {
    it('should return all team IDs when two teams are tied for best goal difference', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Manchester City',
          points: 80,
          goals_difference: 45, // Tied for best
          games_played: 30,
          games_won: 25,
          games_drawn: 5,
          games_lost: 0
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Liverpool',
          points: 78,
          goals_difference: 45, // Tied for best
          games_played: 30,
          games_won: 24,
          games_drawn: 6,
          games_lost: 0
        },
        {
          rank: 3,
          team_id: 50,
          team_name: 'Arsenal',
          points: 70,
          goals_difference: 35, // Lower
          games_played: 30,
          games_won: 21,
          games_drawn: 7,
          games_lost: 2
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toContain(33);
      expect(result).toContain(40);
      expect(result).toHaveLength(2);
    });

    it('should return all team IDs when three teams are tied for best goal difference', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Manchester City',
          points: 80,
          goals_difference: 35, // All tied
          games_played: 30,
          games_won: 25,
          games_drawn: 5,
          games_lost: 0
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Liverpool',
          points: 78,
          goals_difference: 35, // All tied
          games_played: 30,
          games_won: 24,
          games_drawn: 6,
          games_lost: 0
        },
        {
          rank: 3,
          team_id: 50,
          team_name: 'Arsenal',
          points: 76,
          goals_difference: 35, // All tied
          games_played: 30,
          games_won: 23,
          games_drawn: 7,
          games_lost: 0
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toContain(33);
      expect(result).toContain(40);
      expect(result).toContain(50);
      expect(result).toHaveLength(3);
    });

    it('should return all team IDs when five or more teams are tied', async () => {
      const mockStandings: TeamStanding[] = [];
      const goalDifference = 20;
      
      // Create 5 teams with identical goal difference
      for (let i = 1; i <= 5; i++) {
        mockStandings.push({
          rank: i,
          team_id: 30 + i,
          team_name: `Team ${i}`,
          points: 60 - i,
          goals_difference: goalDifference, // All tied
          games_played: 30,
          games_won: 18,
          games_drawn: 6,
          games_lost: 6
        });
      }

      // Add a team with lower goal difference
      mockStandings.push({
        rank: 6,
        team_id: 99,
        team_name: 'Lower Team',
        points: 50,
        goals_difference: 10, // Lower
        games_played: 30,
        games_won: 15,
        games_drawn: 5,
        games_lost: 10
      });

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toContain(31);
      expect(result).toContain(32);
      expect(result).toContain(33);
      expect(result).toContain(34);
      expect(result).toContain(35);
      expect(result).not.toContain(99);
      expect(result).toHaveLength(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative goal differences correctly', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Best Team',
          points: 30,
          goals_difference: -5, // Best (least negative)
          games_played: 30,
          games_won: 8,
          games_drawn: 6,
          games_lost: 16
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Worse Team',
          points: 25,
          goals_difference: -10, // Worse
          games_played: 30,
          games_won: 6,
          games_drawn: 7,
          games_lost: 17
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
    });

    it('should handle all teams having zero goal difference', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Team A',
          points: 30,
          goals_difference: 0, // All zero
          games_played: 20,
          games_won: 8,
          games_drawn: 6,
          games_lost: 6
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Team B',
          points: 25,
          goals_difference: 0, // All zero
          games_played: 20,
          games_won: 6,
          games_drawn: 7,
          games_lost: 7
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toContain(33);
      expect(result).toContain(40);
      expect(result).toHaveLength(2);
    });

    it('should handle single team in league', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Only Team',
          points: 90,
          goals_difference: 25,
          games_played: 30,
          games_won: 30,
          games_drawn: 0,
          games_lost: 0
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
    });

    it('should filter out teams with invalid goal difference values', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Valid Team',
          points: 75,
          goals_difference: 25, // Valid
          games_played: 30,
          games_won: 23,
          games_drawn: 6,
          games_lost: 1
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Invalid Team',
          points: 70,
          goals_difference: Number.NaN, // Invalid NaN
          games_played: 30,
          games_won: 21,
          games_drawn: 7,
          games_lost: 2
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: Invalid goal difference for team', 40, Number.NaN
      );
    });

    it('should filter out teams with invalid team_id', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Valid Team',
          points: 75,
          goals_difference: 25,
          games_played: 30,
          games_won: 23,
          games_drawn: 6,
          games_lost: 1
        },
        {
          rank: 2,
          team_id: 0, // Invalid ID
          team_name: 'Invalid Team',
          points: 70,
          goals_difference: 20,
          games_played: 30,
          games_won: 21,
          games_drawn: 7,
          games_lost: 2
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
    });

    it('should return empty array when no valid teams remain after filtering', async () => {
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 0, // Invalid ID
          team_name: 'Invalid Team 1',
          points: 75,
          goals_difference: Number.NaN, // Invalid goal difference
          games_played: 30,
          games_won: 23,
          games_drawn: 6,
          games_lost: 1
        },
        {
          rank: 2,
          team_id: -1, // Invalid ID
          team_name: 'Invalid Team 2',
          points: 70,
          goals_difference: Number.NaN, // Invalid goal difference
          games_played: 30,
          games_won: 21,
          games_drawn: 7,
          games_lost: 2
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: No teams with valid goal difference found'
      );
    });
  });

  describe('Duplicate Handling', () => {
    it('should remove duplicate team IDs if they somehow appear', async () => {
      // Create a scenario where the same team appears twice (edge case)
      const mockStandings: TeamStanding[] = [
        {
          rank: 1,
          team_id: 33,
          team_name: 'Manchester City',
          points: 80,
          goals_difference: 45,
          games_played: 30,
          games_won: 25,
          games_drawn: 5,
          games_lost: 0
        },
        {
          rank: 1, // Duplicate rank (edge case)
          team_id: 33, // Duplicate team ID
          team_name: 'Manchester City',
          points: 80,
          goals_difference: 45,
          games_played: 30,
          games_won: 25,
          games_drawn: 5,
          games_lost: 0
        },
        {
          rank: 2,
          team_id: 40,
          team_name: 'Liverpool',
          points: 75,
          goals_difference: 35, // Lower goal difference
          games_played: 30,
          games_won: 23,
          games_drawn: 6,
          games_lost: 1
        }
      ];

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: mockStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([33]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: Removed duplicate team IDs from results'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      jest.spyOn(service, 'getCurrentLeagueTable').mockRejectedValue(new Error('Network error'));

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'getBestGoalDifferenceTeams: Unexpected error occurred:', expect.any(Error)
      );
    });

    it('should handle malformed data gracefully', async () => {
      const malformedLeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: [
          { /* missing required fields */ } as TeamStanding,
          null,
          undefined
        ] as (TeamStanding | null | undefined)[]
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(malformedLeagueTable as LeagueTable);

      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      expect(result).toEqual([]);
    });
  });

  describe('Performance and Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset to test performance
      const largeStandings: TeamStanding[] = [];
      for (let i = 1; i <= 1000; i++) {
        largeStandings.push({
          rank: i,
          team_id: i,
          team_name: `Team ${i}`,
          points: Math.floor(Math.random() * 100),
          goals_difference: Math.floor(Math.random() * 60) - 30, // Random goal difference -30 to +30
          games_played: 38,
          games_won: Math.floor(Math.random() * 25),
          games_drawn: Math.floor(Math.random() * 13),
          games_lost: Math.floor(Math.random() * 25)
        });
      }

      // Set a few teams to have the maximum goal difference to test tie scenario
      largeStandings[0].goals_difference = 50;
      largeStandings[1].goals_difference = 50;
      largeStandings[2].goals_difference = 50;

      const mockLeagueTable: LeagueTable = {
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: largeStandings
      };

      jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue(mockLeagueTable);

      const startTime = Date.now();
      const result = await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);
      const endTime = Date.now();

      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(3);
      expect(result).toHaveLength(3);
      
      // Performance check: should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100); // 100ms should be more than enough
    });

    it('should call getCurrentLeagueTable with correct parameters', async () => {
      const spy = jest.spyOn(service, 'getCurrentLeagueTable').mockResolvedValue({
        competition_api_id: mockCompetitionId,
        season_year: mockSeasonYear,
        league_name: 'Premier League',
        standings: []
      });

      await service.getBestGoalDifferenceTeams(mockCompetitionId, mockSeasonYear);

      expect(spy).toHaveBeenCalledWith(mockCompetitionId, mockSeasonYear);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
}); 