// src/lib/dynamicPointsCalculator.ts

import { type ILeagueDataService } from './leagueDataService';
// Import the function to fetch user predictions and the row type
// import { getUserSeasonPredictions, type UserSeasonAnswerRow } from './supabase/queries'; 
// import { getCurrentSeasonId } from '@/lib/seasons'; // Need this to map seasonYear to seasonId
import type { UserSeasonAnswerRow } from './supabase/queries'; // Keep type import if needed elsewhere, or define locally
import { logger } from '@/utils/logger'; // Import the logger
import { supabaseServerClient } from '@/lib/supabase/server'; // Add supabase client for ID mapping

// --- NEW: Type Definitions for Multiple Answers Support ---

/**
 * Union type that can handle both single values and arrays of valid answers.
 * Used for backward compatibility while supporting multiple correct answers.
 */
export type ValidAnswer = number | number[];

/**
 * Type definition for comparison answers that handles both legacy single answers
 * and new multiple answer scenarios for dynamic points calculation.
 */
export interface AnswerComparisonData {
  /** Player ID(s) for top scorer comparison - can be single ID or array of tied IDs */
  topScorerAnswer: ValidAnswer;
  /** Team ID(s) for best goal difference comparison - can be single ID or array of tied IDs */
  bestGoalDifferenceAnswer: ValidAnswer;
  /** Team ID for league winner comparison - single ID for Phase 1 */
  leagueWinnerAnswer: number;
  /** Team ID for last place comparison - single ID for Phase 1 */
  lastPlaceAnswer: number;
}

/**
 * Type guard to check if an answer is a single value (number) or array of values.
 * @param answer The answer to check
 * @returns true if the answer is an array, false if it's a single number
 */
export function isMultipleAnswer(answer: ValidAnswer): answer is number[] {
  return Array.isArray(answer);
}

/**
 * Type guard to check if an answer is a single value.
 * @param answer The answer to check  
 * @returns true if the answer is a single number, false if it's an array
 */
export function isSingleAnswer(answer: ValidAnswer): answer is number {
  return typeof answer === 'number' && !isNaN(answer);
}

/**
 * Utility function to normalize answers to arrays for unified processing.
 * Converts single values to single-item arrays for consistent handling.
 * @param answer Single value or array of values
 * @returns Array of values (single value becomes single-item array)
 */
export function normalizeAnswerToArray(answer: ValidAnswer): number[] {
  if (isMultipleAnswer(answer)) {
    return answer;
  }
  return [answer];
}

/**
 * Utility function to check if a user prediction matches any of the valid answers.
 * Handles both single answers and multiple tied answers.
 * @param userPrediction The user's predicted ID
 * @param validAnswers Single valid answer or array of valid answers
 * @returns true if the user's prediction matches any valid answer
 */
export function doesUserPredictionMatch(userPrediction: number, validAnswers: ValidAnswer): boolean {
  // Handle NaN - never matches anything (important for data integrity)
  if (isNaN(userPrediction)) {
    return false;
  }
  
  const validAnswersArray = normalizeAnswerToArray(validAnswers);
  
  // Filter out any NaN values from valid answers and check for match
  const cleanValidAnswers = validAnswersArray.filter(answer => !isNaN(answer));
  return cleanValidAnswers.includes(userPrediction);
}

// --- NEW: Answer Normalization Utilities ---

/**
 * Normalizes a raw numeric value to ensure it's a valid number for comparison.
 * Handles string numbers, removes decimal places for IDs, and validates ranges.
 * @param rawValue The raw input value to normalize
 * @returns Normalized number or null if invalid
 */
export function normalizeNumericAnswer(rawValue: unknown): number | null {
  // Handle null/undefined
  if (rawValue == null) {
    return null;
  }

  let numericValue: number;

  // Convert string numbers to numbers
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return null;
    }
    numericValue = Number(trimmed);
  } else if (typeof rawValue === 'number') {
    numericValue = rawValue;
  } else {
    // Invalid type (boolean, object, etc.)
    return null;
  }

  // Check for NaN and infinity
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  // For IDs, convert to integer and ensure positive
  const integerValue = Math.floor(Math.abs(numericValue));
  
  // Validate reasonable range for IDs (1 to 10 million)
  if (integerValue < 1 || integerValue > 10_000_000) {
    return null;
  }

  return integerValue;
}

/**
 * Normalizes user predictions to ensure consistent format for comparison.
 * Converts strings to numbers and validates the input.
 * @param userPrediction Raw user prediction input
 * @returns Normalized prediction number or null if invalid
 */
export function normalizeUserPrediction(userPrediction: unknown): number | null {
  const normalized = normalizeNumericAnswer(userPrediction);
  
  if (normalized === null) {
    console.warn('normalizeUserPrediction: Invalid user prediction provided:', userPrediction);
  }
  
  return normalized;
}

/**
 * Normalizes an array of valid answers, filtering out invalid values.
 * Ensures all answers are proper numeric IDs suitable for comparison.
 * @param rawAnswers Array of raw answer values
 * @returns Array of valid normalized answer numbers
 */
export function normalizeValidAnswersArray(rawAnswers: unknown[]): number[] {
  if (!Array.isArray(rawAnswers)) {
    console.warn('normalizeValidAnswersArray: Expected array but received:', typeof rawAnswers);
    return [];
  }

  const normalizedAnswers: number[] = [];
  
  for (let i = 0; i < rawAnswers.length; i++) {
    const normalized = normalizeNumericAnswer(rawAnswers[i]);
    if (normalized !== null) {
      // Avoid duplicates
      if (!normalizedAnswers.includes(normalized)) {
        normalizedAnswers.push(normalized);
      }
    } else {
      console.warn(`normalizeValidAnswersArray: Invalid answer at index ${i}:`, rawAnswers[i]);
    }
  }
  
  return normalizedAnswers;
}

/**
 * Converts legacy single answer format to normalized array format.
 * This enables unified processing of both old and new answer formats.
 * @param legacyAnswer Single answer value from legacy system
 * @returns Array containing the normalized answer, or empty array if invalid
 */
export function convertLegacyAnswerToArray(legacyAnswer: unknown): number[] {
  const normalized = normalizeNumericAnswer(legacyAnswer);
  return normalized !== null ? [normalized] : [];
}

/**
 * Enhanced answer normalization that handles both single values and arrays.
 * This is the main normalization function that should be used throughout the system.
 * @param rawAnswer Single value or array from any source (API, database, user input)
 * @returns Array of normalized valid answer numbers
 */
export function normalizeAnswer(rawAnswer: unknown): number[] {
  // Handle null/undefined
  if (rawAnswer == null) {
    return [];
  }

  // Handle arrays
  if (Array.isArray(rawAnswer)) {
    return normalizeValidAnswersArray(rawAnswer);
  }

  // Handle single values (legacy format)
  return convertLegacyAnswerToArray(rawAnswer);
}

/**
 * Enhanced user prediction matching with comprehensive normalization.
 * This replaces the basic doesUserPredictionMatch with full normalization support.
 * @param rawUserPrediction Raw user prediction (any format)
 * @param rawValidAnswers Raw valid answers (single value or array, any format)
 * @returns true if the normalized user prediction matches any normalized valid answer
 */
export function doesNormalizedUserPredictionMatch(
  rawUserPrediction: unknown, 
  rawValidAnswers: unknown
): boolean {
  // Normalize user prediction
  const normalizedUserPrediction = normalizeUserPrediction(rawUserPrediction);
  if (normalizedUserPrediction === null) {
    return false;
  }

  // Normalize valid answers
  const normalizedValidAnswers = normalizeAnswer(rawValidAnswers);
  if (normalizedValidAnswers.length === 0) {
    return false;
  }

  // Check for match
  return normalizedValidAnswers.includes(normalizedUserPrediction);
}

// --- END: Answer Normalization Utilities ---

// --- NEW: Comparison Strategy Pattern ---

/**
 * Interface for different answer comparison strategies.
 * Enables flexible comparison logic for different question types.
 */
export interface AnswerComparisonStrategy {
  /**
   * Compares a user's prediction against valid answers using the strategy's logic.
   * @param userPrediction The user's predicted ID (already normalized)
   * @param validAnswers Array of valid answer IDs (already normalized)
   * @param context Additional context for logging and debugging
   * @returns Comparison result with match status and details
   */
  compare(
    userPrediction: number,
    validAnswers: number[],
    context: ComparisonContext
  ): ComparisonResult;
}

/**
 * Context information for comparison operations.
 */
export interface ComparisonContext {
  userId: string;
  questionType: string;
  competitionApiId: number;
  seasonYear: number;
}

/**
 * Result of a comparison operation.
 */
export interface ComparisonResult {
  /** Whether the user's prediction matches any valid answer */
  isMatch: boolean;
  /** The specific valid answer that matched (if any) */
  matchedAnswer?: number;
  /** All valid answers that were checked */
  allValidAnswers: number[];
  /** Additional details for logging */
  details: {
    userPrediction: number;
    totalValidAnswers: number;
    comparisonStrategy: string;
  };
}

/**
 * Default exact match strategy for most question types.
 * Uses exact ID matching with comprehensive logging and performance monitoring.
 */
export class ExactMatchStrategy implements AnswerComparisonStrategy {
  compare(
    userPrediction: number,
    validAnswers: number[],
    context: ComparisonContext
  ): ComparisonResult {
    const startTime = performance.now();
    
    const isMatch = validAnswers.includes(userPrediction);
    const matchedAnswer = isMatch ? userPrediction : undefined;
    
    const endTime = performance.now();
    const comparisonTimeMs = endTime - startTime;

    // Enhanced logging with multiple answer context and performance timing
    const logData = {
      userId: context.userId,
      questionType: context.questionType,
      userPrediction: userPrediction,
      validAnswers: validAnswers,
      totalValidAnswers: validAnswers.length,
      isMatch: isMatch,
      matchedAnswer: matchedAnswer,
      strategy: 'ExactMatch',
      performance: {
        comparisonTimeMs: Number(comparisonTimeMs.toFixed(3)),
        validAnswersProcessed: validAnswers.length
      }
    };

    const logMessage = `${context.questionType} comparison: ${isMatch ? 'MATCH' : 'NO MATCH'} - ${
      isMatch 
        ? `User predicted ${userPrediction} which matches one of the valid answers`
        : `User predicted ${userPrediction} but valid answers are: [${validAnswers.join(', ')}]`
    } (${comparisonTimeMs.toFixed(3)}ms)`;

    // Log level control: Use debug for performance details when not critical
    if (validAnswers.length > 10 || comparisonTimeMs > 1.0) {
      // Performance-critical scenarios get info level for monitoring
      logger.info(logData, logMessage);
    } else {
      // Normal scenarios get debug level to manage verbosity
      logger.debug(logData, logMessage);
    }

    return {
      isMatch,
      matchedAnswer,
      allValidAnswers: validAnswers,
      details: {
        userPrediction,
        totalValidAnswers: validAnswers.length,
        comparisonStrategy: 'ExactMatch'
      }
    };
  }
}

/**
 * Strategy for top scorer comparisons with special tie-handling logic and enhanced monitoring.
 * Could be extended for player-specific comparison rules if needed.
 */
export class TopScorerStrategy extends ExactMatchStrategy {
  compare(
    userPrediction: number,
    validAnswers: number[],
    context: ComparisonContext
  ): ComparisonResult {
    const startTime = performance.now();
    const result = super.compare(userPrediction, validAnswers, context);
    const endTime = performance.now();
    
    // Override strategy name for logging
    result.details.comparisonStrategy = 'TopScorerExactMatch';
    
    // Enhanced logging for top scorer scenarios with performance timing
    if (validAnswers.length > 1) {
      const tieProcessingTime = endTime - startTime;
      
      const tieLogData = {
        userId: context.userId,
        tiedPlayers: validAnswers.length,
        tiedPlayerIds: validAnswers,
        questionType: context.questionType,
        performance: {
          tieProcessingTimeMs: Number(tieProcessingTime.toFixed(3)),
          playersEvaluated: validAnswers.length
        }
      };

      const tieLogMessage = `Top scorer tie detected: ${validAnswers.length} players tied for highest goals (${tieProcessingTime.toFixed(3)}ms processing)`;

      // Log level control for tie scenarios
      if (validAnswers.length > 5 || tieProcessingTime > 2.0) {
        // Complex ties or slow processing get info level for monitoring
        logger.info(tieLogData, tieLogMessage);
      } else {
        // Simple ties get debug level to reduce verbosity
        logger.debug(tieLogData, tieLogMessage);
      }
    }
    
    return result;
  }
}

/**
 * Strategy for goal difference comparisons with special team-specific logic and enhanced monitoring.
 * Could be extended for team-specific comparison rules if needed.
 */
export class GoalDifferenceStrategy extends ExactMatchStrategy {
  compare(
    userPrediction: number,
    validAnswers: number[],
    context: ComparisonContext
  ): ComparisonResult {
    const startTime = performance.now();
    const result = super.compare(userPrediction, validAnswers, context);
    const endTime = performance.now();
    
    // Override strategy name for logging  
    result.details.comparisonStrategy = 'GoalDifferenceExactMatch';
    
    // Enhanced logging for goal difference scenarios with performance timing
    if (validAnswers.length > 1) {
      const tieProcessingTime = endTime - startTime;
      
      const tieLogData = {
        userId: context.userId,
        tiedTeams: validAnswers.length,
        tiedTeamIds: validAnswers,
        questionType: context.questionType,
        performance: {
          tieProcessingTimeMs: Number(tieProcessingTime.toFixed(3)),
          teamsEvaluated: validAnswers.length
        }
      };

      const tieLogMessage = `Goal difference tie detected: ${validAnswers.length} teams tied for best goal difference (${tieProcessingTime.toFixed(3)}ms processing)`;

      // Log level control for tie scenarios
      if (validAnswers.length > 8 || tieProcessingTime > 2.0) {
        // Complex ties or slow processing get info level for monitoring  
        logger.info(tieLogData, tieLogMessage);
      } else {
        // Simple ties get debug level to reduce verbosity
        logger.debug(tieLogData, tieLogMessage);
      }
    }
    
    return result;
  }
}

// --- END: Comparison Strategy Pattern ---

// --- END: Type Definitions for Multiple Answers Support ---

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
    // Enhanced details for multiple answer scenarios
    comparisonDetails?: {
      leagueWinner?: ComparisonResult;
      topScorer?: ComparisonResult;
      bestGoalDifference?: ComparisonResult;
      lastPlace?: ComparisonResult;
    };
  };
}

/**
 * Maps database team IDs to API team IDs
 */
async function mapTeamDbIdToApiId(dbTeamId: number): Promise<number | null> {
  try {
    const { data, error } = await supabaseServerClient
      .from('teams')
      .select('api_team_id')
      .eq('id', dbTeamId)
      .single();

    if (error || !data) {
      logger.warn({ dbTeamId, error: error?.message }, 'Failed to map database team ID to API team ID');
      return null;
    }

    return data.api_team_id;
  } catch (error) {
    logger.error({ dbTeamId, error }, 'Error mapping database team ID to API team ID');
    return null;
  }
}

/**
 * Maps database player IDs to API player IDs
 */
async function mapPlayerDbIdToApiId(dbPlayerId: number): Promise<number | null> {
  try {
    const { data, error } = await supabaseServerClient
      .from('players')
      .select('api_player_id')
      .eq('id', dbPlayerId)
      .single();

    if (error || !data) {
      logger.warn({ dbPlayerId, error: error?.message }, 'Failed to map database player ID to API player ID');
      return null;
    }

    return data.api_player_id;
  } catch (error) {
    logger.error({ dbPlayerId, error }, 'Error mapping database player ID to API player ID');
    return null;
  }
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
    const calculationStartTime = performance.now();
    
    logger.info(
      { userId, competitionApiId, seasonYear, answerCount: userSeasonAnswers.length }, 
      `Calculating dynamic points using enhanced multiple-answer logic.`
    );

    // 1. Fetch current league data using BOTH single and multiple answer methods
    const leagueTable = await this.leagueDataService.getCurrentLeagueTable(competitionApiId, seasonYear);
    const lastPlaceTeam = await this.leagueDataService.getLastPlaceTeam(competitionApiId, seasonYear);
    
    // NEW: Use multiple-answer methods for top scorers and goal difference
    const topScorerIds = await this.leagueDataService.getTopScorers(competitionApiId, seasonYear);
    const bestGoalDifferenceTeamIds = await this.leagueDataService.getBestGoalDifferenceTeams(competitionApiId, seasonYear);
    
    // Keep single-answer methods for backward compatibility and additional context
    const legacyTopScorers = await this.leagueDataService.getCurrentTopScorers(competitionApiId, seasonYear);
    const legacyBestGDTeam = await this.leagueDataService.getTeamWithBestGoalDifference(competitionApiId, seasonYear);

    // Validate required data
    if (!leagueTable || !lastPlaceTeam || !topScorerIds || !bestGoalDifferenceTeamIds) {
      logger.warn({ 
        userId, 
        competitionApiId, 
        seasonYear,
        hasLeagueTable: !!leagueTable,
        hasLastPlaceTeam: !!lastPlaceTeam,
        hasTopScorerIds: !!topScorerIds,
        hasBestGDTeamIds: !!bestGoalDifferenceTeamIds
      }, 'Missing some live league data; cannot calculate dynamic points.');
      return null;
    }

    // Log the current actual standings for debugging (enhanced for multiple answers)
    const actualCurrentWinner = leagueTable.standings.length > 0 ? leagueTable.standings[0] : null;
    const legacyTopScorer = legacyTopScorers && legacyTopScorers.length > 0 ? legacyTopScorers[0] : null;
    
    logger.info({
      userId,
      actualStandings: {
        currentLeader: actualCurrentWinner ? { 
          teamId: actualCurrentWinner.team_id, 
          teamName: actualCurrentWinner.team_name,
          rank: actualCurrentWinner.rank 
        } : null,
        topScorerIds: {
          multipleAnswerIds: topScorerIds,
          totalTied: topScorerIds.length,
          legacyFirstScorer: legacyTopScorer ? {
            playerId: legacyTopScorer.player_api_id,
            playerName: legacyTopScorer.player_name,
            goals: legacyTopScorer.goals
          } : null
        },
        bestGoalDifferenceIds: {
          multipleAnswerIds: bestGoalDifferenceTeamIds,
          totalTied: bestGoalDifferenceTeamIds.length,
          legacyBestTeam: legacyBestGDTeam ? {
            teamId: legacyBestGDTeam.team_id,
            teamName: legacyBestGDTeam.team_name,
            goalDifference: legacyBestGDTeam.goals_difference
          } : null
        },
        lastPlaceTeam: { 
          teamId: lastPlaceTeam.team_id, 
          teamName: lastPlaceTeam.team_name,
          rank: lastPlaceTeam.rank 
        }
      }
    }, 'Current actual standings for comparison (with multiple answer support)');

    // 2. Use the provided userPredictions (userSeasonAnswers)
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
    }, `Found user predictions to evaluate using enhanced comparison logic.`);

    // 3. Initialize comparison strategies
    const exactMatchStrategy = new ExactMatchStrategy();
    const topScorerStrategy = new TopScorerStrategy();
    const goalDifferenceStrategy = new GoalDifferenceStrategy();

    // 4. Initialize results and comparison context
    const results = {
        leagueWinnerCorrect: false,
        topScorerCorrect: false,
        bestGoalDifferenceCorrect: false,
        lastPlaceCorrect: false
    };

    const comparisonDetails: {
      leagueWinner?: ComparisonResult;
      topScorer?: ComparisonResult;
      bestGoalDifference?: ComparisonResult;
      lastPlace?: ComparisonResult;
    } = {};

    const findAnswer = (type: string): UserSeasonAnswerRow | undefined => {
        return userPredictions.find(p => p.question_type === type);
    };

    const createContext = (questionType: string): ComparisonContext => ({
      userId,
      questionType,
      competitionApiId,
      seasonYear
    });

    // --- Compare League Winner (Enhanced with Strategy Pattern) ---
    const winnerPrediction = findAnswer('league_winner');
    if (winnerPrediction && leagueTable.standings.length > 0) {
        const actualWinnerTeamId = leagueTable.standings[0].team_id;
        
        // Convert database team ID to API team ID for comparison
        const userPredictedApiTeamId = winnerPrediction.answered_team_id ? 
          await mapTeamDbIdToApiId(winnerPrediction.answered_team_id) : null;
        
        if (userPredictedApiTeamId !== null) {
          // Use strategy pattern for comparison (single answer for Phase 1)
          const comparisonResult = exactMatchStrategy.compare(
            userPredictedApiTeamId,
            [actualWinnerTeamId], // Single answer wrapped in array for consistency
            createContext('league_winner')
          );
          
          results.leagueWinnerCorrect = comparisonResult.isMatch;
          comparisonDetails.leagueWinner = comparisonResult;
          
          logger.info({
            userId,
            question: 'league_winner',
            userPredictedDbTeamId: winnerPrediction.answered_team_id,
            userPredictedApiTeamId: userPredictedApiTeamId,
            actualCurrentLeaderTeamId: actualWinnerTeamId,
            matches: comparisonResult.isMatch,
            comparisonStrategy: 'ExactMatch'
          }, `League winner comparison: ${comparisonResult.isMatch ? 'MATCH' : 'NO MATCH'}`);
        } else {
          logger.warn({
            userId,
            question: 'league_winner',
            userPredictedDbTeamId: winnerPrediction.answered_team_id
          }, 'Could not map user predicted team DB ID to API ID for league winner comparison');
        }
    }

    // --- Compare Top Scorer (Enhanced with Multiple Answer Support) ---
    const topScorerPrediction = findAnswer('top_scorer');
    if (topScorerPrediction && topScorerIds.length > 0) {
        // Convert database player ID to API player ID for comparison
        const userPredictedApiPlayerId = topScorerPrediction.answered_player_id ? 
          await mapPlayerDbIdToApiId(topScorerPrediction.answered_player_id) : null;
        
        if (userPredictedApiPlayerId !== null) {
          // Use top scorer strategy for comparison (supports multiple tied players)
          const comparisonResult = topScorerStrategy.compare(
            userPredictedApiPlayerId,
            topScorerIds, // Multiple answer support for tied top scorers
            createContext('top_scorer')
          );
          
          results.topScorerCorrect = comparisonResult.isMatch;
          comparisonDetails.topScorer = comparisonResult;
          
          logger.info({
            userId,
            question: 'top_scorer',
            userPredictedDbPlayerId: topScorerPrediction.answered_player_id,
            userPredictedApiPlayerId: userPredictedApiPlayerId,
            allValidTopScorerIds: topScorerIds,
            totalTiedPlayers: topScorerIds.length,
            matches: comparisonResult.isMatch,
            matchedPlayerId: comparisonResult.matchedAnswer,
            comparisonStrategy: 'TopScorerExactMatch'
          }, `Top scorer comparison: ${comparisonResult.isMatch ? 'MATCH' : 'NO MATCH'} - ${
            comparisonResult.isMatch 
              ? `User predicted player ${userPredictedApiPlayerId} who is tied for top scorer`
              : `User predicted player ${userPredictedApiPlayerId} but top scorers are: [${topScorerIds.join(', ')}]`
          }`);
        } else {
          logger.warn({
            userId,
            question: 'top_scorer',
            userPredictedDbPlayerId: topScorerPrediction.answered_player_id
          }, 'Could not map user predicted player DB ID to API ID for top scorer comparison');
        }
    }

    // --- Compare Best Goal Difference (Enhanced with Multiple Answer Support) ---
    const bestGDPrediction = findAnswer('best_goal_difference');
    if (bestGDPrediction && bestGoalDifferenceTeamIds.length > 0) {
        // Convert database team ID to API team ID for comparison
        const userPredictedApiTeamId = bestGDPrediction.answered_team_id ? 
          await mapTeamDbIdToApiId(bestGDPrediction.answered_team_id) : null;
        
        if (userPredictedApiTeamId !== null) {
          // Use goal difference strategy for comparison (supports multiple tied teams)
          const comparisonResult = goalDifferenceStrategy.compare(
            userPredictedApiTeamId,
            bestGoalDifferenceTeamIds, // Multiple answer support for tied teams
            createContext('best_goal_difference')
          );
          
          results.bestGoalDifferenceCorrect = comparisonResult.isMatch;
          comparisonDetails.bestGoalDifference = comparisonResult;
          
          logger.info({
            userId,
            question: 'best_goal_difference',
            userPredictedDbTeamId: bestGDPrediction.answered_team_id,
            userPredictedApiTeamId: userPredictedApiTeamId,
            allValidBestGDTeamIds: bestGoalDifferenceTeamIds,
            totalTiedTeams: bestGoalDifferenceTeamIds.length,
            matches: comparisonResult.isMatch,
            matchedTeamId: comparisonResult.matchedAnswer,
            comparisonStrategy: 'GoalDifferenceExactMatch'
          }, `Best goal difference comparison: ${comparisonResult.isMatch ? 'MATCH' : 'NO MATCH'} - ${
            comparisonResult.isMatch 
              ? `User predicted team ${userPredictedApiTeamId} which is tied for best goal difference`
              : `User predicted team ${userPredictedApiTeamId} but best goal difference teams are: [${bestGoalDifferenceTeamIds.join(', ')}]`
          }`);
        } else {
          logger.warn({
            userId,
            question: 'best_goal_difference',
            userPredictedDbTeamId: bestGDPrediction.answered_team_id
          }, 'Could not map user predicted team DB ID to API ID for best goal difference comparison');
        }
    }

    // --- Compare Last Place Team (Enhanced with Strategy Pattern) ---
    const lastPlacePrediction = findAnswer('last_place');
    if (lastPlacePrediction && lastPlaceTeam) {
        // Convert database team ID to API team ID for comparison
        const userPredictedApiTeamId = lastPlacePrediction.answered_team_id ? 
          await mapTeamDbIdToApiId(lastPlacePrediction.answered_team_id) : null;
        
        if (userPredictedApiTeamId !== null) {
          // Use strategy pattern for comparison (single answer for Phase 1)
          const comparisonResult = exactMatchStrategy.compare(
            userPredictedApiTeamId,
            [lastPlaceTeam.team_id], // Single answer wrapped in array for consistency
            createContext('last_place')
          );
          
          results.lastPlaceCorrect = comparisonResult.isMatch;
          comparisonDetails.lastPlace = comparisonResult;
          
          logger.info({
            userId,
            question: 'last_place',
            userPredictedDbTeamId: lastPlacePrediction.answered_team_id,
            userPredictedApiTeamId: userPredictedApiTeamId,
            actualLastPlaceTeamId: lastPlaceTeam.team_id,
            matches: comparisonResult.isMatch,
            comparisonStrategy: 'ExactMatch'
          }, `Last place comparison: ${comparisonResult.isMatch ? 'MATCH' : 'NO MATCH'}`);
        } else {
          logger.warn({
            userId,
            question: 'last_place',
            userPredictedDbTeamId: lastPlacePrediction.answered_team_id
          }, 'Could not map user predicted team DB ID to API ID for last place comparison');
        }
    }

    // 5. Calculate total points (3 points per correct answer) - MAINTAINED EXISTING SCORING
    let totalDynamicPoints = 0;
    if (results.leagueWinnerCorrect) totalDynamicPoints += 3;
    if (results.topScorerCorrect) totalDynamicPoints += 3;
    if (results.bestGoalDifferenceCorrect) totalDynamicPoints += 3;
    if (results.lastPlaceCorrect) totalDynamicPoints += 3;

    // Calculate total processing time for performance monitoring
    const calculationEndTime = performance.now();
    const totalCalculationTimeMs = calculationEndTime - calculationStartTime;

    // Enhanced logging with multiple answer details and performance metrics
    const finalLogData = { 
      userId, 
      totalDynamicPoints, 
      details: results,
      multipleAnswerSummary: {
        topScorerTies: topScorerIds.length,
        goalDifferenceTies: bestGoalDifferenceTeamIds.length,
        hasAnyTies: topScorerIds.length > 1 || bestGoalDifferenceTeamIds.length > 1
      },
      performance: {
        totalCalculationTimeMs: Number(totalCalculationTimeMs.toFixed(3)),
        questionsEvaluated: userPredictions.length,
        answersProcessed: topScorerIds.length + bestGoalDifferenceTeamIds.length + 2, // +2 for single answers
        avgTimePerQuestion: Number((totalCalculationTimeMs / Math.max(userPredictions.length, 1)).toFixed(3))
      }
    };

    const finalLogMessage = `Dynamic points calculation complete using enhanced multiple-answer logic. Total: ${totalDynamicPoints} points. (${totalCalculationTimeMs.toFixed(3)}ms total)`;

    // Log level control based on performance and complexity
    if (totalCalculationTimeMs > 100 || (topScorerIds.length + bestGoalDifferenceTeamIds.length) > 15) {
      // Slow calculations or complex scenarios get info level for monitoring
      logger.info(finalLogData, finalLogMessage);
    } else {
      // Fast, simple calculations get debug level to manage verbosity
      logger.debug(finalLogData, finalLogMessage);
    }

    return {
        totalPoints: totalDynamicPoints,
        details: {
          ...results,
          comparisonDetails: comparisonDetails
        },
    };
  }

  // --- Helper methods for comparisons can be added below ---

} 