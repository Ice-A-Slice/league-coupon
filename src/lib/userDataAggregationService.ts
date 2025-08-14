import { type SupabaseClient } from '@supabase/supabase-js';
import { calculateStandings } from '@/services/standingsService';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import type { Database } from '@/types/supabase';

// ===== TYPE DEFINITIONS =====

/**
 * Comprehensive user performance data for email templates
 */
export type UserPerformanceData = {
  userId: string;
  userEmail: string;
  userName: string | null;
  currentPosition: number;
  positionChange: number; // Positive = moved up, negative = moved down, 0 = no change
  totalPoints: number;
  gamePoints: number;
  dynamicPoints: number;
  correctPredictionsInLastRound: number;
  totalPredictionsInLastRound: number;
  accuracyPercentageLastRound: number;
  bestStreak: number;
  currentStreak: number;
  totalCorrectPredictions: number;
  totalPredictions: number;
  overallAccuracyPercentage: number;
  roundsParticipated: number;
  averagePointsPerRound: number;
  bestRoundPerformance: number;
  recentFormTrend: 'improving' | 'declining' | 'stable'; // Based on last 3 rounds
};

/**
 * Position history for tracking changes
 */
export interface UserPositionHistory {
  userId: string;
  roundId: number;
  position: number;
  totalPoints: number;
  pointsEarned: number;
  timestamp: string;
}

/**
 * User streak information
 */
export interface UserStreakData {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  streakType: 'correct' | 'incorrect' | 'none';
}

/**
 * Round performance data
 */
export interface RoundPerformanceData {
  userId: string;
  roundId: number;
  correctPredictions: number;
  totalPredictions: number;
  pointsEarned: number;
  accuracy: number;
}

/**
 * Type for RPC function response from get_user_points_up_to_round
 */
interface UserPointsUpToRound {
  user_id: string;
  total_points: number;
}

/**
 * User prediction data for transparency email
 */
export interface UserPredictionData {
  userId: string;
  userName: string | null;
  predictions: GamePrediction[];
}

/**
 * Individual game prediction for transparency display
 */
export interface GamePrediction {
  homeTeam: string;
  awayTeam: string;
  prediction: 'home' | 'draw' | 'away' | null; // Converted from 1/X/2
}

/**
 * Transparency email data containing all users' predictions for a round
 */
export interface TransparencyEmailData {
  roundId: number;
  roundName: string;
  users: UserPredictionData[];
  games: {
    homeTeam: string;
    awayTeam: string;
  }[];
}

// ===== CORE AGGREGATION SERVICE =====

export class UserDataAggregationService {
  private client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || createSupabaseServiceRoleClient();
  }

  /**
   * Get comprehensive user performance data for a specific user
   */
  async getUserPerformanceData(userId: string): Promise<UserPerformanceData | null> {
    logger.info({ userId }, 'Aggregating user performance data');

    try {
      // Get current standings to determine position
      const currentStandings = await calculateStandings();
      if (!currentStandings) {
        logger.error({ userId }, 'Failed to get current standings');
        return null;
      }

      const userStanding = currentStandings.find(s => s.user_id === userId);
      if (!userStanding) {
        logger.warn({ userId }, 'User not found in current standings');
        return null;
      }

      // Get user profile information
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        logger.error({ userId }, 'Failed to get user profile');
        return null;
      }

      // Get position change
      const positionChange = await this.calculatePositionChange(userId, userStanding.rank);

      // Get streak data
      const streakData = await this.getUserStreakData(userId);

      // Get round performance data
      const lastRoundPerformance = await this.getLastRoundPerformance(userId);
      const overallPerformance = await this.getOverallPerformance(userId);
      const recentFormTrend = await this.getRecentFormTrend(userId);

      const performanceData: UserPerformanceData = {
        userId,
        userEmail: userProfile.email,
        userName: userProfile.full_name,
        currentPosition: userStanding.rank,
        positionChange,
        totalPoints: userStanding.combined_total_score,
        gamePoints: userStanding.game_points,
        dynamicPoints: userStanding.dynamic_points,
        correctPredictionsInLastRound: lastRoundPerformance.correctPredictions,
        totalPredictionsInLastRound: lastRoundPerformance.totalPredictions,
        accuracyPercentageLastRound: lastRoundPerformance.accuracy,
        bestStreak: streakData.bestStreak,
        currentStreak: streakData.currentStreak,
        totalCorrectPredictions: overallPerformance.totalCorrect,
        totalPredictions: overallPerformance.totalPredictions,
        overallAccuracyPercentage: overallPerformance.accuracy,
        roundsParticipated: overallPerformance.roundsParticipated,
        averagePointsPerRound: overallPerformance.averagePointsPerRound,
        bestRoundPerformance: overallPerformance.bestRoundPerformance,
        recentFormTrend
      };

      logger.info({ userId, performance: performanceData }, 'Successfully aggregated user performance data');
      return performanceData;

    } catch (error) {
      logger.error({ userId, error }, 'Error aggregating user performance data');
      return null;
    }
  }

  /**
   * Get performance data for all users (for bulk email operations)
   */
  async getAllUsersPerformanceData(): Promise<UserPerformanceData[]> {
    logger.info('Aggregating performance data for all users');

    try {
      // Get all user IDs from current standings
      const currentStandings = await calculateStandings();
      if (!currentStandings) {
        logger.error('Failed to get current standings for all users');
        return [];
      }

      const performanceDataPromises = currentStandings.map(standing => 
        this.getUserPerformanceData(standing.user_id)
      );

      const results = await Promise.allSettled(performanceDataPromises);
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<UserPerformanceData> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      logger.info({ count: successfulResults.length }, 'Successfully aggregated performance data for all users');
      return successfulResults;

    } catch (error) {
      logger.error({ error }, 'Error aggregating performance data for all users');
      return [];
    }
  }

  /**
   * Get all users' predictions for a specific round - used for transparency emails
   * This shows everyone's locked-in predictions when the first game kicks off
   */
  async getAllUsersPredictionsForRound(roundId: number): Promise<TransparencyEmailData | null> {
    logger.info({ roundId }, 'Fetching all users predictions for transparency email');

    try {
      // Get round information
      const { data: roundData, error: roundError } = await this.client
        .from('betting_rounds')
        .select('*')
        .eq('id', roundId)
        .single();

      if (roundError || !roundData) {
        logger.error({ roundId, error: roundError }, 'Failed to get round data');
        return null;
      }

      // Get all fixtures for this round with team information
      const { data: fixtures, error: fixturesError } = await this.client
        .from('betting_round_fixtures')
        .select(`
          fixture_id,
          fixtures!inner(
            id,
            kickoff,
            home_team_id,
            away_team_id,
            home_teams:teams!fixtures_home_team_id_fkey(name),
            away_teams:teams!fixtures_away_team_id_fkey(name)
          )
        `)
        .eq('betting_round_id', roundId)
        .order('fixtures(kickoff)', { ascending: true });

      if (fixturesError || !fixtures) {
        logger.error({ roundId, error: fixturesError }, 'Failed to get fixtures for round');
        return null;
      }

      // Get all predictions for this round
      const { data: predictions, error: predictionsError } = await this.client
        .from('user_bets')
        .select('user_id, fixture_id, prediction, submitted_at')
        .eq('betting_round_id', roundId);

      if (predictionsError) {
        logger.error({ roundId, error: predictionsError }, 'Failed to get predictions for round');
        return null;
      }

      // Get user data (emails and names) for all users who have predictions
      const userIds = [...new Set(predictions?.map(p => p.user_id) || [])];
      const userDataPromises = userIds.map(async (userId) => {
        return await this.getUserProfile(userId);
      });

      const userDataResults = await Promise.allSettled(userDataPromises);
      const userData = userDataResults
        .filter((result): result is PromiseFulfilledResult<{ email: string; full_name: string | null } | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map((result, index) => ({ userId: userIds[index], ...result.value }))
        .filter((value): value is { userId: string; email: string; full_name: string | null } => value !== null);

      // Transform fixtures data
      const fixturesData = fixtures.map(f => ({
        id: f.fixtures.id,
        homeTeam: f.fixtures.home_teams?.name || 'Unknown',
        awayTeam: f.fixtures.away_teams?.name || 'Unknown',
        kickoffTime: f.fixtures.kickoff
      }));

      // Helper function to convert prediction codes to readable format
      const convertPrediction = (prediction: string): 'home' | 'draw' | 'away' => {
        switch (prediction) {
          case '1': return 'home';
          case 'X': return 'draw';
          case '2': return 'away';
          default: return 'home'; // fallback
        }
      };

      // Group predictions by user
      const userPredictions = new Map<string, {
        userName: string | null;
        userEmail: string;
        predictions: Map<number, GamePrediction>;
      }>();

      // Initialize user data
      userIds.forEach(userId => {
        const user = userData.find(u => u.userId === userId);
        
        userPredictions.set(userId, {
          userName: user?.full_name || null,
          userEmail: user?.email || '',
          predictions: new Map()
        });
      });

      // Populate predictions
      predictions?.forEach(prediction => {
        const userData = userPredictions.get(prediction.user_id);
        if (userData) {
          const fixture = fixturesData.find(f => f.id === prediction.fixture_id);
          if (fixture) {
            userData.predictions.set(prediction.fixture_id, {
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              prediction: convertPrediction(prediction.prediction)
            });
          }
        }
      });

      // Convert to final format, ensuring all users have predictions for all fixtures
      const users: UserPredictionData[] = Array.from(userPredictions.entries()).map(([userId, userData]) => {
        const userGamePredictions: GamePrediction[] = fixturesData.map(fixture => {
          const existingPrediction = userData.predictions.get(fixture.id);
          return existingPrediction || {
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            prediction: null // No prediction submitted
          };
        });

        return {
          userId,
          userName: userData.userName,
          predictions: userGamePredictions
        };
      });

      // Sort users by name for consistent display
      users.sort((a, b) => {
        const nameA = a.userName || `Player ${a.userId}`;
        const nameB = b.userName || `Player ${b.userId}`;
        return nameA.localeCompare(nameB);
      });

      const transparencyData: TransparencyEmailData = {
        roundId,
        roundName: roundData.name,
        users,
        games: fixturesData.map(f => ({
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam
        }))
      };

      logger.info({ 
        roundId, 
        userCount: users.length, 
        fixtureCount: fixturesData.length 
      }, 'Successfully fetched transparency email data');

      return transparencyData;

    } catch (error) {
      logger.error({ roundId, error }, 'Error fetching transparency email data');
      return null;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Get user profile information including email
   */
  private async getUserProfile(userId: string): Promise<{ email: string; full_name: string | null } | null> {
    try {
      // Get user email from auth.users
      const { data: authUser, error: authError } = await this.client.auth.admin.getUserById(userId);
      if (authError || !authUser.user) {
        logger.error({ userId, error: authError }, 'Failed to get user from auth');
        return null;
      }

      // Get profile information
      const { data: profile, error: profileError } = await this.client
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (profileError) {
        logger.warn({ userId, error: profileError }, 'Failed to get user profile, will try auth.users fallback');
      }
      
      if (!profile?.full_name) {
        logger.info({ userId, hasProfile: !!profile, profileFullName: profile?.full_name }, 'Profile missing full_name, trying fallback sources');
      }

      // Try multiple sources for the full name
      let fullName = profile?.full_name;
      let nameSource = 'profile';
      
      // Fallback to auth.users user_metadata if profile name is missing
      if (!fullName && authUser.user.user_metadata) {
        fullName = authUser.user.user_metadata.full_name || 
                  authUser.user.user_metadata.name || 
                  authUser.user.user_metadata.display_name;
        if (fullName) {
          nameSource = 'auth_metadata';
        }
      }
      
      // Final fallback: derive name from email
      if (!fullName && authUser.user.email) {
        fullName = authUser.user.email.split('@')[0].replace(/[._-]/g, ' ');
        // Capitalize first letter of each word
        fullName = fullName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        nameSource = 'email_derived';
      }
      
      if (nameSource !== 'profile') {
        logger.info({ userId, fullName, nameSource }, `Using fallback name source: ${nameSource}`);
      }

      return {
        email: authUser.user.email || '',
        full_name: fullName || null
      };

    } catch (error) {
      logger.error({ userId, error }, 'Error getting user profile');
      return null;
    }
  }

  /**
   * Calculate position change between current and previous round
   */
  private async calculatePositionChange(userId: string, currentPosition: number): Promise<number> {
    try {
      // Get the last two scored rounds to compare positions
      const { data: recentRounds, error } = await this.client
        .from('betting_rounds')
        .select('id')
        .eq('status', 'scored')
        .order('scored_at', { ascending: false })
        .limit(2);

      if (error || !recentRounds || recentRounds.length < 2) {
        logger.debug({ userId }, 'Not enough rounds to calculate position change');
        return 0;
      }

      const [_currentRound, previousRound] = recentRounds;

      // Calculate standings for the previous round by excluding current round's points
      const previousPosition = await this.getUserPositionInRound(userId, previousRound.id);
      
      if (previousPosition === null) {
        logger.debug({ userId }, 'No previous position found');
        return 0;
      }

      // Position change: negative means moved down, positive means moved up
      const change = previousPosition - currentPosition;
      logger.debug({ userId, currentPosition, previousPosition, change }, 'Calculated position change');
      
      return change;

    } catch (error) {
      logger.error({ userId, error }, 'Error calculating position change');
      return 0;
    }
  }

  /**
   * Get user's position in a specific round (approximate)
   */
  private async getUserPositionInRound(userId: string, roundId: number): Promise<number | null> {
    try {
      // This is a simplified approach - for a more accurate historical calculation,
      // you might want to store historical standings or recalculate them
      
      // Get total points up to that round for all users
      const { data: userPoints, error } = await this.client
        .rpc('get_user_points_up_to_round', { target_round_id: roundId });

      if (error || !userPoints) {
        logger.error({ userId, roundId, error }, 'Failed to get user points for round');
        return null;
      }

      // Sort by points to determine position
      const sortedUsers = (userPoints as UserPointsUpToRound[]).sort((a, b) => b.total_points - a.total_points);
      const userIndex = sortedUsers.findIndex((user) => user.user_id === userId);
      
      return userIndex === -1 ? null : userIndex + 1;

    } catch (error) {
      logger.error({ userId, roundId, error }, 'Error getting user position in round');
      return null;
    }
  }

  /**
   * Get user streak data (consecutive correct/incorrect predictions)
   */
  private async getUserStreakData(userId: string): Promise<UserStreakData> {
    try {
      const { data: userBets, error } = await this.client
        .from('user_bets')
        .select('prediction, points_awarded, betting_round_id, fixture_id')
        .eq('user_id', userId)
        .not('points_awarded', 'is', null)
        .order('betting_round_id', { ascending: false })
        .order('fixture_id', { ascending: true })
        .limit(100); // Look at last 100 bets for streak calculation

      if (error || !userBets) {
        logger.warn({ userId, error }, 'Failed to get user bets for streak calculation');
        return { userId, currentStreak: 0, bestStreak: 0, streakType: 'none' };
      }

      let currentStreak = 0;
      let bestStreak = 0;
      let currentStreakType: 'correct' | 'incorrect' | 'none' = 'none';
      let tempStreak = 0;
      let tempStreakType: 'correct' | 'incorrect' | 'none' = 'none';

      // Calculate streaks from most recent bets
      for (let i = 0; i < userBets.length; i++) {
        const bet = userBets[i];
        const isCorrect = bet.points_awarded && bet.points_awarded > 0;
        
        if (i === 0) {
          // Start with the most recent bet
          currentStreakType = isCorrect ? 'correct' : 'incorrect';
          currentStreak = 1;
          tempStreakType = currentStreakType;
          tempStreak = 1;
        } else {
          const currentType = isCorrect ? 'correct' : 'incorrect';
          
          if (currentType === tempStreakType) {
            tempStreak++;
            if (i < 10) { // Only count current streak for last 10 bets
              currentStreak = tempStreak;
            }
          } else {
            bestStreak = Math.max(bestStreak, tempStreak);
            tempStreakType = currentType;
            tempStreak = 1;
          }
        }
      }

      bestStreak = Math.max(bestStreak, tempStreak);

      logger.debug({ userId, currentStreak, bestStreak, currentStreakType }, 'Calculated user streak data');
      
      return {
        userId,
        currentStreak,
        bestStreak,
        streakType: currentStreakType
      };

    } catch (error) {
      logger.error({ userId, error }, 'Error calculating user streak data');
      return { userId, currentStreak: 0, bestStreak: 0, streakType: 'none' };
    }
  }

  /**
   * Get performance data for the last completed round
   */
  private async getLastRoundPerformance(userId: string): Promise<RoundPerformanceData> {
    try {
      const { data: lastRound, error: roundError } = await this.client
        .from('betting_rounds')
        .select('id')
        .eq('status', 'scored')
        .order('scored_at', { ascending: false })
        .limit(1)
        .single();

      if (roundError || !lastRound) {
        logger.debug({ userId }, 'No scored rounds found for last round performance');
        return {
          userId,
          roundId: 0,
          correctPredictions: 0,
          totalPredictions: 0,
          pointsEarned: 0,
          accuracy: 0
        };
      }

      const { data: roundBets, error: betsError } = await this.client
        .from('user_bets')
        .select('points_awarded')
        .eq('user_id', userId)
        .eq('betting_round_id', lastRound.id)
        .not('points_awarded', 'is', null);

      if (betsError || !roundBets) {
        logger.warn({ userId, roundId: lastRound.id, error: betsError }, 'Failed to get round bets');
        return {
          userId,
          roundId: lastRound.id,
          correctPredictions: 0,
          totalPredictions: 0,
          pointsEarned: 0,
          accuracy: 0
        };
      }

      const totalPredictions = roundBets.length;
      const correctPredictions = roundBets.filter(bet => bet.points_awarded && bet.points_awarded > 0).length;
      const pointsEarned = roundBets.reduce((sum, bet) => sum + (bet.points_awarded || 0), 0);
      const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

      return {
        userId,
        roundId: lastRound.id,
        correctPredictions,
        totalPredictions,
        pointsEarned,
        accuracy
      };

    } catch (error) {
      logger.error({ userId, error }, 'Error getting last round performance');
      return {
        userId,
        roundId: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        pointsEarned: 0,
        accuracy: 0
      };
    }
  }

  /**
   * Get overall performance statistics
   */
  private async getOverallPerformance(userId: string): Promise<{
    totalCorrect: number;
    totalPredictions: number;
    accuracy: number;
    roundsParticipated: number;
    averagePointsPerRound: number;
    bestRoundPerformance: number;
  }> {
    try {
      const { data: allBets, error } = await this.client
        .from('user_bets')
        .select('points_awarded, betting_round_id')
        .eq('user_id', userId)
        .not('points_awarded', 'is', null);

      if (error || !allBets) {
        logger.warn({ userId, error }, 'Failed to get all user bets for overall performance');
        return {
          totalCorrect: 0,
          totalPredictions: 0,
          accuracy: 0,
          roundsParticipated: 0,
          averagePointsPerRound: 0,
          bestRoundPerformance: 0
        };
      }

      const totalPredictions = allBets.length;
      const totalCorrect = allBets.filter(bet => bet.points_awarded && bet.points_awarded > 0).length;
      const accuracy = totalPredictions > 0 ? (totalCorrect / totalPredictions) * 100 : 0;

      // Group by round to calculate round-based statistics
      const roundStats = new Map<number, { correct: number; total: number; points: number }>();
      
      allBets.forEach(bet => {
        const roundId = bet.betting_round_id;
        if (!roundId) return;
        
        if (!roundStats.has(roundId)) {
          roundStats.set(roundId, { correct: 0, total: 0, points: 0 });
        }
        
        const stats = roundStats.get(roundId)!;
        stats.total++;
        stats.points += bet.points_awarded || 0;
        if (bet.points_awarded && bet.points_awarded > 0) {
          stats.correct++;
        }
      });

      const roundsParticipated = roundStats.size;
      const totalPoints = Array.from(roundStats.values()).reduce((sum, stats) => sum + stats.points, 0);
      const averagePointsPerRound = roundsParticipated > 0 ? totalPoints / roundsParticipated : 0;
      const bestRoundPerformance = Math.max(0, ...Array.from(roundStats.values()).map(stats => stats.points));

      return {
        totalCorrect,
        totalPredictions,
        accuracy,
        roundsParticipated,
        averagePointsPerRound,
        bestRoundPerformance
      };

    } catch (error) {
      logger.error({ userId, error }, 'Error getting overall performance');
      return {
        totalCorrect: 0,
        totalPredictions: 0,
        accuracy: 0,
        roundsParticipated: 0,
        averagePointsPerRound: 0,
        bestRoundPerformance: 0
      };
    }
  }

  /**
   * Get recent form trend for a user
   */
  private async getRecentFormTrend(userId: string): Promise<'improving' | 'declining' | 'stable'> {
    try {
      const { data: recentRounds, error } = await this.client
        .from('betting_rounds')
        .select('id, scored_at')
        .eq('status', 'scored')
        .order('scored_at', { ascending: false })
        .limit(3);

      if (error || !recentRounds || recentRounds.length < 3) {
        return 'stable';
      }

      const roundPerformances = await Promise.all(
        recentRounds.map(async (round) => {
          const { data: bets } = await this.client
            .from('user_bets')
            .select('points_awarded')
            .eq('user_id', userId)
            .eq('betting_round_id', round.id)
            .not('points_awarded', 'is', null);

          if (!bets || bets.length === 0) return 0;
          
          const correct = bets.filter(bet => bet.points_awarded && bet.points_awarded > 0).length;
          return bets.length > 0 ? (correct / bets.length) : 0;
        })
      );

      // Calculate trend: compare most recent with oldest of the 3
      const [newest, , oldest] = roundPerformances;
      const trendThreshold = 0.1; // 10% difference threshold

      if (newest - oldest > trendThreshold) {
        return 'improving';
      } else if (oldest - newest > trendThreshold) {
        return 'declining';
      } else {
        return 'stable';
      }

    } catch (error) {
      logger.error({ userId, error }, 'Error calculating recent form trend');
      return 'stable';
    }
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Convenience function to get user performance data for a single user
 */
export async function getUserPerformanceData(userId: string): Promise<UserPerformanceData | null> {
  const service = new UserDataAggregationService();
  return service.getUserPerformanceData(userId);
}

/**
 * Convenience function to get performance data for all users
 */
export async function getAllUsersPerformanceData(): Promise<UserPerformanceData[]> {
  const service = new UserDataAggregationService();
  return service.getAllUsersPerformanceData();
}

/**
 * Get top performers for email highlights
 */
export async function getTopPerformers(limit: number = 5): Promise<UserPerformanceData[]> {
  const allUsersData = await getAllUsersPerformanceData();
  return allUsersData
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit);
}

/**
 * Get users with biggest position changes (movers)
 */
export async function getBiggestMovers(limit: number = 3): Promise<{
  climbers: UserPerformanceData[];
  fallers: UserPerformanceData[];
}> {
  const allUsers = await getAllUsersPerformanceData();
  
  const climbers = allUsers
    .filter(user => user.positionChange > 0)
    .sort((a, b) => b.positionChange - a.positionChange)
    .slice(0, limit);
    
  const fallers = allUsers
    .filter(user => user.positionChange < 0)
    .sort((a, b) => a.positionChange - b.positionChange)
    .slice(0, limit);

  return { climbers, fallers };
}

/**
 * Get transparency email data for a specific round - all users' predictions
 */
export async function getAllUsersPredictionsForRound(roundId: number): Promise<TransparencyEmailData | null> {
  const service = new UserDataAggregationService();
  return service.getAllUsersPredictionsForRound(roundId);
} 