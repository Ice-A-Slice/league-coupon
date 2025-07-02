import { DynamicPointsCalculator } from '../dynamicPointsCalculator';
import type { ILeagueDataService } from '../leagueDataService';
import type { UserSeasonAnswerRow } from '../supabase/queries';

// Mock the Supabase client to avoid real database calls
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockImplementation((table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation((column: string, value: number) => ({
          single: jest.fn().mockImplementation(() => {
            // Create mapping that works for our test data
            if (table === 'teams') {
              // For team mapping: return api_team_id equal to the input id
              return Promise.resolve({
                data: { api_team_id: value }, // Database ID = API ID for test simplicity
                error: null
              });
            } else if (table === 'players') {
              // For player mapping: return api_player_id equal to the input id  
              return Promise.resolve({
                data: { api_player_id: value }, // Database ID = API ID for test simplicity
                error: null
              });
            }
            return Promise.resolve({ data: null, error: { message: 'Not found' } });
          })
        }))
      })
    }))
  }
}));

/**
 * Integration tests for DynamicPointsCalculator covering end-to-end scenarios,
 * idempotency verification, performance benchmarks, and real-world data compatibility.
 * 
 * These tests complement the unit tests by verifying the full calculation pipeline
 * works correctly with multiple answer support and maintains backward compatibility.
 */

describe('DynamicPointsCalculator - Integration Tests', () => {
  let calculator: DynamicPointsCalculator;
  let mockLeagueDataService: jest.Mocked<ILeagueDataService>;

  // Performance tracking for benchmarks
  const performanceMetrics: Array<{ scenario: string; timeMs: number; }> = [];

  beforeEach(() => {
    // Create comprehensive mock service with all ILeagueDataService methods
    mockLeagueDataService = {
      getCurrentLeagueTable: jest.fn(),
      getCurrentTopScorers: jest.fn(),
      getTeamWithBestGoalDifference: jest.fn(),
      getLastPlaceTeam: jest.fn(),
      getTopScorers: jest.fn(),
      getBestGoalDifferenceTeams: jest.fn(),
    };

    calculator = new DynamicPointsCalculator(mockLeagueDataService);
  });

  afterAll(() => {
    // Log performance metrics for analysis
    console.log('\n🔍 Performance Benchmark Results:');
    performanceMetrics.forEach(metric => {
      console.log(`  ${metric.scenario}: ${metric.timeMs.toFixed(3)}ms`);
    });
    
    const avgTime = performanceMetrics.reduce((sum, m) => sum + m.timeMs, 0) / performanceMetrics.length;
    console.log(`  Average: ${avgTime.toFixed(3)}ms`);
    console.log(`  Max: ${Math.max(...performanceMetrics.map(m => m.timeMs)).toFixed(3)}ms`);
  });

  // Helper function to create realistic mock data
  const createMockLeagueData = (scenario: 'single-answers' | 'multiple-ties' | 'mixed-scenario') => {
    const baseLeagueTable = {
      competition_api_id: 140,
      season_year: 2024,
      league_name: 'Test League',
      standings: [
        { rank: 1, team_id: 33, team_name: 'Manchester United', points: 85, goals_difference: 45, games_played: 30, games_won: 26, games_drawn: 7, games_lost: 0 },
        { rank: 2, team_id: 50, team_name: 'Manchester City', points: 82, goals_difference: 44, games_played: 30, games_won: 25, games_drawn: 7, games_lost: 1 },
        { rank: 3, team_id: 40, team_name: 'Liverpool', points: 78, goals_difference: 42, games_played: 30, games_won: 24, games_drawn: 6, games_lost: 3 },
        { rank: 4, team_id: 49, team_name: 'Chelsea', points: 65, goals_difference: 25, games_played: 30, games_won: 20, games_drawn: 5, games_lost: 8 },
        { rank: 5, team_id: 47, team_name: 'Arsenal', points: 63, goals_difference: 22, games_played: 30, games_won: 19, games_drawn: 6, games_lost: 8 },
        { rank: 18, team_id: 35, team_name: 'Newcastle United', points: 35, goals_difference: -18, games_played: 30, games_won: 10, games_drawn: 5, games_lost: 18 },
        { rank: 19, team_id: 39, team_name: 'Wolves', points: 32, goals_difference: -22, games_played: 30, games_won: 9, games_drawn: 5, games_lost: 19 },
        { rank: 20, team_id: 45, team_name: 'Everton', points: 28, goals_difference: -25, games_played: 30, games_won: 8, games_drawn: 4, games_lost: 21 }
      ]
    };

    const baseTopScorers = {
      api_id: 140,
      season_year: 2024,
      players: [
        { player_id: 276, player_name: 'Erling Haaland', team_id: 50, goals: 28 },
        { player_id: 325, player_name: 'Harry Kane', team_id: 47, goals: 25 },
        { player_id: 184, player_name: 'Mohamed Salah', team_id: 40, goals: 24 }
      ]
    };

    switch (scenario) {
      case 'single-answers':
        // Clear winner in all categories
        return {
          leagueTable: baseLeagueTable,
          topScorers: baseTopScorers,
          expectedTopScorerIds: [276], // Haaland leads
          expectedBestGDTeamIds: [33] // Man United leads goal difference
        };

      case 'multiple-ties':
        // Multiple ties in top scorer and goal difference
        const tiedTopScorers = {
          ...baseTopScorers,
          players: [
            { player_id: 276, player_name: 'Erling Haaland', team_id: 50, goals: 28 },
            { player_id: 325, player_name: 'Harry Kane', team_id: 47, goals: 28 }, // Tied!
            { player_id: 184, player_name: 'Mohamed Salah', team_id: 40, goals: 28 }, // 3-way tie!
            { player_id: 190, player_name: 'Marcus Rashford', team_id: 33, goals: 25 }
          ]
        };

        const tiedGDTable = {
          ...baseLeagueTable,
          standings: baseLeagueTable.standings.map(team => {
            if (team.team_id === 33 || team.team_id === 50) {
              return { ...team, goals_difference: 45 }; // Tie for best GD
            }
            return team;
          })
        };

        return {
          leagueTable: tiedGDTable,
          topScorers: tiedTopScorers,
          expectedTopScorerIds: [276, 325, 184], // 3-way tie
          expectedBestGDTeamIds: [33, 50] // 2-way tie
        };

      case 'mixed-scenario':
        // One tie, one clear winner
        const mixedTopScorers = {
          ...baseTopScorers,
          players: [
            { player_id: 276, player_name: 'Erling Haaland', team_id: 50, goals: 28 },
            { player_id: 325, player_name: 'Harry Kane', team_id: 47, goals: 28 }, // 2-way tie
            { player_id: 184, player_name: 'Mohamed Salah', team_id: 40, goals: 25 }
          ]
        };

        return {
          leagueTable: baseLeagueTable, // Clear GD winner
          topScorers: mixedTopScorers,
          expectedTopScorerIds: [276, 325], // 2-way tie
          expectedBestGDTeamIds: [33] // Clear winner
        };

      default:
        return {
          leagueTable: baseLeagueTable,
          topScorers: baseTopScorers,
          expectedTopScorerIds: [276],
          expectedBestGDTeamIds: [33]
        };
    }
  };

  // Helper function to create user predictions
  const createUserPredictions = (predictions: {
    leagueWinner?: number;
    topScorer?: number;
    bestGoalDifference?: number;
    lastPlace?: number;
  }): UserSeasonAnswerRow[] => {
    const results: UserSeasonAnswerRow[] = [];

    if (predictions.leagueWinner !== undefined) {
      results.push({
        id: 1,
        user_id: 'test-user',
        question_type: 'league_winner',
        answered_team_id: predictions.leagueWinner,
        answered_player_id: null,
        season_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    }

    if (predictions.topScorer !== undefined) {
      results.push({
        id: 2,
        user_id: 'test-user',
        question_type: 'top_scorer',
        answered_team_id: null,
        answered_player_id: predictions.topScorer,
        season_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    }

    if (predictions.bestGoalDifference !== undefined) {
      results.push({
        id: 3,
        user_id: 'test-user',
        question_type: 'best_goal_difference',
        answered_team_id: predictions.bestGoalDifference,
        answered_player_id: null,
        season_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    }

    if (predictions.lastPlace !== undefined) {
      results.push({
        id: 4,
        user_id: 'test-user',
        question_type: 'last_place',
        answered_team_id: predictions.lastPlace,
        answered_player_id: null,
        season_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    }

    return results;
  };

  // Helper function to measure execution time
  const measurePerformance = async <T>(
    scenario: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const timeMs = endTime - startTime;
    
    performanceMetrics.push({ scenario, timeMs });
    return result;
  };

  describe('End-to-End Calculation Scenarios', () => {
    
    it('should handle single answer scenario correctly', async () => {
      const mockData = createMockLeagueData('single-answers');
      
      // Mock service responses
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      // User predictions - all correct
      const userPredictions = createUserPredictions({
        leagueWinner: 33, // Man United (correct)
        topScorer: 276, // Haaland (correct)
        bestGoalDifference: 33, // Man United (correct)
        lastPlace: 45 // Everton (correct)
      });

      const result = await measurePerformance('single-answers-all-correct', async () => {
        return calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions);
      });

      expect(result).not.toBeNull();
      expect(result!.totalPoints).toBe(12); // 4 correct × 3 points each
      expect(result!.details.leagueWinnerCorrect).toBe(true);
      expect(result!.details.topScorerCorrect).toBe(true);
      expect(result!.details.bestGoalDifferenceCorrect).toBe(true);
      expect(result!.details.lastPlaceCorrect).toBe(true);
    });

    it('should handle multiple ties scenario correctly', async () => {
      const mockData = createMockLeagueData('multiple-ties');
      
      // Mock service responses
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      // User predictions - picks one player from 3-way tie and one team from 2-way tie
      const userPredictions = createUserPredictions({
        leagueWinner: 33, // Man United (correct - still leading)
        topScorer: 325, // Harry Kane (correct - tied for top)
        bestGoalDifference: 50, // Man City (correct - tied for best GD)
        lastPlace: 45 // Everton (correct)
      });

      const result = await measurePerformance('multiple-ties-scenario', async () => {
        return calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions);
      });

      expect(result).not.toBeNull();
      expect(result!.totalPoints).toBe(12); // Should get points for tied positions
      expect(result!.details.topScorerCorrect).toBe(true); // Kane is tied for top
      expect(result!.details.bestGoalDifferenceCorrect).toBe(true); // Man City tied for best GD
      
      // Check multiple answer details
      expect(result!.details.comparisonDetails?.topScorer?.allValidAnswers).toHaveLength(3);
      expect(result!.details.comparisonDetails?.topScorer?.allValidAnswers).toContain(325);
      expect(result!.details.comparisonDetails?.bestGoalDifference?.allValidAnswers).toHaveLength(2);
      expect(result!.details.comparisonDetails?.bestGoalDifference?.allValidAnswers).toContain(50);
    });

    it('should handle mixed scenario (some ties, some single winners)', async () => {
      const mockData = createMockLeagueData('mixed-scenario');
      
      // Mock service responses
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      // User predictions - mixed success
      const userPredictions = createUserPredictions({
        leagueWinner: 50, // Man City (incorrect - Man United leads)
        topScorer: 276, // Haaland (correct - tied for top)
        bestGoalDifference: 33, // Man United (correct - clear leader)
        lastPlace: 39 // Wolves (incorrect - Everton is last)
      });

      const result = await measurePerformance('mixed-scenario', async () => {
        return calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions);
      });

      expect(result).not.toBeNull();
      expect(result!.totalPoints).toBe(6); // 2 correct × 3 points each
      expect(result!.details.leagueWinnerCorrect).toBe(false);
      expect(result!.details.topScorerCorrect).toBe(true); // Haaland tied for top
      expect(result!.details.bestGoalDifferenceCorrect).toBe(true); // Man United clear leader
      expect(result!.details.lastPlaceCorrect).toBe(false);
    });

    it('should handle user with no predictions gracefully', async () => {
      const mockData = createMockLeagueData('single-answers');
      
      // Mock service responses
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      const result = await measurePerformance('no-predictions', async () => {
        return calculator.calculateDynamicPoints('test-user', 140, 2024, []);
      });

      expect(result).toBeNull(); // User with no predictions should return null
      // No further checks needed since result is null as expected
    });

  });

  describe('Idempotency Verification', () => {
    
    it('should produce identical results when called multiple times with same data', async () => {
      const mockData = createMockLeagueData('multiple-ties');
      
      // Mock service responses
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      const userPredictions = createUserPredictions({
        leagueWinner: 33,
        topScorer: 276,
        bestGoalDifference: 50,
        lastPlace: 45
      });

      // Call multiple times and verify identical results
      const results = await Promise.all([
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions),
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions),
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions)
      ]);

      // All results should be identical
      const firstResult = results[0];
      expect(firstResult).not.toBeNull();

      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(firstResult);
      }
    });

    it('should maintain idempotency with edge case data', async () => {
      // Edge case: Empty arrays from service
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue({
        competition_api_id: 140,
        season_year: 2024,
        league_name: 'Test League',
        standings: []
      });
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(null);
      mockLeagueDataService.getTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue([]);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(null);

      const userPredictions = createUserPredictions({
        leagueWinner: 33,
        topScorer: 276
      });

      // Multiple calls with edge case data
      const results = await Promise.all([
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions),
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions),
        calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions)
      ]);

      // Verify all results are identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

  });

  describe('Performance Benchmarks', () => {
    
    it('should complete calculation within performance threshold', async () => {
      const mockData = createMockLeagueData('single-answers');
      
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      const userPredictions = createUserPredictions({
        leagueWinner: 33,
        topScorer: 276,
        bestGoalDifference: 33,
        lastPlace: 45
      });

      const result = await measurePerformance('performance-standard', async () => {
        return calculator.calculateDynamicPoints('test-user', 140, 2024, userPredictions);
      });

      expect(result).not.toBeNull();
      
      // Performance threshold: should complete within 50ms for standard scenario
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];
      expect(lastMetric.timeMs).toBeLessThan(50);
    });

  });

  describe('Backward Compatibility & Regression Tests', () => {
    
    it('should maintain exact same behavior for legacy single-answer scenarios', async () => {
      // This test ensures the new multiple-answer logic doesn't break existing functionality
      const mockData = createMockLeagueData('single-answers');
      
      mockLeagueDataService.getCurrentLeagueTable.mockResolvedValue(mockData.leagueTable);
      mockLeagueDataService.getLastPlaceTeam.mockResolvedValue(mockData.leagueTable.standings[mockData.leagueTable.standings.length - 1]);
      mockLeagueDataService.getTopScorers.mockResolvedValue(mockData.expectedTopScorerIds);
      mockLeagueDataService.getBestGoalDifferenceTeams.mockResolvedValue(mockData.expectedBestGDTeamIds);
      mockLeagueDataService.getCurrentTopScorers.mockResolvedValue([]);
      mockLeagueDataService.getTeamWithBestGoalDifference.mockResolvedValue(mockData.leagueTable.standings[0]);

      // Predictions that would have worked with old system
      const legacyStylePredictions = createUserPredictions({
        leagueWinner: 33,
        topScorer: 276,
        bestGoalDifference: 33,
        lastPlace: 45
      });

      const result = await calculator.calculateDynamicPoints('test-user', 140, 2024, legacyStylePredictions);

      // Results should be identical to what old system would produce
      expect(result).not.toBeNull();
      expect(result!.totalPoints).toBe(12);
      expect(result!.details.leagueWinnerCorrect).toBe(true);
      expect(result!.details.topScorerCorrect).toBe(true);
      expect(result!.details.bestGoalDifferenceCorrect).toBe(true);
      expect(result!.details.lastPlaceCorrect).toBe(true);

      // Enhanced details should be present but not affect core scoring
      expect(result!.details.comparisonDetails).toBeDefined();
      expect(result!.details.comparisonDetails?.topScorer?.allValidAnswers).toEqual([276]);
      expect(result!.details.comparisonDetails?.bestGoalDifference?.allValidAnswers).toEqual([33]);
    });

  });

}); 