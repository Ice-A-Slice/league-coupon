import 'server-only';

import { reminderFixtureService, type ReminderFixtureData } from '@/lib/reminderFixtureService';
import { supabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';
import type { ReminderEmailProps } from '@/components/emails/ReminderEmail';

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
        totalCompetitors: 0
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
        totalCompetitors: competitorStats.total
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
        totalCompetitors: 0
      };
    }
  }

  /**
   * Get statistics about how many competitors have submitted for this round
   */
  private async getCompetitorSubmissionStats(roundId: number): Promise<{ submitted: number; total: number }> {
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

      return {
        submitted: uniqueSubmittedUsers.size,
        total: uniqueTotalUsers.size
      };

    } catch (error) {
      logger.error('ReminderEmailDataService: Error getting competitor stats', { roundId, error });
      return { submitted: 0, total: 0 };
    }
  }

  /**
   * Generate AI insights for the current round (placeholder implementation)
   */
  private async generateAIInsights(fixtureData: ReminderFixtureData): Promise<AIInsights> {
    // This is a placeholder implementation
    // In the future, this could integrate with actual AI services for:
    // - Match predictions and analysis
    // - Team form analysis
    // - Historical matchup insights
    // - Betting tips and strategies

    const keyMatches = fixtureData.keyMatches || fixtureData.fixtures.slice(0, 3);
    
    return {
      topPicks: keyMatches.length > 0 
        ? [`${keyMatches[0].homeTeam.name} to win at home`, 'Consider the over 2.5 goals markets', 'Look for value in the draw markets']
        : ['Focus on home team advantages', 'Consider recent form trends', 'Watch for key player absences'],
      
      matchInsights: keyMatches.map(match => ({
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        prediction: 'Close match - consider both teams to score',
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
        totalCompetitors: 0
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