import { MatchAnalysisService } from '../matchAnalysisService';
import { generateAIContent, isAIAvailable } from '../openai';

// Mock dependencies
jest.mock('../openai');

// Mock the AI content generation
jest.mock('../openai', () => ({
  generateAIContent: jest.fn(),
  isAIAvailable: jest.fn(() => true),
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('MatchAnalysisService', () => {
  let service: MatchAnalysisService;

  const mockCompletedMatch: MatchData = {
    id: 1,
    status: 'completed',
    homeTeam: { id: 1, name: 'Manchester United', logo: '', form: 'WWLWD' },
    awayTeam: { id: 2, name: 'Liverpool', logo: '', form: 'WWDLL' },
    homeScore: 2,
    awayScore: 1,
    kickoff: new Date().toISOString(),
  };

  const mockUpcomingMatch: MatchData = {
    id: 2,
    status: 'upcoming',
    homeTeam: { id: 3, name: 'Arsenal', logo: '', form: 'WWWWW' },
    awayTeam: { id: 4, name: 'Chelsea', logo: '', form: 'LDWLW' },
    homeScore: null,
    awayScore: null,
    kickoff: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchAnalysisService();
    (generateAIContent as jest.Mock).mockImplementation((prompt: string) => {
      if (prompt.includes('Analyze this completed Premier League match:')) {
        if (prompt.includes('Manchester United vs Liverpool (2-1)')) {
          return Promise.resolve(`
            Manchester United secured a crucial 2-1 victory over Liverpool.
            - The home side dominated possession and created more clear-cut chances.
            - United's clinical finishing proved the difference.
            Surprise factor: medium
            Prediction difficulty: moderate
            Tactical note: United's high press was effective.
          `);
        }
      }
      if (prompt.includes('Analyze this upcoming Premier League fixture')) {
        if (prompt.includes('Arsenal vs Chelsea')) {
          return Promise.resolve(`
            Arsenal host Chelsea in a highly anticipated London derby.
            Prediction difficulty: difficult
          `);
        }
      }
      if (prompt.includes('Analyze Premier League Round 15 analysis')) {
         if (prompt.includes('Average goals per match: 3.0')) {
            return Promise.resolve(`
              Round 15 saw some exciting attacking football.
              Top performers: Arsenal, Man City
              Surprise results: Brighton 2-1 Tottenham
              Tactical trends: High-pressing strategies were prominent.
            `);
         }
         return Promise.resolve(`Round 15 featured 0 completed matches.`);
      }
      if (prompt.includes('Provide prediction insights for these upcoming matches')) {
        return Promise.resolve('Manchester United vs Arsenal looks the most predictable given current form.');
      }
      if (prompt.includes('Surprise factor: high')) {
        return Promise.resolve('Surprise factor: high. Prediction difficulty: difficult.');
      }
      return Promise.resolve('Default AI response');
    });
  });

  describe('Match Analysis', () => {
    describe('Completed Matches', () => {
      it('should analyze completed match successfully', async () => {
        const result = await service.analyzeMatch(mockCompletedMatch);
        
        expect(result.matchId).toBe(1);
        expect(result.summary).toContain('Manchester United secured a crucial 2-1 victory');
        expect(result.keyInsights.length).toBeGreaterThan(0);
        expect(result.surpriseFactor).toBe('medium');
        expect(result.predictionDifficulty).toBe('moderate');
        expect(result.tacticalAnalysis).toContain("United's high press was effective");
      });

      it('should handle matches with detailed stats', async () => {
        const matchWithStats = {
          ...mockCompletedMatch,
          stats: { shots: '15-8', possession: '60-40', xg: '2.1-0.9' }
        };
        await service.analyzeMatch(matchWithStats);
        expect(generateAIContent).toHaveBeenCalledWith(
          expect.stringContaining('"possession":"60-40"'),
          expect.any(Object)
        );
      });
    });

    describe('Upcoming Matches', () => {
      it('should analyze upcoming match for predictions', async () => {
        const result = await service.analyzeMatch(mockUpcomingMatch);

        expect(result.matchId).toBe(2);
        expect(result.summary).toContain('Arsenal host Chelsea');
        expect(result.predictionDifficulty).toBe('difficult');
      });
    });

    describe('Fallback Scenarios', () => {
      it('should provide fallback analysis when AI unavailable', async () => {
        (isAIAvailable as jest.Mock).mockReturnValue(false);
        const result = await service.analyzeMatch(mockCompletedMatch);
        
        expect(result.summary).toBe('Manchester United 2 - 1 Liverpool');
        expect(result.keyInsights).toContain('The result reflects current form');
        expect(result.surpriseFactor).toBe('low');
        expect(result.predictionDifficulty).toBe('easy');
      });

      it('should handle AI generation errors gracefully', async () => {
        (isAIAvailable as jest.Mock).mockReturnValue(true);
        (generateAIContent as jest.Mock).mockRejectedValue(new Error('AI fail'));
        
        const result = await service.analyzeMatch(mockCompletedMatch);
        
        expect(result.summary).toBe('Manchester United 2 - 1 Liverpool');
        expect(result.keyInsights).toEqual([
          'Both teams showed competitive spirit',
          'The result reflects current form',
        ]);
      });
    });
  });

  describe('Round Analysis', () => {
    const mockRoundMatches: MatchData[] = [
      mockCompletedMatch,
      { ...mockUpcomingMatch, homeTeam: { id: 5, name: 'Spurs', logo: '', form: 'LLWWD' }, awayTeam: { id: 6, name: 'Man City', logo: '', form: 'WWWWL' } },
      { id: 3, status: 'completed', homeScore: 3, awayScore: 0, homeTeam: { id: 3, name: 'Arsenal', logo: '', form: 'WWWWW' }, awayTeam: { id: 7, name: 'Fulham', logo: '', form: 'LDLLL' }, kickoff: new Date().toISOString() },
    ];

    it('should analyze round trends successfully', async () => {
      const result = await service.analyzeRound(mockRoundMatches, 15);
      
      expect(result.roundNumber).toBe(15);
      expect(result.overallTrends).toContain('Round 15 saw some exciting attacking football');
      expect(result.topPerformers).toEqual(['Arsenal', 'Man City']);
      expect(result.surpriseResults).toHaveLength(1);
      expect(result.tacticalTrends).toContain('High-pressing strategies');
    });

    it('should calculate round statistics correctly', async () => {
      await service.analyzeRound(mockRoundMatches, 15);

      expect(generateAIContent).toHaveBeenCalledWith(
        expect.stringContaining('Average goals per match: 3.0'),
        expect.any(Object)
      );
    });

    it('should handle empty match list', async () => {
      const result = await service.analyzeRound([], 15);

      expect(result.roundNumber).toBe(15);
      expect(result.overallTrends).toContain('Round 15 featured 0 completed matches');
      expect(result.topPerformers).toEqual([]);
      expect(result.surpriseResults).toEqual([]);
    });
  });

  describe('Prediction Insights', () => {
    const mockUpcomingMatches: MatchData[] = [
        mockUpcomingMatch,
        { id: 4, status: 'upcoming', homeTeam: { id: 1, name: 'Manchester United', logo: '', form: 'WWLWD' }, awayTeam: { id: 3, name: 'Arsenal', logo: '', form: 'WWWWW' }, homeScore: null, awayScore: null, kickoff: new Date().toISOString() },
    ];

    it('should generate prediction insights for upcoming matches', async () => {
      const result = await service.generatePredictionInsights(mockUpcomingMatches);

      expect(result).toContain('Manchester United vs Arsenal looks the most predictable');
      expect(generateAIContent).toHaveBeenCalledWith(
        expect.stringContaining('Manchester United vs Arsenal'),
        expect.objectContaining({ maxTokens: 300 })
      );
    });

    it('should handle matches without form data', async () => {
      const matchesWithoutForm = [{ ...mockUpcomingMatch, homeTeam: { id: 1, name: 'United', logo: '' }, awayTeam: { id: 3, name: 'Arsenal', logo: '' } }];
      (generateAIContent as jest.Mock).mockResolvedValue('Basic prediction insights');

      const result = await service.generatePredictionInsights(matchesWithoutForm);
      
      expect(result).toBe('Basic prediction insights');
      expect(generateAIContent).toHaveBeenCalledWith(
        expect.stringContaining('United vs Arsenal'),
        expect.any(Object)
      );
    });

    it('should provide fallback insights when AI unavailable', async () => {
      (isAIAvailable as jest.Mock).mockReturnValue(false);
      const result = await service.generatePredictionInsights(mockUpcomingMatches);

      expect(result).toContain('Focus on recent form, head-to-head records');
    });
  });

  describe('Analysis Parsing', () => {
    it('should extract surprise factor correctly', async () => {
      // Clear the complex beforeEach mock and set a simple one
      (generateAIContent as jest.Mock).mockReset();
      (generateAIContent as jest.Mock).mockResolvedValue('Surprise factor: high.');
      (isAIAvailable as jest.Mock).mockReturnValue(true);
      
      const result = await service.analyzeMatch(mockCompletedMatch);
      
      expect(result.surpriseFactor).toBe('high');
    });

    it('should extract difficulty level correctly', async () => {
      // Clear the complex beforeEach mock and set a simple one
      (generateAIContent as jest.Mock).mockReset();
      (generateAIContent as jest.Mock).mockResolvedValue('Prediction difficulty: difficult.');
      (isAIAvailable as jest.Mock).mockReturnValue(true);
      
      const result = await service.analyzeMatch(mockCompletedMatch);
      
      expect(result.predictionDifficulty).toBe('difficult');
    });

    it('should default to reasonable values for unclear analysis', async () => {
      // Clear the complex beforeEach mock and set a simple one
      (generateAIContent as jest.Mock).mockReset();
      (generateAIContent as jest.Mock).mockResolvedValue('A standard match occurred.');
      (isAIAvailable as jest.Mock).mockReturnValue(true);
      
      const result = await service.analyzeMatch(mockCompletedMatch);

      expect(result.surpriseFactor).toBe('medium');
      expect(result.predictionDifficulty).toBe('moderate');
    });
  });
}); 