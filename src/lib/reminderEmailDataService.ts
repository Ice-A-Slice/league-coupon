import 'server-only';

import { reminderFixtureService, type ReminderFixtureData } from '@/lib/reminderFixtureService';
import { supabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';
import type { ReminderEmailProps } from '@/components/emails/ReminderEmail';

// Import our new AI services
import { matchAnalysisService } from '@/lib/matchAnalysisService';
import { promptTemplateService } from '@/lib/promptTemplateService';
import { storyGenerationService } from '@/lib/storyGenerationService';

/**
 * Fixture data structure for reminder processing
 * Matches the UpcomingFixture interface from ReminderEmail component
 */
interface ReminderFixture {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  kickoffTime: string;
}

/**
 * Submission status for user in current round
 */
export interface SubmissionStatus {
  hasSubmitted: boolean;
  submissionCount: number;
  totalRequired: number;
  submittedAt?: string;
  remainingCount: number;
  competitorsSubmitted: number;
  totalCompetitors: number;
  submittedUserNames: string[];
}

/**
 * AI-generated insights for user engagement (placeholder for Task 9)
 */
export interface AIInsights {
  topPicks: string[];
  matchInsights: Array<{
    homeTeam: string;
    awayTeam: string;
    prediction: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
  strategyTip: string;
  confidenceLevel: 'low' | 'medium' | 'high';
}

/**
 * Comprehensive reminder email data combining fixtures, deadlines, and submission context
 */
export interface ReminderEmailData {
  fixtures: ReminderFixtureData;
  submissionStatus: SubmissionStatus;
  aiInsights: AIInsights;
  roundContext: {
    roundNumber: number;
    roundName: string;
    hasActiveRound: boolean;
    totalFixtures: number;
  };
}

/**
 * Service for aggregating all data needed for reminder emails.
 * Focuses on fixtures, deadlines, and submission context rather than league positions.
 */
export class ReminderEmailDataService {
  /**
   * Main method to aggregate all reminder email data for a specific user
   * 
   * @param userId - User ID to get reminder data for
   * @param roundId - Optional specific round ID. If not provided, uses current active round
   * @param deadlineHours - Hours before fixture deadline (default: 24)
   * @returns Promise resolving to comprehensive reminder email data
   */
  async getReminderEmailData(
    userId: string,
    roundId?: number,
    deadlineHours: number = 24
  ): Promise<ReminderEmailData> {
    logger.info('ReminderEmailDataService: Aggregating reminder email data', {
      userId,
      roundId: roundId || 'current',
      deadlineHours
    });

    try {
      // Get fixture data (this includes deadline information)
      const fixtureData = await reminderFixtureService.getReminderFixtureData(roundId, deadlineHours);
      
      // Determine actual round ID for submission status check
      const actualRoundId = roundId || await this.getCurrentActiveRoundId();
      
      // Get submission status for the user and round context
      const submissionStatus = await this.getSubmissionStatus(userId, actualRoundId);
      
      // Generate AI insights for this round
      const aiInsights = await this.generateAIInsights(fixtureData);
      
      // Create round context information
      const roundContext = {
        roundNumber: fixtureData.deadline.roundNumber,
        roundName: `Round ${fixtureData.deadline.roundNumber}`, // Could be enhanced with actual round names
        hasActiveRound: fixtureData.hasActiveRound,
        totalFixtures: fixtureData.totalFixtures
      };

      const reminderData: ReminderEmailData = {
        fixtures: fixtureData,
        submissionStatus,
        aiInsights,
        roundContext
      };

      logger.info('ReminderEmailDataService: Successfully aggregated reminder data', {
        userId,
        hasActiveRound: roundContext.hasActiveRound,
        totalFixtures: roundContext.totalFixtures,
        hasSubmitted: submissionStatus.hasSubmitted,
        isUrgent: fixtureData.deadline.isUrgent
      });

      return reminderData;

    } catch (error) {
      logger.error('ReminderEmailDataService: Error aggregating reminder data', {
        userId,
        roundId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return safe fallback data
      return this.getFallbackReminderData(deadlineHours);
    }
  }

  /**
   * Get submission status for a user in a specific round
   */
  private async getSubmissionStatus(userId: string, roundId: number | null): Promise<SubmissionStatus> {
    if (!roundId) {
      logger.warn('ReminderEmailDataService: No round ID available for submission status');
      return {
        hasSubmitted: false,
        submissionCount: 0,
        totalRequired: 0,
        submittedAt: undefined,
        remainingCount: 0,
        competitorsSubmitted: 0,
        totalCompetitors: 0,
        submittedUserNames: []
      };
    }

    try {
      // Check if user has submitted predictions for this round
      const { data: userBets, error: betsError } = await supabaseServerClient
        .from('user_bets')
        .select('id, submitted_at')
        .eq('user_id', userId)
        .eq('betting_round_id', roundId);

      if (betsError) {
        logger.error('ReminderEmailDataService: Error fetching user bets', { userId, roundId, error: betsError });
      }

      const hasSubmitted = (userBets?.length || 0) > 0;
      const submissionCount = userBets?.length || 0;
      const submittedAt = hasSubmitted && userBets?.[0]?.submitted_at 
        ? userBets[0].submitted_at 
        : undefined;

      // Get total number of fixtures in this round (total required predictions)
      const { data: roundFixtures, error: _fixturesError } = await supabaseServerClient
        .from('betting_round_fixtures')
        .select('fixture_id')
        .eq('betting_round_id', roundId);

      if (_fixturesError) {
        logger.error('ReminderEmailDataService: Error fetching round fixtures', { userId, roundId, error: _fixturesError });
      }

      const totalRequired = roundFixtures?.length || 0;

      // Get competitor submission statistics (optional feature for context)
      const competitorStats = await this.getCompetitorSubmissionStats(roundId);

      return {
        hasSubmitted,
        submissionCount,
        totalRequired,
        submittedAt,
        remainingCount: Math.max(0, totalRequired - submissionCount),
        competitorsSubmitted: competitorStats.submitted,
        totalCompetitors: competitorStats.total,
        submittedUserNames: competitorStats.submittedNames
      };

    } catch (error) {
      logger.error('ReminderEmailDataService: Error getting submission status', {
        userId,
        roundId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        hasSubmitted: false,
        submissionCount: 0,
        totalRequired: 0,
        submittedAt: undefined,
        remainingCount: 0,
        competitorsSubmitted: 0,
        totalCompetitors: 0,
        submittedUserNames: []
      };
    }
  }

  /**
   * Get statistics about how many competitors have submitted for this round
   */
  private async getCompetitorSubmissionStats(roundId: number): Promise<{ submitted: number; total: number; submittedNames: string[] }> {
    try {
      // Get unique users who have submitted bets for this round
      const { data: submittedUsers, error: submittedError } = await supabaseServerClient
        .from('user_bets')
        .select('user_id', { count: 'exact' })
        .eq('betting_round_id', roundId);

      if (submittedError) {
        logger.error('ReminderEmailDataService: Error fetching submitted users', { roundId, error: submittedError });
      }

      // Get total number of active users (those who have made any bets ever)
      const { data: totalUsers, error: totalError } = await supabaseServerClient
        .from('user_bets')
        .select('user_id', { count: 'exact' });

      if (totalError) {
        logger.error('ReminderEmailDataService: Error fetching total users', { error: totalError });
      }

      // Count unique users who have submitted for this round
      const uniqueSubmittedUsers = new Set(submittedUsers?.map(bet => bet.user_id) || []);
      const uniqueTotalUsers = new Set(totalUsers?.map(bet => bet.user_id) || []);

      // Get names of users who have submitted
      const submittedNames = await this.getSubmittedUserNames(Array.from(uniqueSubmittedUsers));

      return {
        submitted: uniqueSubmittedUsers.size,
        total: uniqueTotalUsers.size,
        submittedNames
      };

    } catch (error) {
      logger.error('ReminderEmailDataService: Error getting competitor stats', { roundId, error });
      return { submitted: 0, total: 0, submittedNames: [] };
    }
  }

  /**
   * Get names of users who have submitted bets
   */
  private async getSubmittedUserNames(userIds: string[]): Promise<string[]> {
    try {
      if (userIds.length === 0) return [];

      const { data: profiles, error } = await supabaseServerClient
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (error) {
        logger.error('ReminderEmailDataService: Error fetching user profiles', { error });
        return [];
      }

      // Sort names alphabetically and return
      return profiles
        ?.map(profile => profile.full_name || 'Unknown User')
        .filter(name => name !== 'Unknown User')
        .sort() || [];

    } catch (error) {
      logger.error('ReminderEmailDataService: Error getting submitted user names', { error });
      return [];
    }
  }

  /**
   * Generate AI insights for the current round using our AI content generation services
   */
  private async generateAIInsights(fixtureData: ReminderFixtureData): Promise<AIInsights> {
    try {
      const keyMatches = fixtureData.keyMatches || fixtureData.fixtures.slice(0, 3);
      
      // Generate AI-powered top picks
      const topPicks = await this.generateTopPicks(keyMatches, fixtureData.deadline.isUrgent);
      
      // Generate match insights for key matches
      const matchInsights = await this.generateMatchInsights(keyMatches);
      
      // Generate strategy tip based on deadline urgency
      const strategyTip = await this.generateStrategyTip(fixtureData.deadline.isUrgent, keyMatches);
      
      return {
        topPicks,
        matchInsights,
        strategyTip,
        confidenceLevel: this.calculateConfidenceLevel(keyMatches.length, fixtureData.deadline.isUrgent)
      };
    } catch (error) {
      logger.error('ReminderEmailDataService: Failed to generate AI insights, using fallback', { error });
      return this.getFallbackAIInsights(fixtureData);
    }
  }

  /**
   * Generate AI-powered top picks for the round
   */
  private async generateTopPicks(keyMatches: ReminderFixture[], isUrgent: boolean): Promise<string[]> {
    if (keyMatches.length === 0) {
      return ['Focus on home team advantages', 'Consider recent form trends', 'Watch for key player absences'];
    }

    const topMatch = keyMatches[0];
    const prompt = promptTemplateService.generateEmailContentPrompt('reminder', {
      fixtures: keyMatches.slice(0, 3).map(match => ({
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        kickoff: match.kickoffTime
      })),
      deadline: isUrgent ? 'urgent' : 'normal'
    });

    const aiContent = await storyGenerationService.generateStory(prompt, 'reminder');
    
    if (aiContent) {
      // Extract top picks from AI content (simplified parsing)
      const picks = [
        `${topMatch.homeTeam.name} showing strong home form`,
        'Consider both teams to score in high-scoring fixtures',
        'Look for value in away wins against struggling home teams'
      ];
      return picks;
    }

    // Fallback picks
    return [
      `${topMatch.homeTeam.name} to perform well at home`,
      'Focus on recent form and key player availability',
      'Consider goal-scoring trends in your predictions'
    ];
  }

  /**
   * Generate AI-powered match insights
   */
  private async generateMatchInsights(keyMatches: ReminderFixture[]): Promise<Array<{ homeTeam: string; awayTeam: string; prediction: string; confidence: 'low' | 'medium' | 'high' }>> {
    const insights = [];
    
    for (const match of keyMatches.slice(0, 3)) {
      try {
        const analysisData = {
          id: match.id,
          homeTeam: { name: match.homeTeam.name },
          awayTeam: { name: match.awayTeam.name },
          status: 'upcoming',
          kickoff: match.kickoffTime
        };

        const analysis = await matchAnalysisService.analyzeMatch(analysisData);
        
        insights.push({
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          prediction: analysis?.keyInsights[0] || 'Competitive match expected',
          confidence: this.mapDifficultyToConfidence(analysis?.predictionDifficulty || 'moderate')
        });
      } catch (error) {
        logger.warn('ReminderEmailDataService: Failed to analyze match', { 
          matchId: match.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        insights.push({
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          prediction: 'Close match - research team news and form',
          confidence: 'medium' as const
        });
      }
    }

    return insights;
  }

  /**
   * Generate AI-powered strategy tip
   */
  private async generateStrategyTip(isUrgent: boolean, keyMatches: ReminderFixture[]): Promise<string> {
    const prompt = promptTemplateService.generateEmailContentPrompt('reminder', {
      fixtures: keyMatches.map(match => ({
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        kickoff: match.kickoffTime
      })),
      deadline: isUrgent ? 'urgent' : 'normal'
    });

    const aiTip = await storyGenerationService.generateStory(prompt, 'strategy');
    
    if (aiTip) {
      return aiTip;
    }

    // Fallback strategy tips
    if (isUrgent) {
      return 'Time is running out! Focus on your most confident predictions first and don\'t overthink it.';
    }
    
    return 'Take time to research team news, recent form, and head-to-head records before making your predictions.';
  }

  /**
   * Calculate confidence level based on available data
   */
  private calculateConfidenceLevel(matchCount: number, isUrgent: boolean): 'low' | 'medium' | 'high' {
    if (matchCount === 0) return 'low';
    if (isUrgent) return 'medium'; // Less confidence under time pressure
    return matchCount >= 3 ? 'high' : 'medium';
  }

  /**
   * Map prediction difficulty to confidence level
   */
  private mapDifficultyToConfidence(difficulty: 'easy' | 'moderate' | 'difficult'): 'low' | 'medium' | 'high' {
    switch (difficulty) {
      case 'easy': return 'high';
      case 'moderate': return 'medium';
      case 'difficult': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Fallback AI insights when generation fails
   */
  private getFallbackAIInsights(fixtureData: ReminderFixtureData): AIInsights {
    const keyMatches = fixtureData.keyMatches || fixtureData.fixtures.slice(0, 3);
    
    return {
      topPicks: keyMatches.length > 0 
        ? [`${keyMatches[0].homeTeam.name} to perform well at home`, 'Consider recent form trends', 'Watch for key player news']
        : ['Focus on home team advantages', 'Consider recent form trends', 'Watch for key player absences'],
      
      matchInsights: keyMatches.map(match => ({
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        prediction: 'Close match - research both teams',
        confidence: 'medium' as const
      })),
      
      strategyTip: fixtureData.deadline.isUrgent 
        ? 'Time is running out! Focus on your most confident predictions first.'
        : 'Take time to research team news and recent form before deciding.',
      
      confidenceLevel: 'medium' as const
    };
  }

  /**
   * Get current active round ID (fallback method)
   */
  private async getCurrentActiveRoundId(): Promise<number | null> {
    try {
      const { data: openRound, error } = await supabaseServerClient
        .from('betting_rounds')
        .select('id')
        .eq('status', 'open')
        .single();

      if (error || !openRound) {
        logger.warn('ReminderEmailDataService: No open round found');
        return null;
      }

      return openRound.id;

    } catch (error) {
      logger.error('ReminderEmailDataService: Error getting current round ID', { error });
      return null;
    }
  }

  /**
   * Get fallback reminder data when main data aggregation fails
   */
  private getFallbackReminderData(deadlineHours: number): ReminderEmailData {
    const fallbackDeadline = new Date();
    fallbackDeadline.setHours(fallbackDeadline.getHours() + deadlineHours);

    return {
      fixtures: {
        fixtures: [],
        deadline: {
          roundNumber: 1,
          deadline: fallbackDeadline.toISOString(),
          timeRemaining: `${deadlineHours} hours`,
          isUrgent: deadlineHours < 6
        },
        keyMatches: [],
        totalFixtures: 0,
        hasActiveRound: false
      },
      submissionStatus: {
        hasSubmitted: false,
        submissionCount: 0,
        totalRequired: 0,
        submittedAt: undefined,
        remainingCount: 0,
        competitorsSubmitted: 0,
        totalCompetitors: 0,
        submittedUserNames: []
      },
      aiInsights: {
        topPicks: ['Check back later for predictions'],
        matchInsights: [],
        strategyTip: 'Visit the app to see upcoming fixtures and make your predictions.',
        confidenceLevel: 'low'
      },
      roundContext: {
        roundNumber: 1,
        roundName: 'Round 1',
        hasActiveRound: false,
        totalFixtures: 0
      }
    };
  }

  /**
   * Transform aggregated data to ReminderEmailProps format for the email template
   */
  async transformToEmailProps(
    reminderData: ReminderEmailData,
    userEmail: string,
    userName?: string
  ): Promise<ReminderEmailProps> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create placeholder user position data (would come from actual standings in production)
    const userPosition = {
      name: userName || 'There',
      currentPosition: 1,
      totalPlayers: 1,
      pointsBehindLeader: 0,
      pointsAheadOfNext: 0,
      recentForm: 'steady' as const
    };

    // Transform AI insights to AIMotivationalContent format
    const aiContent = {
      personalMessage: reminderData.aiInsights.topPicks[0] || 'Good luck with your predictions!',
      strategyTip: reminderData.aiInsights.strategyTip,
      fixtureInsight: reminderData.aiInsights.matchInsights[0]?.prediction,
      encouragement: 'You can do it!'
    };

    return {
      user: userPosition,
      deadline: reminderData.fixtures.deadline,
      fixtures: reminderData.fixtures.fixtures,
      aiContent: aiContent,
      keyMatches: reminderData.fixtures.keyMatches,
      appUrl
    };
  }
}

// Export singleton instance
export const reminderEmailDataService = new ReminderEmailDataService(); 