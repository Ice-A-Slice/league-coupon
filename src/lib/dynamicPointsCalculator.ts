// src/lib/dynamicPointsCalculator.ts

import { type ILeagueDataService } from './leagueDataService';
// Import the function to fetch user predictions and the row type
import { getUserSeasonPredictions, type UserSeasonAnswerRow } from './supabase/queries'; 
import { getCurrentSeasonId } from '@/lib/seasons'; // Need this to map seasonYear to seasonId

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
   * @returns A Promise resolving to a DynamicPointsResult object or null if calculation fails.
   */
  async calculateDynamicPoints(
    userId: string, // Added parameter
    competitionApiId: number,
    seasonYear: number
  ): Promise<DynamicPointsResult | null> {
    console.log(`Calculating dynamic points for user ${userId}, league ${competitionApiId}, season ${seasonYear}`);

    // --- Steps to implement (Subtasks 4.2 - 4.6) ---

    // 1. Fetch User's Season Predictions (Subtask 4.2)
    // First, get the internal season DB ID corresponding to the API season year
    // Note: We might need a more robust way to link API season year to DB season ID if multiple seasons exist for a year
    const seasonId = await getCurrentSeasonId(); // Assuming this gets the *correct* season ID based on is_current or similar logic.
                                                // If we need to support scoring *past* seasons, this needs refinement.
    if (!seasonId) {
        console.error(`Could not determine the database season ID for calculation (user: ${userId}, year: ${seasonYear}).`);
        return null;
    }

    const userPredictions = await getUserSeasonPredictions(userId, seasonId);

    if (userPredictions === null) {
        // This indicates an error during fetching
        console.error(`Failed to fetch season predictions for user ${userId}, season ID ${seasonId}. Cannot calculate points.`);
        return null; 
    }
    if (userPredictions.length === 0) {
        console.warn(`No season predictions found for user ${userId}, season ID ${seasonId}. Calculating points as 0.`);
        // Return 0 points if the user hasn't submitted answers for this season
        return {
            totalPoints: 0,
            details: {
                leagueWinnerCorrect: false,
                topScorerCorrect: false,
                bestGoalDifferenceCorrect: false,
                lastPlaceCorrect: false
            }
        };
    }

    // 2. Fetch Current League Data (Subtask 4.3)
    //    - Get league table, top scorer(s) etc. using LeagueDataService
    //    - Note: Need to handle potential ties (e.g., multiple top scorers)
    const leagueTable = await this.leagueDataService.getCurrentLeagueTable(competitionApiId, seasonYear);
    const topScorers = await this.leagueDataService.getCurrentTopScorers(competitionApiId, seasonYear);
    const bestGDTeam = await this.leagueDataService.getTeamWithBestGoalDifference(competitionApiId, seasonYear);
    const lastTeam = await this.leagueDataService.getLastPlaceTeam(competitionApiId, seasonYear);

    // Check if all necessary data was fetched
    if (!leagueTable || !topScorers || !bestGDTeam || !lastTeam) {
        console.error(`Failed to fetch necessary league data for dynamic points calculation (league: ${competitionApiId}, season: ${seasonYear}).`);
        // Decide how to handle: return null, or calculate based on available data?
        // Returning null for now, as partial calculation might be misleading.
        return null;
    }

    // 3. Compare Predictions (Subtask 4.4)
    const results = {
        leagueWinnerCorrect: false,
        topScorerCorrect: false,
        bestGoalDifferenceCorrect: false,
        lastPlaceCorrect: false
    };

    // Helper function to find a specific answer
    const findAnswer = (type: string): UserSeasonAnswerRow | undefined => {
        return userPredictions.find(p => p.question_type === type);
    };

    // --- Compare League Winner ---
    const winnerPrediction = findAnswer('league_winner');
    if (winnerPrediction && leagueTable.standings.length > 0) {
        const actualWinnerTeamId = leagueTable.standings[0].team_id;
        if (winnerPrediction.answered_team_id === actualWinnerTeamId) {
            results.leagueWinnerCorrect = true;
        }
    }

    // --- Compare Top Scorer ---
    const topScorerPrediction = findAnswer('top_scorer');
    if (topScorerPrediction && topScorers.length > 0) {
        const predictedPlayerId = topScorerPrediction.answered_player_id;
        if (predictedPlayerId !== null) {
            // Find the maximum goals scored
            const maxGoals = Math.max(...topScorers.map(p => p.goals));
            // Find all players who achieved the maximum goals
            const actualTopScorerIds = topScorers
                .filter(p => p.goals === maxGoals)
                .map(p => p.player_api_id);
            // Check if the user's prediction is among the actual top scorers
            if (actualTopScorerIds.includes(predictedPlayerId)) {
                results.topScorerCorrect = true;
            }
        }
    }

    // --- Compare Best Goal Difference ---
    const bestGDPrediction = findAnswer('best_goal_difference');
    if (bestGDPrediction && bestGDTeam) {
        const predictedTeamId = bestGDPrediction.answered_team_id;
        const actualBestGDTeamId = bestGDTeam.team_id;
        // Note: Current leagueDataService returns only one team even if tied.
        // If ties need specific handling (e.g., user predicts any of the tied teams), service needs update.
        if (predictedTeamId === actualBestGDTeamId) {
            results.bestGoalDifferenceCorrect = true;
        }
    }

    // --- Compare Last Place Team ---
    const lastPlacePrediction = findAnswer('last_place');
    if (lastPlacePrediction && lastTeam) {
        const predictedTeamId = lastPlacePrediction.answered_team_id;
        const actualLastTeamId = lastTeam.team_id;
        // Note: Similar tie consideration as Best GD.
        if (predictedTeamId === actualLastTeamId) {
            results.lastPlaceCorrect = true;
        }
    }

    // 4. Calculate Points (Subtask 4.5)
    let totalPoints = 0;
    if (results.leagueWinnerCorrect) totalPoints += 3;
    if (results.topScorerCorrect) totalPoints += 3;
    if (results.bestGoalDifferenceCorrect) totalPoints += 3;
    if (results.lastPlaceCorrect) totalPoints += 3;

    // 5. Finalize Result (Subtask 4.6)
    const finalResult: DynamicPointsResult = {
      totalPoints: totalPoints,
      details: results,
    };

    console.log(`Calculated dynamic points for user ${userId}, season ID ${seasonId}:`, finalResult);
    return finalResult;
  }

  // --- Helper methods for comparisons can be added below ---

} 