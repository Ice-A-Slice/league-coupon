import { UserPerformanceAnalysisService, type UserPerformanceData } from '../userPerformanceAnalysisService';
import { generateAIContent, isAIAvailable } from '../openai';

// Mock dependencies
jest.mock('../openai');
jest.mock('../../utils/logger');

// Mock the OpenAI service
jest.mock('../openai', () => ({
  generateAIContent: jest.fn(),
  isAIAvailable: jest.fn(() => true)
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('UserPerformanceAnalysisService', () => {
  let service: UserPerformanceAnalysisService;

  const mockUserData: UserPerformanceData = {
    userId: 'user123',
    username: 'john_doe',
    totalRounds: 10,
    totalPoints: 85,
    averagePoints: 8.5,
    recentRounds: [
      { roundNumber: 8, points: 12, predictions: 10, correct: 8 },
      { roundNumber: 9, points: 6, predictions: 10, correct: 4 },
      { roundNumber: 10, points: 9, predictions: 10, correct: 6 }
    ],
    strongAreas: ['Home team predictions', 'Top 6 matches'],
    weakAreas: ['Away upsets', 'Lower league teams'],
    rankPosition: 5,
    totalPlayers: 20
  };

  const mockPoorPerformerData: UserPerformanceData = {
    userId: 'user456',
    username: 'struggling_user',
    totalRounds: 8,
    totalPoints: 35,
    averagePoints: 4.4,
    recentRounds: [
      { roundNumber: 6, points: 3, predictions: 10, correct: 2 },
      { roundNumber: 7, points: 4, predictions: 10, correct: 3 },
      { roundNumber: 8, points: 2, predictions: 10, correct: 1 }
    ],
    strongAreas: [],
    weakAreas: ['Most prediction categories'],
    rankPosition: 18,
    totalPlayers: 20
  };

  const mockTopPerformerData: UserPerformanceData = {
    userId: 'user789',
    username: 'league_leader',
    totalRounds: 12,
    totalPoints: 145,
    averagePoints: 12.1,
    recentRounds: [
      { roundNumber: 10, points: 15, predictions: 10, correct: 9 },
      { roundNumber: 11, points: 13, predictions: 10, correct: 8 },
      { roundNumber: 12, points: 14, predictions: 10, correct: 8 }
    ],
    strongAreas: ['All categories', 'Tactical analysis'],
    weakAreas: [],
    rankPosition: 1,
    totalPlayers: 20
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserPerformanceAnalysisService();
  });

  describe('User Analysis', () => {
    describe('Average Performer', () => {
      it('should analyze user performance successfully', async () => {
        const mockAnalysis = `
john_doe shows solid middle-tier performance with 85 points across 10 rounds.
Recent form is slightly inconsistent with scores of 12, 6, and 9 points.
Strong areas include home team predictions and top 6 matches.
Areas for improvement: away upsets and lower league team predictions.
Performance trend: Recent dip but overall stable progression.
Confidence level: moderate with room for tactical improvements.
        `;

        (generateAIContent as jest.Mock).mockResolvedValue(mockAnalysis);

        const result = await service.analyzeUserPerformance(mockUserData);

        expect(result).toBeDefined();
        expect(result.userId).toBe('user123');
        expect(result.summary).toContain('john_doe shows solid middle-tier performance');
        expect(result.strengths).toHaveLength(2);
        expect(result.improvementAreas).toHaveLength(2);
        expect(result.performanceTrend).toBe('stable');
        expect(result.confidenceLevel).toBe('moderate');
      });

      it('should handle user with recent improvement', async () => {
        const improvingUserData = {
          ...mockUserData,
          recentRounds: [
            { roundNumber: 8, points: 5, predictions: 10, correct: 3 },
            { roundNumber: 9, points: 8, predictions: 10, correct: 5 },
            { roundNumber: 10, points: 12, predictions: 10, correct: 8 }
          ]
        };

        const mockAnalysis = `
john_doe demonstrates excellent improvement with increasing scores.
Performance trend: Strong upward trajectory from 5 to 12 points.
        `;

        (generateAIContent as jest.Mock).mockResolvedValue(mockAnalysis);

        const result = await service.analyzeUserPerformance(improvingUserData);

        expect(result.performanceTrend).toBe('improving');
        expect(result.summary).toContain('improvement');
      });
    });

    describe('Poor Performer', () => {
      it('should provide encouraging analysis for struggling users', async () => {
        const mockAnalysis = `
struggling_user is working through a challenging period with 35 total points.
Recent rounds show consistent effort despite lower scores.
Focus areas: Most prediction categories need attention and strategy adjustment.
Performance trend: Current decline but potential for quick improvement.
Confidence level: Building foundations for future success.
        `;

        (generateAIContent as jest.Mock).mockResolvedValue(mockAnalysis);

        const result = await service.analyzeUserPerformance(mockPoorPerformerData);

        expect(result.summary).toContain('challenging period');
        expect(result.performanceTrend).toBe('declining');
        expect(result.confidenceLevel).toBe('building');
        expect(result.improvementAreas.length).toBeGreaterThan(0);
      });
    });

    describe('Top Performer', () => {
      it('should analyze top performer appropriately', async () => {
        const mockAnalysis = `
league_leader demonstrates exceptional performance with 145 points.
Consistently high scores with excellent tactical understanding.
Strengths: All categories show mastery, particularly tactical analysis.
Performance trend: Maintaining excellence with sustained high performance.
Confidence level: Very high with proven expertise.
        `;

        (generateAIContent as jest.Mock).mockResolvedValue(mockAnalysis);

        const result = await service.analyzeUserPerformance(mockTopPerformerData);

        expect(result.summary).toContain('exceptional performance');
        expect(result.performanceTrend).toBe('maintaining');
        expect(result.confidenceLevel).toBe('high');
        expect(result.strengths.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Improvement Suggestions', () => {
    it('should generate specific improvement suggestions', async () => {
      const mockSuggestions = `
1. Focus on researching away team form before making predictions
2. Study historical data for lower league teams to identify patterns
3. Consider home advantage factors more carefully in your analysis
4. Review recent injury reports before finalizing predictions
5. Track your prediction accuracy by category to identify weak spots
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockSuggestions);

      const suggestions = await service.generateImprovementSuggestions(mockUserData);

      expect(suggestions).toHaveLength(5);
      expect(suggestions[0]).toContain('Focus on researching away team form');
      expect(suggestions[4]).toContain('Track your prediction accuracy');
    });

    it('should provide beginner-friendly suggestions for new users', async () => {
      const newUserData = {
        ...mockUserData,
        totalRounds: 2,
        averagePoints: 3.0,
        rankPosition: 19
      };

      const mockSuggestions = `
1. Start by focusing on home team advantages
2. Follow team news and injury updates regularly
3. Begin with simpler predictions like home/away wins
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockSuggestions);

      const suggestions = await service.generateImprovementSuggestions(newUserData);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('home team advantages');
    });

    it('should handle users with no clear weak areas', async () => {
      const mockSuggestions = `
1. Continue your excellent analytical approach
2. Consider sharing insights with other league members
3. Focus on maintaining consistency in challenging fixtures
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockSuggestions);

      const suggestions = await service.generateImprovementSuggestions(mockTopPerformerData);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('Continue your excellent');
    });
  });

  describe('Motivational Messages', () => {
    it('should generate encouraging messages for average performers', async () => {
      const mockMessage = `
Keep up the solid work, john_doe! Your 8.5 average shows real potential.
Your recent 12-point round proves you can compete with the best.
Focus on those away upsets and you'll climb even higher in the rankings!
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockMessage);

      const message = await service.generateMotivationalMessage(mockUserData);

      expect(message).toContain('Keep up the solid work');
      expect(message).toContain('john_doe');
      expect(message).toContain('8.5 average');
    });

    it('should provide uplifting messages for struggling users', async () => {
      const mockMessage = `
Don't give up, struggling_user! Every expert was once a beginner.
Your recent effort shows dedication - the results will follow.
Small improvements each round will lead to big gains over time.
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockMessage);

      const message = await service.generateMotivationalMessage(mockPoorPerformerData);

      expect(message).toContain("Don't give up");
      expect(message).toContain('struggling_user');
      expect(message).toContain('effort shows dedication');
    });

    it('should celebrate top performers appropriately', async () => {
      const mockMessage = `
Outstanding work, league_leader! Your 12.1 average is truly impressive.
You're setting the standard for the entire league with your consistent excellence.
Keep sharing that tactical expertise that makes you #1!
      `;

      (generateAIContent as jest.Mock).mockResolvedValue(mockMessage);

      const message = await service.generateMotivationalMessage(mockTopPerformerData);

      expect(message).toContain('Outstanding work');
      expect(message).toContain('league_leader');
      expect(message).toContain('12.1 average');
    });
  });

  describe('Fallback Scenarios', () => {
    it('should provide fallback analysis when AI unavailable', async () => {
      (isAIAvailable as jest.Mock).mockReturnValue(false);

      const result = await service.analyzeUserPerformance(mockUserData);

      expect(result.summary).toContain('john_doe has completed 10 rounds');
      expect(result.summary).toContain('85 total points');
      expect(result.strengths).toEqual(['Home team predictions', 'Top 6 matches']);
      expect(result.improvementAreas).toEqual(['Away upsets', 'Lower league teams']);
      expect(result.performanceTrend).toBe('stable');
    });

    it('should provide fallback suggestions when AI fails', async () => {
      (generateAIContent as jest.Mock).mockRejectedValue(new Error('AI Error'));

      const suggestions = await service.generateImprovementSuggestions(mockUserData);

      expect(suggestions).toContain('Research team form and injury news');
      expect(suggestions).toContain('Focus on your identified weak areas: Away upsets, Lower league teams');
      expect(suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('should provide fallback motivational message when AI fails', async () => {
      (generateAIContent as jest.Mock).mockRejectedValue(new Error('AI Error'));

      const message = await service.generateMotivationalMessage(mockUserData);

      expect(message).toContain('Keep up the great work, john_doe!');
      expect(message).toContain('85 points');
      expect(message).toContain('position 5');
    });
  });

  describe('Data Analysis', () => {
    it('should correctly identify performance trends', async () => {
      const decliningData = {
        ...mockUserData,
        recentRounds: [
          { roundNumber: 8, points: 12, predictions: 10, correct: 8 },
          { roundNumber: 9, points: 8, predictions: 10, correct: 5 },
          { roundNumber: 10, points: 4, predictions: 10, correct: 2 }
        ]
      };

      (generateAIContent as jest.Mock).mockResolvedValue('Performance trend: declining');

      const result = await service.analyzeUserPerformance(decliningData);

      expect(result.performanceTrend).toBe('declining');
    });

    it('should handle users with minimal data', async () => {
      const minimalData: UserPerformanceData = {
        userId: 'newuser',
        username: 'newcomer',
        totalRounds: 1,
        totalPoints: 5,
        averagePoints: 5.0,
        recentRounds: [
          { roundNumber: 1, points: 5, predictions: 10, correct: 3 }
        ],
        strongAreas: [],
        weakAreas: ['Most areas'],
        rankPosition: 15,
        totalPlayers: 20
      };

      const result = await service.analyzeUserPerformance(minimalData);

      expect(result.userId).toBe('newuser');
      expect(result.summary).toBeDefined();
      expect(result.performanceTrend).toBeDefined();
    });

    it('should handle empty performance data gracefully', async () => {
      const emptyData: UserPerformanceData = {
        userId: 'empty-user',
        username: 'Empty User',
        totalRounds: 0,
        totalPoints: 0,
        averagePoints: 0,
        recentRounds: [],
        strongAreas: [],
        weakAreas: [],
        rankPosition: 0,
        totalPlayers: 1
      };
      
      const result = await service.analyzeUserPerformance(emptyData);
      
      expect(result).toEqual(expect.objectContaining({
        userId: 'empty-user',
        summary: expect.stringContaining('Empty User'),
        strengths: expect.any(Array),
        improvementAreas: expect.any(Array)
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed user data gracefully', async () => {
      const malformedData = {
        userId: '',
        username: '',
        totalRounds: -1,
        totalPoints: NaN,
        averagePoints: undefined,
        recentRounds: [],
        strongAreas: null,
        weakAreas: null,
        rankPosition: 999,
        totalPlayers: 0
      } as UserPerformanceData;

      const result = await service.analyzeUserPerformance(malformedData);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.strengths).toBeDefined();
      expect(result.improvementAreas).toBeDefined();
    });

    it('should handle AI service timeouts', async () => {
      (generateAIContent as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await service.analyzeUserPerformance(mockUserData);

      expect(result).toBeDefined();
      expect(result.summary).toContain('john_doe has completed 10 rounds');
    });
  });
}); 