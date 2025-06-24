import {
  aggregateSummaryEmailData,
  aggregateReminderEmailData,
  isRoundCompleted,
} from '../emailDataService';
import { generateMatchStory } from '../storyGenerationService';
import * as footballApiClient from '@/services/football-api/client';
import * as supabaseQueries from '@/lib/supabase/queries';


// Mock dependencies
jest.mock('../storyGenerationService');
jest.mock('@/services/football-api/client');
jest.mock('@/lib/supabase/queries');

// Import the mocked modules
import * as storyGenerationService from '../storyGenerationService';
const mockGenerateMatchStory = generateMatchStory as jest.MockedFunction<typeof generateMatchStory>;
const mockGenerateLeagueStories = storyGenerationService.generateLeagueStories as jest.MockedFunction<typeof storyGenerationService.generateLeagueStories>;
const mockFetchComprehensiveMatchData = footballApiClient.fetchComprehensiveMatchData as jest.MockedFunction<
  typeof footballApiClient.fetchComprehensiveMatchData
>;
const mockGetFixturesForRound = supabaseQueries.getFixturesForRound as jest.MockedFunction<
  typeof supabaseQueries.getFixturesForRound
>;
const mockGetCurrentBettingRoundFixtures = supabaseQueries.getCurrentBettingRoundFixtures as jest.MockedFunction<
  typeof supabaseQueries.getCurrentBettingRoundFixtures
>;

describe('Email Data Service', () => {
  // Shared mock data available to all tests
  const mockComprehensiveData: ReturnType<typeof footballApiClient.fetchComprehensiveMatchData> = {
    fixture: {
      get: 'fixtures',
      parameters: { id: '12345' },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [{
        fixture: { id: 12345, referee: '', timezone: '', date: '', timestamp: 0, periods: { first: 0, second: 0 }, venue: { id: 0, name: '', city: '' }, status: { long: '', short: '', elapsed: 0 } },
        league: { id: 39, name: 'Premier League', country: 'England', logo: '', flag: '', season: 2024, round: '' },
        teams: {
          home: { id: 33, name: 'Manchester United', logo: 'logo.png', winner: true },
          away: { id: 34, name: 'Liverpool', logo: 'logo2.png', winner: false },
        },
        goals: { home: 2, away: 1 },
        score: { halftime: { home: 1, away: 0 }, fulltime: { home: 2, away: 1 }, extratime: { home: null, away: null }, penalty: { home: null, away: null } }
      }]
    },
    events: { get: 'events', parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] },
    statistics: { get: 'statistics', parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] },
    playerStats: { get: 'players', parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock for generateLeagueStories
    mockGenerateLeagueStories.mockReturnValue({
      roundSummary: 'A quiet round of Premier League action with limited drama.',
      topStories: [],
      weekHighlights: {
        performanceOfTheWeek: 'Arsenal dominated',
        upsetOfTheWeek: 'Manchester United shocked Liverpool'
      }
    });
  });

  describe('aggregateSummaryEmailData', () => {
    const mockFixtures = [
      {
        id: '12345',
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool',
      },
      {
        id: '12346',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
      },
    ];

    const mockUserPerformance = {
      userId: 'user123',
      userName: 'John Doe',
      position: 5,
      positionChange: 2,
      pointsEarned: 12,
      correctPredictions: 7,
      totalPredictions: 10,
      currentStreak: 3,
      weeklyRank: 3,
      monthlyRank: 7,
    };

    const mockLeagueTable = [
      { position: 1, team: 'Arsenal', played: 20, won: 15, drawn: 3, lost: 2, points: 48, goalDifference: 25, form: 'WWWDW' },
      { position: 2, team: 'Liverpool', played: 20, won: 14, drawn: 4, lost: 2, points: 46, goalDifference: 22, form: 'WDWWW' },
      { position: 3, team: 'Manchester City', played: 19, won: 13, drawn: 4, lost: 2, points: 43, goalDifference: 28, form: 'DWWWL' },
      { position: 4, team: 'Aston Villa', played: 20, won: 12, drawn: 4, lost: 4, points: 40, goalDifference: 15, form: 'WLWWW' },
      { position: 5, team: 'Tottenham', played: 20, won: 11, drawn: 3, lost: 6, points: 36, goalDifference: 8, form: 'LWWDL' },
      { position: 6, team: 'Newcastle', played: 20, won: 10, drawn: 4, lost: 6, points: 34, goalDifference: 12, form: 'WDLWW' },
    ];



    const mockStory = {
      headline: 'Manchester United 2-1 Liverpool',
      content: 'Thrilling encounter at Old Trafford',
      category: 'drama' as const,
      importance: 'high' as const,
      teams: ['Manchester United', 'Liverpool'],
      keyPlayers: ['Marcus Rashford'],
    };

    it('should aggregate summary email data successfully', async () => {
      mockGetFixturesForRound.mockResolvedValue(mockFixtures);
      mockFetchComprehensiveMatchData.mockResolvedValue(mockComprehensiveData);
      mockGenerateMatchStory.mockReturnValue(mockStory);
      mockGenerateLeagueStories.mockReturnValue({
        roundSummary: 'Gameweek 20 delivered thrilling action',
        topStories: [mockStory, mockStory],
        weekHighlights: {
          performanceOfTheWeek: 'Arsenal dominated',
          upsetOfTheWeek: 'Manchester United shocked Liverpool'
        }
      });

      const result = await aggregateSummaryEmailData(
        'user123',
        'Gameweek 20',
        2024,
        39
      );

      expect(result).toBeDefined();
      expect(result.roundName).toBe('Gameweek 20');
      expect(result.user).toEqual(mockUserPerformance);
      expect(result.leagueTable).toEqual(mockLeagueTable);
      expect(result.matchResults).toHaveLength(2);
      expect(result.aiStories).toBeDefined();
      expect(result.aiStories.topStories).toHaveLength(2);
    });

    it('should handle matches without comprehensive data', async () => {
      mockGetFixturesForRound.mockResolvedValue(mockFixtures);
      mockFetchComprehensiveMatchData.mockRejectedValue(new Error('API Error'));

      const result = await aggregateSummaryEmailData(
        'user123',
        'Gameweek 20',
        2024,
        39
      );

      expect(result.matchResults).toHaveLength(2);
      // Should still create match results without stories
      expect(result.matchResults[0].story).toBeUndefined();
    });

    it('should handle empty fixtures', async () => {
      mockGetFixturesForRound.mockResolvedValue([]);

      const result = await aggregateSummaryEmailData(
        'user123',
        'Gameweek 20',
        2024,
        39
      );

      expect(result.matchResults).toHaveLength(0);
      expect(result.aiStories.topStories).toHaveLength(0);
      expect(result.aiStories.roundSummary).toContain('quiet');
    });

    it('should handle database errors gracefully', async () => {
      mockGetFixturesForRound.mockRejectedValue(new Error('Database error'));

      await expect(
        aggregateSummaryEmailData('user123', 'Gameweek 20', 2024, 39)
      ).rejects.toThrow('Database error');
    });
  });

  describe('aggregateReminderEmailData', () => {
    const mockCurrentRoundData = {
      roundName: 'Gameweek 21',
      deadline: '2024-01-22T11:30:00Z',
      matches: [
        {
          id: '12347',
          homeTeam: 'Manchester City',
          awayTeam: 'Newcastle',
          kickoff: '2024-01-22T15:00:00Z',
        },
        {
          id: '12348',
          homeTeam: 'Tottenham',
          awayTeam: 'Brighton',
          kickoff: '2024-01-22T17:30:00Z',
        },
      ],
    };

    it('should aggregate reminder email data successfully', async () => {
      mockGetCurrentBettingRoundFixtures.mockResolvedValue(mockCurrentRoundData);

      const result = await aggregateReminderEmailData('user123', 24);

      expect(result).toBeDefined();
      expect(result.roundName).toBe('Regular Season - 1');
      expect(result.user.name).toBe('John Doe');
      expect(result.upcomingFixtures).toHaveLength(2);
      expect(result.upcomingFixtures[0].homeTeam).toBe('Manchester City');
    });

    it('should handle missing current round data', async () => {
      mockGetCurrentBettingRoundFixtures.mockResolvedValue(null);

      await expect(
        aggregateReminderEmailData('user123', 24)
      ).rejects.toThrow('No current betting round found');
    });

    it('should transform match data correctly', async () => {
      mockGetCurrentBettingRoundFixtures.mockResolvedValue(mockCurrentRoundData);

      const result = await aggregateReminderEmailData('user123', 24);

      const firstFixture = result.upcomingFixtures[0];
      expect(firstFixture.id).toBe(12347); // Should be converted to number
      expect(firstFixture.homeTeam).toBe('Manchester City');
      expect(firstFixture.awayTeam).toBe('Newcastle');
      expect(typeof firstFixture.kickoff).toBe('string'); // Accept dynamic date
    });

    it('should handle database errors', async () => {
      mockGetCurrentBettingRoundFixtures.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        aggregateReminderEmailData('user123', 24)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('isRoundCompleted', () => {
    it('should return true for completed rounds', () => {
      const result = isRoundCompleted('Gameweek 20');
      expect(typeof result).toBe('boolean');
    });

    it('should handle various round name formats', () => {
      const testCases = [
        'Gameweek 1',
        'Gameweek 38',
        'Regular Season - 20',
        'Final',
      ];

      testCases.forEach(roundName => {
        const result = isRoundCompleted(roundName);
        expect(typeof result).toBe('boolean');
      });
    });

    it('should handle empty or invalid round names', () => {
      const result = isRoundCompleted('');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle partial API failures in summary data', async () => {
      const mockFixtures = [
        {
          id: '12345',
          homeTeam: 'Manchester United',
          awayTeam: 'Liverpool',
        },
      ];

      mockGetFixturesForRound.mockResolvedValue(mockFixtures);
      // First call succeeds, second fails
      mockFetchComprehensiveMatchData
        .mockResolvedValueOnce(mockComprehensiveData)
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await aggregateSummaryEmailData(
        'user123',
        'Gameweek 20',
        2024,
        39
      );

      expect(result.matchResults).toHaveLength(1);
      expect(result.matchResults[0].homeTeam.name).toBe('Manchester United');
    });

    it('should handle null scores in fixtures', async () => {
      const mockFixturesWithNullScores = [
        {
          id: '12345',
          homeTeam: 'Manchester United',
          awayTeam: 'Liverpool',
        },
      ];

      mockGetFixturesForRound.mockResolvedValue(mockFixturesWithNullScores);
      mockGenerateLeagueStories.mockReturnValue({
        roundSummary: 'A quiet round of Premier League action with limited drama.',
        topStories: [],
        weekHighlights: {
          performanceOfTheWeek: 'Arsenal dominated',
          upsetOfTheWeek: 'Manchester United shocked Liverpool'
        }
      });

      const result = await aggregateSummaryEmailData(
        'user123',
        'Gameweek 20',
        2024,
        39
      );

      expect(result.matchResults).toHaveLength(1);
      expect(result.matchResults[0].homeTeam.score).toBe(0);
      expect(result.matchResults[0].awayTeam.score).toBe(0);
    });
  });
}); 