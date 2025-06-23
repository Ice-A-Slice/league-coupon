// src/lib/dynamicPointsCalculator.ts

import { type ILeagueDataService } from './leagueDataService';
// Import the function to fetch user predictions and the row type
// import { getUserSeasonPredictions, type UserSeasonAnswerRow } from './supabase/queries'; 
// import { getCurrentSeasonId } from '@/lib/seasons'; // Need this to map seasonYear to seasonId
import type { UserSeasonAnswerRow } from './supabase/queries'; // Keep type import if needed elsewhere, or define locally
import { logger } from '@/utils/logger'; // Import the logger

/**
 * Structure for the result of the dynamic points calculation.
 */
export interface DynamicPointsResult {
  totalPoints: number; // Total dynamic points (0-12)
  details: {
    leagueWinnerCorrect: boolean;
    topScorerCorrect: boolean;
    bestGoalDifferenceCorrect: boolean;
    lastPlaceCorrect: boolean;
    // Potentially add actual winning team/player IDs here for logging/debugging
  };
}

/**
 * Calculates dynamic questionnaire points based on current league state 
 * and user's season-long predictions.
 */
export class DynamicPointsCalculator {
  private leagueDataService: ILeagueDataService;

  constructor(leagueDataService: ILeagueDataService) {
    this.leagueDataService = leagueDataService;
  }

  /**
   * Calculates the dynamic points for a given user based on the current state of a specific competition season.
   * 
   * @param userId The ID of the user whose points are being calculated.
   * @param competitionApiId The API ID of the competition (e.g., Premier League).
   * @param seasonYear The API representation of the season (e.g., 2024).
   * @param userSeasonAnswers The user's pre-fetched season answers.
   * @returns A Promise resolving to a DynamicPointsResult object or null if calculation fails.
   */
  async calculateDynamicPoints(
    userId: string, // Still useful for logging/context if needed
    competitionApiId: number,
    seasonYear: number,
    userSeasonAnswers: UserSeasonAnswerRow[] // New parameter: user's pre-fetched answers
  ): Promise<DynamicPointsResult | null> {
    logger.info(
      { userId, competitionApiId, seasonYear, answerCount: userSeasonAnswers.length }, 
      `Calculating dynamic points for user.`
    );

    // 1. Fetch current league data (already good)
    const leagueTable = await this.leagueDataService.getCurrentLeagueTable(competitionApiId, seasonYear);
    const topScorers = await this.leagueDataService.getCurrentTopScorers(competitionApiId, seasonYear);
    const teamWithBestGD = await this.leagueDataService.getTeamWithBestGoalDifference(competitionApiId, seasonYear);
    const lastPlaceTeam = await this.leagueDataService.getLastPlaceTeam(competitionApiId, seasonYear);

    if (!leagueTable || !topScorers || !teamWithBestGD || !lastPlaceTeam) {
      logger.warn({ userId, competitionApiId, seasonYear }, 'Missing some live league data; cannot calculate dynamic points.');
      return null;
    }

    // Log the current actual standings for debugging
    const actualCurrentWinner = leagueTable.standings.length > 0 ? leagueTable.standings[0] : null;
    const actualTopScorer = topScorers.length > 0 ? topScorers[0] : null;
    
    logger.info({
      userId,
      actualStandings: {
        currentLeader: actualCurrentWinner ? { 
          teamId: actualCurrentWinner.team_id, 
          teamName: actualCurrentWinner.team_name,
          rank: actualCurrentWinner.rank 
        } : null,
        topScorer: actualTopScorer ? { 
          playerId: actualTopScorer.player_api_id, 
          playerName: actualTopScorer.player_name,
          goals: actualTopScorer.goals 
        } : null,
        bestGoalDifferenceTeam: { 
          teamId: teamWithBestGD.team_id, 
          teamName: teamWithBestGD.team_name,
          goalDifference: teamWithBestGD.goals_difference 
        },
        lastPlaceTeam: { 
          teamId: lastPlaceTeam.team_id, 
          teamName: lastPlaceTeam.team_name,
          rank: lastPlaceTeam.rank 
        }
      }
    }, 'Current actual standings for comparison');

    // 2. Use the provided userPredictions (userSeasonAnswers)
    // No need to fetch seasonId or call getUserSeasonPredictions here anymore.
    const userPredictions = userSeasonAnswers; 

    if (!userPredictions || userPredictions.length === 0) {
      logger.warn({ userId, competitionApiId, seasonYear }, 'User has no season predictions; cannot calculate dynamic points.');
      return null;
    }
    
    // Log user's predictions for debugging
    logger.info({ 
      userId, 
      predictionCount: userPredictions.length,
      userPredictions: userPredictions.map(p => ({
        questionType: p.question_type,
        answeredTeamId: p.answered_team_id,
        answeredPlayerId: p.answered_player_id
      }))
    }, `Found user predictions to evaluate.`);

    // 3. Compare Predictions (existing logic is mostly fine, uses userPredictions)
    const results = {
        leagueWinnerCorrect: false,
        topScorerCorrect: false,
        bestGoalDifferenceCorrect: false,
        lastPlaceCorrect: false
    };

    const findAnswer = (type: string): UserSeasonAnswerRow | undefined => {
        return userPredictions.find(p => p.question_type === type);
    };

    // --- Compare League Winner ---
    const winnerPrediction = findAnswer('league_winner');
    if (winnerPrediction && leagueTable.standings.length > 0) {
        const actualWinnerTeamId = leagueTable.standings[0].team_id;
        logger.info({
          userId,
          question: 'league_winner',
          userPredictedTeamId: winnerPrediction.answered_team_id,
          actualCurrentLeaderTeamId: actualWinnerTeamId,
          matches: winnerPrediction.answered_team_id === actualWinnerTeamId
        }, 'League winner comparison');
        
        if (winnerPrediction.answered_team_id === actualWinnerTeamId) {
            results.leagueWinnerCorrect = true;
        }
    }

    // --- Compare Top Scorer ---
    const topScorerPrediction = findAnswer('top_scorer');
    if (topScorerPrediction && topScorers.length > 0) {
        // Assuming topScorers is sorted, first one is the top scorer
        const actualTopScorerPlayerId = topScorers[0].player_api_id; // Correct property name
        logger.info({
          userId,
          question: 'top_scorer',
          userPredictedPlayerId: topScorerPrediction.answered_player_id,
          actualTopScorerPlayerId: actualTopScorerPlayerId,
          matches: topScorerPrediction.answered_player_id === actualTopScorerPlayerId
        }, 'Top scorer comparison');
        
        if (topScorerPrediction.answered_player_id === actualTopScorerPlayerId) {
            results.topScorerCorrect = true;
        }
    }

    // --- Compare Best Goal Difference ---
    const bestGDPrediction = findAnswer('best_goal_difference');
    if (bestGDPrediction && teamWithBestGD) {
        logger.info({
          userId,
          question: 'best_goal_difference',
          userPredictedTeamId: bestGDPrediction.answered_team_id,
          actualBestGDTeamId: teamWithBestGD.team_id,
          matches: bestGDPrediction.answered_team_id === teamWithBestGD.team_id
        }, 'Best goal difference comparison');
        
        if (bestGDPrediction.answered_team_id === teamWithBestGD.team_id) {
            results.bestGoalDifferenceCorrect = true;
        }
    }

    // --- Compare Last Place Team ---
    const lastPlacePrediction = findAnswer('last_place');
    if (lastPlacePrediction && lastPlaceTeam) {
        logger.info({
          userId,
          question: 'last_place',
          userPredictedTeamId: lastPlacePrediction.answered_team_id,
          actualLastPlaceTeamId: lastPlaceTeam.team_id,
          matches: lastPlacePrediction.answered_team_id === lastPlaceTeam.team_id
        }, 'Last place comparison');
        
        if (lastPlacePrediction.answered_team_id === lastPlaceTeam.team_id) {
            results.lastPlaceCorrect = true;
        }
    }

    // 4. Calculate total points (3 points per correct answer)
    let totalDynamicPoints = 0;
    if (results.leagueWinnerCorrect) totalDynamicPoints += 3;
    if (results.topScorerCorrect) totalDynamicPoints += 3;
    if (results.bestGoalDifferenceCorrect) totalDynamicPoints += 3;
    if (results.lastPlaceCorrect) totalDynamicPoints += 3;

    logger.info({ userId, totalDynamicPoints, details: results }, 'Dynamic points calculation complete.');

    return {
        totalPoints: totalDynamicPoints,
        details: results,
    };
  }

  // --- Helper methods for comparisons can be added below ---

} 