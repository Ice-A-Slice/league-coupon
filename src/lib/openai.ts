// Only import server-only in production/non-test environments
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('server-only');
}

import OpenAI from 'openai';
import { aiConfig, isAIConfigured } from '@/lib/config/ai';
import { logger } from '@/utils/logger';

/**
 * Configuration interface for AI content generation
 */
export interface AIGenerationConfig {
  maxTokens?: number;
  temperature?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

/**
 * Default configuration for content generation
 */
const DEFAULT_CONFIG: Required<AIGenerationConfig> = {
  maxTokens: aiConfig.openai.defaultMaxTokens,
  temperature: aiConfig.openai.defaultTemperature,
  presencePenalty: 0.1,
  frequencyPenalty: 0.1,
};

/**
 * OpenAI Service for content generation
 * Handles all interactions with OpenAI's API including error handling and retries
 */
export class OpenAIService {
  private client: OpenAI | null = null;
  private available: boolean = false;

  constructor() {
    if (isAIConfigured()) {
      try {
        this.client = new OpenAI({
          apiKey: aiConfig.openai.apiKey,
          organization: aiConfig.openai.organization,
          timeout: aiConfig.openai.timeout,
        });
        this.available = true;
      } catch (error) {
        logger.error('Failed to initialize OpenAI client', { error });
        this.available = false;
      }
    } else {
      this.available = false;
    }
  }

  /**
   * Check if the OpenAI service is available and ready to use
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Generate content using OpenAI's API
   * Returns null if generation fails or service is unavailable
   */
  async generateContent(prompt: string, config?: AIGenerationConfig): Promise<string | null> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OpenAI service is not available, returning null');
      return null;
    }

    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      logger.info('Generating AI content', { 
        promptLength: prompt.length,
        config: finalConfig 
      });

      const completion = await this.client.chat.completions.create({
        model: aiConfig.openai.defaultModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: finalConfig.maxTokens,
        temperature: finalConfig.temperature,
        presence_penalty: finalConfig.presencePenalty,
        frequency_penalty: finalConfig.frequencyPenalty,
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        logger.warn('OpenAI returned empty content');
        return null;
      }

      logger.info('AI content generated successfully', { 
        outputLength: content.length 
      });

      return content.trim();
    } catch (error: unknown) {
      logger.error('OpenAI content generation failed:', error);
      
      // Handle specific error types
      const errorWithStatus = error as { status?: number };
      if (errorWithStatus?.status === 429) {
        logger.warn('OpenAI rate limit hit, falling back to null');
      } else if (errorWithStatus?.status === 401) {
        logger.error('OpenAI authentication failed - check API key');
      }
      
      return null;
    }
  }

  /**
   * Get the provider name for logging and monitoring
   */
  getProviderName(): string {
    if (!this.available) {
      return 'AI Service (Unavailable)';
    }
    return `OpenAI ${aiConfig.openai.defaultModel.includes('gpt-4') ? 'GPT-4' : 'GPT-3.5'}`;
  }

  /**
   * Get service statistics for monitoring
   */
  getStats(): { available: boolean; provider: string; model: string } {
    return {
      available: this.isAvailable(),
      provider: 'OpenAI',
      model: aiConfig.openai.defaultModel,
    };
  }
}

let aiServiceInstance: OpenAIService | null = null;

/**
 * Get the singleton instance of the OpenAIService
 */
function getAIService(): OpenAIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new OpenAIService();
  }
  return aiServiceInstance;
}

/**
 * FOR TESTING PURPOSES ONLY
 * Resets the singleton instance of the AI service.
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}

/**
 * Generate AI-powered content using the configured service
 */
export async function generateAIContent(
  prompt: string,
  config?: AIGenerationConfig
): Promise<string | null> {
  const service = getAIService();
  if (!service.isAvailable()) {
    return null;
  }
  return service.generateContent(prompt, config);
}

/**
 * Check if AI services are available and ready
 */
export function isAIAvailable(): boolean {
  return getAIService().isAvailable();
}

/**
 * Get the AI provider name for display and logging
 */
export function getAIProviderName(): string {
  return getAIService().getProviderName();
} 