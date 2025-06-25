import {
  StoryGenerationService,
  storyGenerationService,
  type MatchData,
  type StoryGenerationContext,
  type StandingsData,
  type UserPerformanceData,
} from '../storyGenerationService';
import { generateAIContent, isAIAvailable } from '../openai';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../openai');
jest.mock('../../utils/logger');

const mockGenerateAIContent = generateAIContent as jest.MockedFunction<typeof generateAIContent>;
const mockIsAIAvailable = isAIAvailable as jest.MockedFunction<typeof isAIAvailable>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Story Generation Service', () => {
  let service: StoryGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAIAvailable.mockReturnValue(false); // Default to fallback mode
    service = new StoryGenerationService();
  });

  describe('StoryGenerationService class', () => {
    it('should be instantiated correctly', () => {
      expect(service).toBeInstanceOf(StoryGenerationService);
    });

    it('should have a generateStory method', () => {
      expect(typeof service.generateStory).toBe('function');
    });
  });

  describe('generateStory method', () => {
    it('should return fallback content when AI is not available', async () => {
      const result = await service.generateStory('Test prompt', 'title_race');
      
      expect(result).toBe('The title race continues to heat up with exciting developments this round.');
    });

    it('should return fallback content for match drama type', async () => {
      const result = await service.generateStory('Test prompt', 'match_drama');
      
      expect(result).toBe('This round delivered plenty of drama and excitement across all fixtures.');
    });

    it('should return fallback content for performance type', async () => {
      const result = await service.generateStory('Test prompt', 'performance');
      
      expect(result).toBe('Your prediction performance this round shows great insight and strategy.');
    });

    it('should return default fallback for unknown type', async () => {
      const result = await service.generateStory('Test prompt', 'unknown_type');
      
      expect(result).toBe('Another thrilling round of Premier League action has concluded.');
    });
  });

  describe('exported service instance', () => {
    it('should export a default service instance', () => {
      expect(storyGenerationService).toBeInstanceOf(StoryGenerationService);
    });

    it('should be able to generate stories using the exported instance', async () => {
      const result = await storyGenerationService.generateStory('Test prompt', 'title_race');
      
      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
      if (result) {
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('type definitions', () => {
    it('should have correct MatchData structure', () => {
      const mockMatch: MatchData = {
        id: 12345,
        homeTeam: { name: 'Manchester United' },
        awayTeam: { name: 'Liverpool' },
        homeScore: 2,
        awayScore: 1,
        status: 'finished',
        kickoff: '2024-01-15T15:00:00Z',
        venue: 'Old Trafford',
        events: [
          {
            type: 'goal',
            minute: 23,
            player: 'Marcus Rashford',
            team: 'home',
          },
        ],
      };

      expect(mockMatch.id).toBe(12345);
      expect(mockMatch.homeTeam.name).toBe('Manchester United');
      expect(mockMatch.events?.[0].type).toBe('goal');
    });

    it('should have correct StandingsData structure', () => {
      const mockStandings: StandingsData = {
        userId: 'user123',
        username: 'John Doe',
        position: 5,
        points: 120,
        previousPosition: 7,
        pointsChange: 15,
      };

      expect(mockStandings.userId).toBe('user123');
      expect(mockStandings.position).toBe(5);
    });

    it('should have correct UserPerformanceData structure', () => {
      const mockPerformance: UserPerformanceData = {
        userId: 'user123',
        username: 'John Doe',
        correctPredictions: 7,
        totalPredictions: 10,
        pointsEarned: 21,
        bestPrediction: {
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          prediction: '2-1',
          points: 5,
        },
      };

      expect(mockPerformance.correctPredictions).toBe(7);
      expect(mockPerformance.bestPrediction?.points).toBe(5);
    });

    it('should have correct StoryGenerationContext structure', () => {
      const mockContext: StoryGenerationContext = {
        roundNumber: 20,
        matches: [
          {
            id: 12345,
            homeTeam: { name: 'Manchester United' },
            awayTeam: { name: 'Liverpool' },
            status: 'finished',
            kickoff: '2024-01-15T15:00:00Z',
          },
        ],
        standings: [
          {
            userId: 'user1',
            username: 'Player 1',
            position: 1,
            points: 150,
          },
        ],
        userPerformance: {
          userId: 'user123',
          username: 'John Doe',
          correctPredictions: 7,
          totalPredictions: 10,
          pointsEarned: 21,
        },
      };

      expect(mockContext.roundNumber).toBe(20);
      expect(mockContext.matches).toHaveLength(1);
      expect(mockContext.standings).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle empty prompts gracefully', async () => {
      const result = await service.generateStory('', 'title_race');
      
      expect(result).toBe('The title race continues to heat up with exciting developments this round.');
    });

    it('should handle null prompts gracefully', async () => {
      const result = await service.generateStory(null as string, 'match_drama');
      
      expect(result).toBe('This round delivered plenty of drama and excitement across all fixtures.');
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockGenerateAIContent.mockRejectedValue(error);
      mockIsAIAvailable.mockReturnValue(true);

      const result = await service.generateStory('Test prompt', 'title_race');

      expect(result).toBe('The title race continues to heat up with exciting developments this round.');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'StoryGenerationService: Failed to generate story',
        expect.objectContaining({ error, type: 'title_race' })
      );
    });

    it('should handle malformed API responses', async () => {
      mockGenerateAIContent.mockResolvedValue(null);
      mockIsAIAvailable.mockReturnValue(true);

      const result = await service.generateStory('Test prompt', 'title_race');

      expect(result).toBe('The title race continues to heat up with exciting developments this round.');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'StoryGenerationService: Failed to generate story',
        expect.objectContaining({ error: null, type: 'title_race' })
      );
    });
  });

  describe('integration with AI service', () => {
    it('should use fallback when AI is not available', async () => {
      // AI is mocked to return false for isAIAvailable
      const result = await service.generateStory('Generate a story about title race', 'title_race');
      
      expect(result).toBe('The title race continues to heat up with exciting developments this round.');
    });
  });
});