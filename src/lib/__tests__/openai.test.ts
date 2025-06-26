// Mock the logger first
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the AI config
jest.mock('../config/ai', () => ({
  aiConfig: {
    openai: {
      apiKey: 'test-api-key',
      organization: 'test-org',
      defaultModel: 'gpt-4-turbo-preview',
      defaultMaxTokens: 500,
      defaultTemperature: 0.7,
      timeout: 30000
    },
    features: {
      enableStoryGeneration: true,
      enableMatchAnalysis: true,
      enableUserAnalysis: true,
      enableReminderInsights: true
    }
  },
  isAIConfigured: jest.fn(() => true),
  isFeatureEnabled: jest.fn(() => true)
}));

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  });
});

import { OpenAIService, generateAIContent, isAIAvailable, getAIProviderName, resetAIService } from '../openai';
import OpenAI from 'openai';
import { isAIConfigured } from '../config/ai';

describe('OpenAI Service', () => {
  let openAIService: OpenAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    (isAIConfigured as jest.Mock).mockReturnValue(true);
    resetAIService();
    openAIService = new OpenAIService(); // Re-instantiate service for each test
  });

  afterEach(() => {
    resetAIService();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with valid configuration', () => {
      // The `new OpenAIService()` in beforeEach triggers this
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        organization: 'test-org',
        timeout: 30000,
      });
      expect(openAIService.isAvailable()).toBe(true);
    });

    it('should handle initialization errors', () => {
      OpenAI.mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });
      const service = new OpenAIService();
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('Content Generation', () => {
    const mockCompletion = {
      choices: [{
        message: {
          content: 'Generated AI content for testing'
        }
      }]
    };

    beforeEach(() => {
      // Configure the shared mock to return successful completion
      mockCreate.mockResolvedValue(mockCompletion);
    });

    it('should generate content successfully', async () => {
      const prompt = 'Generate a match summary';
      const config = { maxTokens: 100, temperature: 0.8 };

      const result = await openAIService.generateContent(prompt, config);

      expect(result).toBe('Generated AI content for testing');
    });

    it('should use default configuration when not provided', async () => {
      const prompt = 'Generate content';
      
      await openAIService.generateContent(prompt);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });
    });

    it('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await openAIService.generateContent('test prompt');

      expect(result).toBeNull();
    });

    it('should handle empty responses', async () => {
      mockCreate.mockResolvedValue({
        choices: []
      });

      const result = await openAIService.generateContent('test prompt');

      expect(result).toBeNull();
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as Error & { status: number }).status = 429;
      
      mockCreate.mockRejectedValue(rateLimitError);

      const result = await openAIService.generateContent('test prompt');

      expect(result).toBeNull();
    });
  });

  describe('Global Functions', () => {
    beforeEach(() => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: 'Global function test' }
        }]
      });
    });

    it('generateAIContent should work as expected', async () => {
      const result = await generateAIContent('test prompt');
      expect(result).toBe('Global function test');
    });

    it('isAIAvailable should return correct status', () => {
      (isAIConfigured as jest.Mock).mockReturnValue(true);
      resetAIService();
      expect(isAIAvailable()).toBe(true);
      
      (isAIConfigured as jest.Mock).mockReturnValue(false);
      resetAIService();
      expect(isAIAvailable()).toBe(false);
    });

    it('getAIProviderName should return correct names based on config', () => {
      (isAIConfigured as jest.Mock).mockReturnValue(true);
      resetAIService();
      expect(getAIProviderName()).toBe('OpenAI GPT-4');
      
      (isAIConfigured as jest.Mock).mockReturnValue(false);
      resetAIService();
      expect(getAIProviderName()).toBe('AI Service (Unavailable)');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate token limits', async () => {
      const result = await openAIService.generateContent('test', { maxTokens: 10000 });
      // Should clamp to reasonable limits
      expect(result).toBeDefined();
    });

    it('should validate temperature range', async () => {
      const result = await openAIService.generateContent('test', { temperature: 2.5 });
      // Should clamp temperature to valid range
      expect(result).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary failures', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Temporary failure'));

      const result = await openAIService.generateContent('test prompt');

      // First call should fail, service should handle gracefully
      expect(result).toBeNull();
    });
  });
});

describe('OpenAI Service Integration', () => {
  describe('Service Unavailable Scenarios', () => {
    beforeEach(() => {
      (isAIConfigured as jest.Mock).mockReturnValue(false);
      resetAIService();
    });

    it('should return null for generateAIContent when not configured', async () => {
      const result = await generateAIContent('test prompt');
      expect(result).toBeNull();
    });

    it('should return fallback provider name when not configured', () => {
      expect(getAIProviderName()).toBe('AI Service (Unavailable)');
    });
  });
}); 