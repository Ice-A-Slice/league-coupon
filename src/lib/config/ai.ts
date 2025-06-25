import 'server-only';

/**
 * Parse integer with fallback to default value
 */
function parseIntWithDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float with fallback to default value
 */
function parseFloatWithDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean feature flag with proper handling of different values
 */
export function parseBooleanFeature(value: string | undefined, defaultValue: boolean = true): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase().trim();
  
  // Handle explicit true values
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  
  // Handle explicit false values
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  
  // For unrecognized values, return the default
  return defaultValue;
}

/**
 * Get AI Configuration dynamically
 * This ensures environment variable changes are reflected immediately
 */
export function getAIConfig() {
  return {
    // OpenAI Configuration
    openai: {
      apiKey: process.env.OPENAI_API_KEY?.trim(),
      organization: process.env.OPENAI_ORGANIZATION?.trim(),
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      defaultMaxTokens: parseIntWithDefault(process.env.OPENAI_MAX_TOKENS, 500),
      defaultTemperature: parseFloatWithDefault(process.env.OPENAI_TEMPERATURE, 0.7),
      timeout: parseIntWithDefault(process.env.OPENAI_TIMEOUT, 30000),
    },

    // AI Feature Flags - Support both old and new environment variable names
    features: {
      ai: parseBooleanFeature(process.env.AI_ENABLED),
      storyGeneration: parseBooleanFeature(process.env.STORY_GENERATION_ENABLED || process.env.ENABLE_AI_STORY_GENERATION),
      matchAnalysis: parseBooleanFeature(process.env.MATCH_ANALYSIS_ENABLED || process.env.ENABLE_AI_MATCH_ANALYSIS),
      userAnalysis: parseBooleanFeature(process.env.USER_ANALYSIS_ENABLED || process.env.ENABLE_AI_USER_ANALYSIS),
      reminderInsights: parseBooleanFeature(process.env.ENABLE_AI_REMINDER_INSIGHTS),
    },

    // Content Generation Settings
    content: {
      maxStoryLength: parseIntWithDefault(process.env.AI_MAX_STORY_LENGTH, 200),
      maxInsightLength: parseIntWithDefault(process.env.AI_MAX_INSIGHT_LENGTH, 100),
      maxAnalysisLength: parseIntWithDefault(process.env.AI_MAX_ANALYSIS_LENGTH, 150),
      fallbackTimeout: parseIntWithDefault(process.env.AI_FALLBACK_TIMEOUT, 5000),
    },

    // Rate Limiting
    rateLimits: {
      requestsPerMinute: parseIntWithDefault(process.env.AI_REQUESTS_PER_MINUTE, 60),
      requestsPerHour: parseIntWithDefault(process.env.AI_REQUESTS_PER_HOUR, 1000),
    }
  } as const;
}

/**
 * Static config for backwards compatibility
 */
export const aiConfig = getAIConfig();

/**
 * Check if AI services are properly configured
 */
export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!(config.openai.apiKey && config.openai.apiKey.length > 0);
}

/**
 * Get environment-specific AI settings
 */
export function getAIEnvironment(): 'development' | 'production' | 'test' {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'test') return 'test';
  return 'development';
}

/**
 * Check if a specific AI feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  // If AI is not configured, no features should be enabled
  if (!isAIConfigured()) {
    return false;
  }
  
  const config = getAIConfig();
  
  // Return the feature flag value
  if (!(feature in config.features)) return true; // Default to true for unknown features
  
  return config.features[feature as keyof typeof config.features] === true;
}

/**
 * Get the AI provider name
 */
export function getAIProvider(): string {
  if (!isAIConfigured()) {
    return process.env.AI_PROVIDER || 'openai'; // Return expected provider even if not configured
  }
  
  // Return the configured provider or default
  return process.env.AI_PROVIDER || 'openai';
} 