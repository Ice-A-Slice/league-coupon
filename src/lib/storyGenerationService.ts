import 'server-only';

import { generateAIContent, isAIAvailable } from '@/lib/openai';
import { logger } from '@/utils/logger';

// Types for story generation
export interface MatchStory {
  headline: string;
  content: string;
  category: 'upset' | 'drama' | 'performance' | 'milestone' | 'form' | 'title_race';
  importance: 'high' | 'medium' | 'low';
  teams: string[];
  keyPlayers: string[];
}

export interface LeagueStories {
  roundSummary: string;
  topStories: MatchStory[];
  weekHighlights: {
    goalOfTheWeek?: string;
    performanceOfTheWeek?: string;
    upsetOfTheWeek?: string;
  };
}

/**
 * Match data structure for story generation
 */
export interface MatchData {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore?: number;
  awayScore?: number;
  status: string;
  kickoff: string;
  venue?: string;
  events?: Array<{
    type: 'goal' | 'red_card' | 'yellow_card' | 'substitution';
    minute: number;
    player?: string;
    team: 'home' | 'away';
  }>;
}

/**
 * Standings data for title race stories
 */
export interface StandingsData {
  userId: string;
  username: string;
  position: number;
  points: number;
  previousPosition?: number;
  pointsChange?: number;
}

/**
 * User performance data for personal stories
 */
export interface UserPerformanceData {
  userId: string;
  username: string;
  correctPredictions: number;
  totalPredictions: number;
  pointsEarned: number;
  bestPrediction?: {
    homeTeam: string;
    awayTeam: string;
    prediction: string;
    points: number;
  };
}

/**
 * Context data for story generation
 */
export interface StoryGenerationContext {
  roundNumber: number;
  matches: MatchData[];
  standings: StandingsData[];
  userPerformance?: UserPerformanceData;
  previousRoundStandings?: StandingsData[];
}

/**
 * Basic AI Story Generation Service
 * Creates engaging narratives for Premier League results and league standings
 */
export class StoryGenerationService {
  /**
   * Generate AI story content
   */
  async generateStory(prompt: string, type: string): Promise<string | null> {
    if (!isAIAvailable()) {
      logger.warn('StoryGenerationService: AI not available, using fallback');
      return this.getFallbackStory(type);
    }

    try {
      const content = await generateAIContent(prompt, {
        maxTokens: 200,
        temperature: 0.8
      });

      if (!content) {
        logger.error('StoryGenerationService: Failed to generate story', { error: content, type });
        return this.getFallbackStory(type);
      }

      return content;
    } catch (error) {
      logger.error('StoryGenerationService: Failed to generate story', { error, type });
      return this.getFallbackStory(type);
    }
  }

  private getFallbackStory(type: string): string {
    switch (type) {
      case 'title_race':
        return 'The title race continues to heat up with exciting developments this round.';
      case 'match_drama': 
        return 'This round delivered plenty of drama and excitement across all fixtures.';
      case 'performance':
        return 'Your prediction performance this round shows great insight and strategy.';
      default:
        return 'Another thrilling round of Premier League action has concluded.';
    }
  }
}

export const storyGenerationService = new StoryGenerationService(); 