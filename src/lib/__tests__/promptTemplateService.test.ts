import { PromptTemplateService, type PromptContext } from '../promptTemplateService';

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService();
  });

  describe('Match Story Generation', () => {
    it('should generate match story prompt with context', () => {
      const context: PromptContext = {
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool',
        homeScore: 2,
        awayScore: 1
      };

      const { prompt, config } = service.generateMatchStoryPrompt(context);

      expect(prompt).toContain('Manchester United vs Liverpool');
      expect(prompt).toContain('Final Score: 2-1');
      expect(config.maxTokens).toBe(300);
      expect(config.temperature).toBe(0.8);
    });

    it('should handle match without scores', () => {
      const context = {
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea'
      };

      const { prompt } = service.generateMatchStoryPrompt(context);

      expect(prompt).toContain('Arsenal vs Chelsea');
      expect(prompt).not.toContain('Final Score');
    });
  });

  describe('User Analysis Generation', () => {
    it('should generate user analysis prompt', () => {
      const context: PromptContext = {
        username: 'john_doe',
        totalPoints: 85,
        averagePoints: 8.5,
        ranking: '5th out of 20 players'
      };

      const { prompt, config } = service.generateUserAnalysisPrompt(context);

      expect(prompt).toContain('john_doe');
      expect(prompt).toContain('85 total points');
      expect(config.maxTokens).toBe(400);
      expect(config.temperature).toBe(0.6);
    });
  });

  describe('Email Content Generation', () => {
    it('should generate email content prompt', () => {
      const context: PromptContext = {
        emailType: 'summary',
        recipientName: 'John',
        roundNumber: 10
      };

      const { prompt, config } = service.generateEmailContentPromptForTest(context);

      expect(prompt).toContain('Round 10 Summary Email');
      expect(prompt).toContain('John');
      expect(config.maxTokens).toBe(500);
      expect(config.temperature).toBe(0.7);
    });
  });

  describe('Match Analysis Generation', () => {
    it('should generate match analysis prompt', () => {
      const context: PromptContext = {
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        homeForm: 'WWWDW',
        awayForm: 'WDLWL',
        isCompleted: true,
        homeScore: 2,
        awayScore: 1
      };

      const { prompt, config } = service.generateMatchAnalysisPromptForTest(context);

      expect(prompt).toContain('Arsenal vs Chelsea');
      expect(prompt).toContain('Final Score: 2-1');
      expect(config.maxTokens).toBe(300);
      expect(config.temperature).toBe(0.7);
    });
  });

  describe('Improvement Suggestions Generation', () => {
    it('should generate improvement suggestions prompt', () => {
      const context: PromptContext = {
        username: 'player123',
        currentLevel: 'intermediate',
        weakAreas: ['Away predictions'],
        averagePoints: 6.5
      };

      const { prompt, config } = service.generateImprovementSuggestionsPrompt(context);

      expect(prompt).toContain('player123');
      expect(prompt).toContain('intermediate level');
      expect(config.maxTokens).toBe(350);
      expect(config.temperature).toBe(0.6);
    });
  });

  describe('Motivational Message Generation', () => {
    it('should generate motivational message prompt', () => {
      const context: PromptContext = {
        username: 'alex_player',
        recentPerformance: 'improving',
        ranking: '8th out of 25'
      };

      const { prompt, config } = service.generateMotivationalMessagePrompt(context);

      expect(prompt).toContain('alex_player');
      expect(prompt).toContain('improving performance');
      expect(config.maxTokens).toBe(200);
      expect(config.temperature).toBe(0.8);
    });
  });

  describe('Configuration Management', () => {
    it('should return appropriate configs for different content types', () => {
      const matchConfig = service.generateMatchStoryPrompt({ homeTeam: 'A', awayTeam: 'B' }).config;
      const userConfig = service.generateUserAnalysisPrompt({ 
        username: 'test', 
        totalPoints: 50, 
        averagePoints: 5.0,
        ranking: '10th out of 20'
      }).config;

      expect(matchConfig.temperature).toBe(0.8);
      expect(userConfig.temperature).toBe(0.6);
      expect(matchConfig.maxTokens).toBe(300);
      expect(userConfig.maxTokens).toBe(400);
    });
  });
});
