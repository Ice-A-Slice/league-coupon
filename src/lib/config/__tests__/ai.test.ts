import { isAIConfigured, isFeatureEnabled, getAIProvider, parseBooleanFeature } from '../ai';

// Mock environment variables
const originalEnv = process.env;

describe('AI Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear all AI-related environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_ENABLED;
    delete process.env.STORY_GENERATION_ENABLED;
    delete process.env.MATCH_ANALYSIS_ENABLED;
    delete process.env.USER_ANALYSIS_ENABLED;
    delete process.env.AI_PROVIDER;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAIConfigured', () => {
    it('should return true when OpenAI API key is present', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isAIConfigured()).toBe(true);
    });

    it('should return false when OpenAI API key is missing', () => {
      expect(isAIConfigured()).toBe(false);
    });

    it('should return false when OpenAI API key is empty', () => {
      process.env.OPENAI_API_KEY = '';
      expect(isAIConfigured()).toBe(false);
    });
  });

  describe('Feature flags', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should return true for AI_ENABLED when set to true', () => {
      process.env.AI_ENABLED = 'true';
      expect(isFeatureEnabled('ai')).toBe(true);
    });

    it('should return false for AI_ENABLED when set to false', () => {
      process.env.AI_ENABLED = 'false';
      expect(isFeatureEnabled('ai')).toBe(false);
    });

    it('should default to true for AI_ENABLED when not set', () => {
      expect(isFeatureEnabled('ai')).toBe(true);
    });

    it('should handle STORY_GENERATION_ENABLED', () => {
      process.env.STORY_GENERATION_ENABLED = 'true';
      expect(isFeatureEnabled('storyGeneration')).toBe(true);

      process.env.STORY_GENERATION_ENABLED = 'false';
      expect(isFeatureEnabled('storyGeneration')).toBe(false);
    });

    it('should handle MATCH_ANALYSIS_ENABLED', () => {
      process.env.MATCH_ANALYSIS_ENABLED = 'true';
      expect(isFeatureEnabled('matchAnalysis')).toBe(true);

      process.env.MATCH_ANALYSIS_ENABLED = 'false';
      expect(isFeatureEnabled('matchAnalysis')).toBe(false);
    });

    it('should handle USER_ANALYSIS_ENABLED', () => {
      process.env.USER_ANALYSIS_ENABLED = 'true';
      expect(isFeatureEnabled('userAnalysis')).toBe(true);

      process.env.USER_ANALYSIS_ENABLED = 'false';
      expect(isFeatureEnabled('userAnalysis')).toBe(false);
    });

    it('should default to true for all features when not set', () => {
      expect(isFeatureEnabled('ai')).toBe(true);
      expect(isFeatureEnabled('storyGeneration')).toBe(true);
      expect(isFeatureEnabled('matchAnalysis')).toBe(true);
      expect(isFeatureEnabled('userAnalysis')).toBe(true);
    });

    it('should return false for any feature when AI is not configured', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.STORY_GENERATION_ENABLED = 'true';
      expect(isFeatureEnabled('storyGeneration')).toBe(false);
    });
  });

  describe('getAIProvider', () => {
    it('should return openai when AI_PROVIDER is openai', () => {
      process.env.AI_PROVIDER = 'openai';
      expect(getAIProvider()).toBe('openai');
    });

    it('should return openai when AI_PROVIDER is not set', () => {
      expect(getAIProvider()).toBe('openai');
    });

    it('should return custom provider when set', () => {
      process.env.AI_PROVIDER = 'custom-ai';
      expect(getAIProvider()).toBe('custom-ai');
    });
  });

  describe('parseBooleanFeature', () => {
    it('should parse true values correctly', () => {
      expect(parseBooleanFeature('true')).toBe(true);
      expect(parseBooleanFeature('TRUE')).toBe(true);
      expect(parseBooleanFeature('True')).toBe(true);
      expect(parseBooleanFeature('1')).toBe(true);
      expect(parseBooleanFeature('yes')).toBe(true);
      expect(parseBooleanFeature('YES')).toBe(true);
    });

    it('should parse false values correctly', () => {
      expect(parseBooleanFeature('false')).toBe(false);
      expect(parseBooleanFeature('FALSE')).toBe(false);
      expect(parseBooleanFeature('False')).toBe(false);
      expect(parseBooleanFeature('0')).toBe(false);
      expect(parseBooleanFeature('no')).toBe(false);
      expect(parseBooleanFeature('NO')).toBe(false);
    });

    it('should return default value for undefined input', () => {
      expect(parseBooleanFeature(undefined, true)).toBe(true);
      expect(parseBooleanFeature(undefined, false)).toBe(false);
    });

    it('should return default value for unrecognized input', () => {
      expect(parseBooleanFeature('maybe', true)).toBe(true);
      expect(parseBooleanFeature('unknown', false)).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly with complete AI configuration', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.AI_ENABLED = 'true';
      process.env.STORY_GENERATION_ENABLED = 'true';
      process.env.MATCH_ANALYSIS_ENABLED = 'false';

      expect(isAIConfigured()).toBe(true);
      expect(isFeatureEnabled('ai')).toBe(true);
      expect(isFeatureEnabled('storyGeneration')).toBe(true);
      expect(isFeatureEnabled('matchAnalysis')).toBe(false);
    });

    it('should handle missing configuration gracefully', () => {
      // No environment variables set
      expect(isAIConfigured()).toBe(false);
      expect(isFeatureEnabled('storyGeneration')).toBe(false);
      expect(getAIProvider()).toBe('openai');
    });
  });
}); 