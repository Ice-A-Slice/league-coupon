// src/lib/scoring.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { type Database, type Json } from '@/types/supabase'; // Import Database AND Json type
import { LeagueDataServiceImpl, type ILeagueDataService } from './leagueDataService'; // Assuming ILeagueDataService is exported
import { DynamicPointsCalculator } from './dynamicPointsCalculator'; // Remove DynamicPointsResult if unused here
import { getUserSeasonAnswers, type UserSeasonAnswerRow } from './supabase/queries'; // For fetching all answers

type BettingRoundId = number;
type FixtureId = number;
type Prediction = Database['public']['Enums']['prediction_type']; // '1' | 'X' | '2'
type Result = Prediction | null; // Fixtures might not have a result yet, or goals could be null

// Type definitions
// Removed unused type: type UserBet = Tables<'user_bets'>;
// Removed unused type: type Fixture = Tables<'fixtures'>;

// Export the result type
export interface ScoreCalculationResult {
  success: boolean;
  message: string;
  details?: {
    betsProcessed: number;
    betsUpdated: number;
    error?: unknown;
    durationMs?: number; // Add durationMs as optional
  };
}

// Define the structure for bet updates expected by the RPC function
interface BetUpdatePayload {
    bet_id: string; // Use the bet's primary key UUID
    points: number;
}

// Structure for the dynamic points RPC payload
interface DynamicPointsRPCPayloadItem {
    user_id: string;
    total_points: number;
    q1_correct: boolean;
    q2_correct: boolean;
    q3_correct: boolean;
    q4_correct: boolean;
}

// Interface for the return type of processAndStoreDynamicPointsForRound
export interface ProcessDynamicPointsResult {
  success: boolean;
  message: string;
  details?: {
    usersProcessed: number;
    usersUpdated: number;
    error?: unknown;
    durationMs?: number; // Added durationMs
  };
}

// Interface for non-participant scoring result
export interface NonParticipantScoringResult {
  success: boolean;
  message: string;
  details?: {
    nonParticipantsProcessed: number;
    minimumParticipantScore: number | null;
    participantCount: number;
    nonParticipantCount: number;
    error?: unknown;
  };
}

/**
 * Calculates and updates points awarded for user bets within a specific betting round.
 * Assumes the round is confirmed complete and ready for scoring.
 * Implements the basic 1 point for correct, 0 for incorrect 1X2 prediction.
 * Handles idempotency by checking betting_round status and potentially points_awarded.
 *
 * @param bettingRoundId The ID of the betting_round to score.
 * @param client A Supabase client instance (can be server or service role).
 * @returns Promise<ScoreCalculationResult> An object indicating success or failure.
 */
export async function calculateAndStoreMatchPoints(
  bettingRoundId: BettingRoundId,
  client: SupabaseClient<Database> 
): Promise<ScoreCalculationResult> {
  logger.info({ bettingRoundId }, `Starting score calculation.`);
  const startTime = Date.now(); // For performance monitoring
  let betsProcessed = 0;
  
  try {
    // Step 1: Fetch round data (status is implicitly checked by the calling process)
    // Removed initial status check and redundant update to 'scoring'
    // The detector service should have already marked the round as 'scoring'
    // if it was ready.
    /*
    // Step 1: Check idempotency & set status to 'scoring'
    const { data: roundData, error: fetchError } = await client // Use passed-in client
      .from('betting_rounds')
      .select('status')
      .eq('id', bettingRoundId)
      .single();

    if (fetchError) {
      logger.error({ bettingRoundId, error: fetchError }, "Failed to fetch betting round status.");
      return { success: false, message: "Failed to fetch betting round status.", details: { betsProcessed: 0, betsUpdated: 0, error: fetchError } };
    }

    if (!roundData) {
       logger.warn({ bettingRoundId }, "Betting round not found during scoring attempt.");
       return { success: false, message: `Betting round with ID ${bettingRoundId} not found.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    if (roundData.status === 'scored' || roundData.status === 'scoring') {
      logger.info({ bettingRoundId, status: roundData.status }, `Scoring skipped: Round already ${roundData.status}.`);
      return { success: true, message: `Scoring skipped: Round already ${roundData.status}.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    // Attempt to set status to 'scoring'
    const { error: updateStatusError } = await client // Use passed-in client
      .from('betting_rounds')
      .update({ status: 'scoring', updated_at: new Date().toISOString() }) // Also update updated_at
      .eq('id', bettingRoundId)
      // Optionally add a condition to ensure we only update if status hasn't changed concurrently
      // .eq('status', roundData.status) // Uncomment if high concurrency is expected
      .select() // Required by Supabase update to return data/error
      .single(); // We expect to update one row

    if (updateStatusError) {
        if (updateStatusError.code === 'PGRST116') { 
             logger.warn({ bettingRoundId }, `Could not set status to 'scoring', likely already processed concurrently.`);
             return { success: true, message: "Scoring likely handled by concurrent process.", details: { betsProcessed: 0, betsUpdated: 0 }};
        }
        logger.error({ bettingRoundId, error: updateStatusError }, "Failed to set betting round status to 'scoring'.");
        return { success: false, message: "Failed to set betting round status to 'scoring'.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
    }

    logger.info({ bettingRoundId }, `Betting round status set to 'scoring'. Proceeding...`);
    */
    // --- End of removed block ---
    
    // 2. Fetch Fixture IDs associated with the betting round
    const { data: fixtureLinks, error: linkError } = await client // Use passed-in client
      .from('betting_round_fixtures')
      .select('fixture_id')
      .eq('betting_round_id', bettingRoundId);

    if (linkError) {
      logger.error({ bettingRoundId, error: linkError }, "Failed to fetch associated fixtures.");
      return { success: false, message: "Failed to fetch associated fixtures.", details: { betsProcessed: 0, betsUpdated: 0, error: linkError } };
    }

    if (!fixtureLinks || fixtureLinks.length === 0) {
      logger.warn({ bettingRoundId }, `No fixtures found linked to betting round. Marking as scored.`);
      // If there are no fixtures, there's nothing to score. Mark as done.
      const { error: updateStatusError } = await client // Use passed-in client
        .from('betting_rounds')
        .update({ status: 'scored', scored_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', bettingRoundId);
        
      if (updateStatusError) {
           logger.error({ bettingRoundId, error: updateStatusError }, "Failed to mark empty betting round as scored.");
           return { success: false, message: "Failed to mark empty round as scored.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
      }
      return { success: true, message: "No fixtures linked to this round; marked as scored.", details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    const fixtureIds = fixtureLinks.map(link => link.fixture_id);
    logger.info({ bettingRoundId, fixtureCount: fixtureIds.length }, `Found ${fixtureIds.length} fixtures.`);
    
    // 3. Fetch final results for these fixtures
    const { data: fixturesData, error: fixturesError } = await client // Use passed-in client
      .from('fixtures')
      .select('id, home_goals, away_goals, status_short, result') // Select result too for direct comparison
      .in('id', fixtureIds); // Use the array of IDs from Step 2

    if (fixturesError) {
      logger.error({ bettingRoundId, fixtureIds, error: fixturesError }, "Failed to fetch fixture details.");
      return { success: false, message: "Failed to fetch fixture details.", details: { betsProcessed: 0, betsUpdated: 0, error: fixturesError } };
    }

    // Filter out fixtures that are not finished and create a map for easy lookup
    const finishedFixtureResults = new Map<FixtureId, { result: Result }>();
    const finishedStatuses = ['FT', 'AET', 'PEN']; // Add other finished statuses as needed
    let allFixturesFinished = true;

    for (const fixture of fixturesData || []) {
      if (finishedStatuses.includes(fixture.status_short)) {
          // Use pre-calculated result if available and seems valid, otherwise calculate from goals
          let finalResult: Result = null;
          if (fixture.result && ['1', 'X', '2'].includes(fixture.result)) {
              finalResult = fixture.result as Result;
          } else {
              // Fallback to calculating from goals if result column is missing/invalid
              finalResult = getResultFromGoals(fixture.home_goals, fixture.away_goals);
          }

          if(finalResult) { // Only add if we have a valid result (1, X, or 2)
              finishedFixtureResults.set(fixture.id, { result: finalResult });
          } else {
              logger.warn({ bettingRoundId, fixtureId: fixture.id, status: fixture.status_short }, `Fixture has finished status but null/invalid goals/result. Cannot score.`);
              allFixturesFinished = false; // Treat as not finished if result can't be determined
          }
      } else {
        allFixturesFinished = false; // Mark as not all finished if any fixture isn't in a finished state
      }
    }

    // If not all fixtures linked to the round are finished, we cannot score the round yet.
    if (!allFixturesFinished || finishedFixtureResults.size !== fixtureIds.length) {
        const missingCount = fixtureIds.length - finishedFixtureResults.size;
        logger.info({ bettingRoundId, totalFixtures: fixtureIds.length, finishedFixtures: finishedFixtureResults.size, missingCount }, `Scoring deferred: Not all fixtures finished or have valid results.`);
        return { success: true, message: `Scoring deferred: Not all fixtures finished or have valid results.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }
    
    logger.info({ bettingRoundId, count: finishedFixtureResults.size }, `Results fetched for finished fixtures.`);

    // 4. Fetch all user bets for this betting round
    const { data: userBets, error: betsError } = await client // Use passed-in client
      .from('user_bets')
      .select('id, user_id, fixture_id, prediction, points_awarded')
      .eq('betting_round_id', bettingRoundId);

    if (betsError) {
      logger.error({ bettingRoundId, error: betsError }, "Failed to fetch user bets.");
      return { success: false, message: "Failed to fetch user bets.", details: { betsProcessed: 0, betsUpdated: 0, error: betsError } };
    }

    if (!userBets || userBets.length === 0) {
      logger.info({ bettingRoundId }, `No user bets found for betting round. Marking as scored.`);
      // If there are no bets, we can mark the round as scored immediately.
      const { error: updateStatusError } = await client // Use passed-in client
        .from('betting_rounds')
        .update({ status: 'scored', scored_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', bettingRoundId);
        
      if (updateStatusError) {
           logger.error({ bettingRoundId, error: updateStatusError }, "Failed to mark no-bets round as scored.");
           return { success: false, message: "Failed to mark no-bets round as scored.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
      }
      return { success: true, message: "No user bets for this round; marked as scored.", details: { betsProcessed: 0, betsUpdated: 0 } };
    }
    
    logger.info({ bettingRoundId, count: userBets.length }, `Fetched user bets.`);

    // 5. Calculate Points & Prepare Payload for RPC
    const betUpdatesForRPC: BetUpdatePayload[] = []; // Changed variable name and type

    for (const bet of userBets) {
        betsProcessed++;
        
        // Skip if points already awarded (idempotency)
        if (bet.points_awarded !== null) {
            continue; 
        }

        const fixtureResult = finishedFixtureResults.get(bet.fixture_id);

        if (!fixtureResult || !fixtureResult.result) {
            logger.warn({ bettingRoundId, betId: bet.id, fixtureId: bet.fixture_id }, `Skipping bet scoring: Missing or invalid final result for fixture.`);
            continue; 
        }

        // Calculate points (1 for correct, 0 for incorrect)
        const points = bet.prediction === fixtureResult.result ? 1 : 0;

        // Add to our list of updates for the RPC function
        betUpdatesForRPC.push({
            bet_id: bet.id, // Use the bet's primary key
            points: points
        });
    }
    
    logger.info({ bettingRoundId, calculatedCount: betUpdatesForRPC.length, totalBets: betsProcessed }, `Calculated scores for bets.`);

    // 6. Call the RPC function to update bets and round status transactionally
    if (betUpdatesForRPC.length > 0) {
        logger.info({ bettingRoundId, count: betUpdatesForRPC.length }, `Calling handle_round_scoring function...`);
        
        const { error: rpcError } = await client.rpc('handle_round_scoring', {
            p_betting_round_id: bettingRoundId,
            p_bet_updates: betUpdatesForRPC as unknown as Json 
        });

        if (rpcError) {
            logger.error({ bettingRoundId, error: rpcError }, "Error calling handle_round_scoring function.");
            return { 
                success: false, 
                message: "Failed to store scores transactionally via RPC function.",
                details: { betsProcessed: betsProcessed, betsUpdated: 0, error: rpcError } 
            };
        }
        logger.info({ bettingRoundId, count: betUpdatesForRPC.length }, `Successfully called handle_round_scoring function.`);
      
    } else {
        // If no bets required scoring (e.g., all were already scored, or round had no bets initially)
        // We still need to ensure the round is marked as 'scored' if it reached this point.
        // Note: Cases with no links or no bets are handled earlier and return before this.
        // This case primarily handles rounds where all bets were *already* scored previously.
        logger.info({ bettingRoundId }, `No new bets required scoring. Ensuring round status is 'scored'.`);
        const { error: finalStatusError } = await client
            .from('betting_rounds')
            .update({ status: 'scored', scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }) // Also update updated_at
            .eq('id', bettingRoundId)
            .not('status', 'eq', 'scored'); 

        if (finalStatusError) {
            logger.error({ bettingRoundId, error: finalStatusError }, "Failed to mark round as scored (no updates needed case)." );
            return { 
                success: false, 
                message: "No points needed storing, but failed to mark round as fully scored.", 
                details: { betsProcessed: betsProcessed, betsUpdated: 0, error: finalStatusError } 
            };
        }
        logger.info({ bettingRoundId }, `Round status confirmed/updated to 'scored' (no new bet updates).`);
    }

    // --- ADDED: Process Dynamic Points AFTER match points are successfully stored/handled ---
    logger.info({ bettingRoundId }, "Proceeding to process dynamic points for the round.");
    // We need a LeagueDataService instance. For now, let's instantiate it here.
    // In a more complex setup, this might be injected or retrieved from a DI container.
    const leagueDataService = new LeagueDataServiceImpl(); 
    const dynamicPointsProcessingResult = await processAndStoreDynamicPointsForRound(
        bettingRoundId,
        client,
        leagueDataService
    );

    if (!dynamicPointsProcessingResult.success) {
        // Log the error from dynamic points processing, but the primary match scoring might have succeeded.
        // Decide on overall success status. For now, if match points succeeded but dynamic failed,
        // we might still consider the overall operation as partially successful or needing attention.
        logger.warn({ 
            bettingRoundId, 
            dynamicPointsMessage: dynamicPointsProcessingResult.message, 
            dynamicPointsError: dynamicPointsProcessingResult.details?.error 
        }, "Dynamic points processing failed after match points were handled.");
        // Return a modified success message or status if needed.
        // For simplicity, let's assume if this fails, the overall round scoring needs review.
        return { 
            success: false, 
            message: `Match points stored, but dynamic points processing failed: ${dynamicPointsProcessingResult.message}`,
            details: { 
                betsProcessed: betsProcessed, 
                betsUpdated: betUpdatesForRPC.length, 
                durationMs: Date.now() - startTime, 
                error: dynamicPointsProcessingResult.details?.error
            }
        };
    }
    logger.info({ bettingRoundId }, "Dynamic points processing completed for the round.");
    // --- END ADDED SECTION ---

    // --- NEW: Apply non-participant scoring rule ---
    logger.info({ bettingRoundId }, "Applying non-participant scoring rule...");
    const nonParticipantResult = await applyNonParticipantScoringRule(bettingRoundId, client);
    if (!nonParticipantResult.success) {
        logger.warn({ 
            bettingRoundId, 
            message: nonParticipantResult.message, 
            error: nonParticipantResult.details?.error 
        }, "Non-participant scoring rule failed, but main scoring succeeded.");
        // Continue with success since main scoring worked
    } else {
        logger.info({ bettingRoundId, details: nonParticipantResult.details }, nonParticipantResult.message);
    }
    // --- END NEW SECTION ---

    // 7. Final success result (now indicates both match and dynamic points were attempted)
    const duration = Date.now() - startTime;
    logger.info({ bettingRoundId, durationMs: duration }, `Scoring completed successfully (match and dynamic).`);
    return {
      success: true,
      message: "Scoring completed successfully (match and dynamic points processed).",
      details: { 
          betsProcessed: betsProcessed, 
          betsUpdated: betUpdatesForRPC.length, 
          durationMs: duration 
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ bettingRoundId, durationMs: duration, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 
                 `Unexpected error during score calculation.`);
    
    // Attempt to reset status back to 'closed' if it was set to 'scoring'?
    // Consider adding this later if needed.

    return {
      success: false,
      message: "An unexpected error occurred during scoring.",
        details: { betsProcessed: betsProcessed, betsUpdated: 0, durationMs: duration, error: error instanceof Error ? error : new Error(String(error)) } 
    };
  }
}

/**
 * Processes and stores dynamic questionnaire points for all relevant users for a given round.
 *
 * @param roundId The ID of the betting_round to process dynamic points for.
 * @param client A Supabase client instance.
 * @param leagueDataServiceInstance An instance of ILeagueDataService to fetch live league data.
 *                                    If not provided, a new one will be instantiated.
 */
export async function processAndStoreDynamicPointsForRound(
  roundId: number,
  client: SupabaseClient<Database>,
  leagueDataServiceInstance?: ILeagueDataService // Optional: allow passing an existing instance
): Promise<ProcessDynamicPointsResult> {
  logger.info({ roundId }, `Starting dynamic points processing for round.`);
  const overallStartTime = Date.now();
  let usersProcessed = 0;
  let usersSuccessfullyUpdated = 0;

  try {
    // 1. Fetch the season_id and competition_id by traversing from the betting round to a fixture,
    // to its round, and finally to its season.
    const { data: roundLink, error: roundLinkError } = await client
      .from('betting_round_fixtures')
      .select(`
        fixtures (
          rounds (
            season_id,
            seasons (
              competition_id
            )
          )
        )
      `)
      .eq('betting_round_id', roundId)
      .limit(1) // We only need one fixture to find the season link
      .single();

    if (roundLinkError) {
      logger.error({ roundId, error: roundLinkError }, 'Failed to fetch round-fixture link for dynamic points processing.');
      return { success: false, message: 'Failed to fetch round-fixture link.', details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, error: roundLinkError } };
    }

    // Safely access the nested data
    const seasonId = roundLink?.fixtures?.rounds?.season_id;
    const competitionId = roundLink?.fixtures?.rounds?.seasons?.competition_id;

    if (!seasonId || !competitionId) {
      logger.error({ roundId }, 'Could not determine seasonId or competitionId from betting round.');
      return { success: false, message: 'Could not determine season or competition from round.', details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated } };
    }

    // 2. Fetch competition and season API identifiers
    const { data: competitionData, error: competitionError } = await client
      .from('competitions')
      .select('api_league_id')
      .eq('id', competitionId)
      .single();

    if (competitionError || !competitionData) {
      logger.error({ roundId, competitionId, error: competitionError }, 'Failed to fetch competition API ID.');
      return { success: false, message: 'Failed to fetch competition API ID.', details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, error: competitionError } };
    }
    const competitionApiId = competitionData.api_league_id;

    const { data: seasonData, error: seasonError } = await client
      .from('seasons')
      .select('api_season_year')
      .eq('id', seasonId)
      .single();

    if (seasonError || !seasonData) {
      logger.error({ roundId, seasonId, error: seasonError }, 'Failed to fetch season API year.');
      return { success: false, message: 'Failed to fetch season API year.', details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, error: seasonError } };
    }
    const seasonYear = seasonData.api_season_year;
    logger.info({ roundId, seasonId, competitionApiId, seasonYear }, 'Fetched necessary IDs for dynamic points calculation.');

    // 3. Fetch all user season answers for this season
    const userSeasonAnswers = await getUserSeasonAnswers(seasonId, client); // Pass client to the query

    if (userSeasonAnswers === null) { // getUserSeasonAnswers returns null on error
      logger.error({ roundId, seasonId }, 'Failed to fetch user season answers for dynamic points calculation.');
      return { success: false, message: 'Failed to fetch user season answers.', details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated } };
    }

    if (userSeasonAnswers.length === 0) {
      logger.info({ roundId, seasonId }, 'No user season answers found for this season. No dynamic points to process.');
      return { success: true, message: 'No user season answers to process.', details: { usersProcessed: 0, usersUpdated: 0 } };
    }

    // Group answers by user_id (not strictly necessary here as calculator takes userId, but good for overview)
    const answersByUser: Record<string, UserSeasonAnswerRow[]> = {};
    for (const answer of userSeasonAnswers) {
      if (!answersByUser[answer.user_id]) {
        answersByUser[answer.user_id] = [];
      }
      answersByUser[answer.user_id].push(answer);
    }
    const uniqueUserIds = Object.keys(answersByUser);
    logger.info({ roundId, seasonId, userCount: uniqueUserIds.length }, `Found season answers for ${uniqueUserIds.length} users.`);

    // 4. Instantiate services
    const lds = leagueDataServiceInstance || new LeagueDataServiceImpl();
    const pointsCalculator = new DynamicPointsCalculator(lds);
    const payloadForRPC: DynamicPointsRPCPayloadItem[] = []; // Specify a more precise type later if possible

    // 5. Iterate, Calculate, and Prepare RPC payload
    // Track aggregate statistics for multiple correct answers detection
    const aggregateStats = {
        usersWithMultipleAnswerPoints: 0,
        totalTieScenarios: 0,
        questionTypeStats: {
            topScorer: { usersWithTies: 0, totalTieInstances: 0 },
            goalDifference: { usersWithTies: 0, totalTieInstances: 0 },
            leagueWinner: { usersWithTies: 0, totalTieInstances: 0 },
            lastPlace: { usersWithTies: 0, totalTieInstances: 0 }
        }
    };

    for (const userId of uniqueUserIds) {
        usersProcessed++;
        logger.debug({ roundId, userId }, 'Calculating dynamic points for user.');
        
        // Get the specific answers for this user
        const currentUserAnswers = answersByUser[userId] || []; 
        
        if (currentUserAnswers.length === 0) {
            logger.warn({ roundId, userId }, "User ID found but no answers associated? Skipping calculation for this user.");
            continue; // Skip if somehow answers are missing for this user ID
        }
        
        const dynamicPointsResult = await pointsCalculator.calculateDynamicPoints(
            userId,
            competitionApiId,
            seasonYear,
            currentUserAnswers // Pass the pre-fetched answers for this user
        );

        if (dynamicPointsResult) {
            // Enhanced logging to track which specific answers triggered points and multiple correct answers
            const pointsBreakdown = {
                leagueWinner: dynamicPointsResult.details.leagueWinnerCorrect ? 3 : 0,
                topScorer: dynamicPointsResult.details.topScorerCorrect ? 3 : 0,
                bestGoalDifference: dynamicPointsResult.details.bestGoalDifferenceCorrect ? 3 : 0,
                lastPlace: dynamicPointsResult.details.lastPlaceCorrect ? 3 : 0,
            };
            
            // Track which questions earned points
            const questionsEarningPoints = [];
            if (dynamicPointsResult.details.leagueWinnerCorrect) questionsEarningPoints.push('league_winner');
            if (dynamicPointsResult.details.topScorerCorrect) questionsEarningPoints.push('top_scorer'); 
            if (dynamicPointsResult.details.bestGoalDifferenceCorrect) questionsEarningPoints.push('best_goal_difference');
            if (dynamicPointsResult.details.lastPlaceCorrect) questionsEarningPoints.push('last_place');

            // Enhanced: Extract multiple correct answers information from comparison details
            const multipleAnswersDetected = {
                topScorer: (dynamicPointsResult.details.comparisonDetails?.topScorer?.allValidAnswers?.length || 0) > 1,
                goalDifference: (dynamicPointsResult.details.comparisonDetails?.bestGoalDifference?.allValidAnswers?.length || 0) > 1,
                leagueWinner: (dynamicPointsResult.details.comparisonDetails?.leagueWinner?.allValidAnswers?.length || 0) > 1,
                lastPlace: (dynamicPointsResult.details.comparisonDetails?.lastPlace?.allValidAnswers?.length || 0) > 1
            };

            // Track which specific answers triggered points
            const triggeredAnswers: Record<string, number[]> = {};
            if (dynamicPointsResult.details.comparisonDetails?.leagueWinner?.isMatch) {
                triggeredAnswers.leagueWinner = dynamicPointsResult.details.comparisonDetails.leagueWinner.allValidAnswers;
            }
            if (dynamicPointsResult.details.comparisonDetails?.topScorer?.isMatch) {
                triggeredAnswers.topScorer = dynamicPointsResult.details.comparisonDetails.topScorer.allValidAnswers;
            }
            if (dynamicPointsResult.details.comparisonDetails?.bestGoalDifference?.isMatch) {
                triggeredAnswers.bestGoalDifference = dynamicPointsResult.details.comparisonDetails.bestGoalDifference.allValidAnswers;
            }
            if (dynamicPointsResult.details.comparisonDetails?.lastPlace?.isMatch) {
                triggeredAnswers.lastPlace = dynamicPointsResult.details.comparisonDetails.lastPlace.allValidAnswers;
            }

            // Log detailed scoring information for this user
            logger.info({ 
                roundId, 
                userId, 
                totalPoints: dynamicPointsResult.totalPoints,
                pointsBreakdown,
                questionsEarningPoints,
                questionCount: questionsEarningPoints.length,
                // Enhanced: Track multiple correct answers detection
                multipleAnswersDetected,
                // Track which specific answers triggered points  
                triggeredAnswers,
                // Count total tied scenarios detected
                totalTieScenarios: Object.values(multipleAnswersDetected).filter(Boolean).length
            }, `Dynamic points calculated - earned ${dynamicPointsResult.totalPoints} points from ${questionsEarningPoints.length} questions${Object.values(multipleAnswersDetected).some(Boolean) ? ' (multiple answers detected)' : ''}`);

            // Track aggregate statistics
            const userHadTieScenarios = Object.values(multipleAnswersDetected).some(Boolean);
            if (userHadTieScenarios) {
                aggregateStats.usersWithMultipleAnswerPoints++;
            }
            
            // Track by question type
            if (multipleAnswersDetected.topScorer) {
                aggregateStats.questionTypeStats.topScorer.usersWithTies++;
                aggregateStats.questionTypeStats.topScorer.totalTieInstances++;
                aggregateStats.totalTieScenarios++;
            }
            if (multipleAnswersDetected.goalDifference) {
                aggregateStats.questionTypeStats.goalDifference.usersWithTies++;
                aggregateStats.questionTypeStats.goalDifference.totalTieInstances++;
                aggregateStats.totalTieScenarios++;
            }
            if (multipleAnswersDetected.leagueWinner) {
                aggregateStats.questionTypeStats.leagueWinner.usersWithTies++;
                aggregateStats.questionTypeStats.leagueWinner.totalTieInstances++;
                aggregateStats.totalTieScenarios++;
            }
            if (multipleAnswersDetected.lastPlace) {
                aggregateStats.questionTypeStats.lastPlace.usersWithTies++;
                aggregateStats.questionTypeStats.lastPlace.totalTieInstances++;
                aggregateStats.totalTieScenarios++;
            }

            payloadForRPC.push({
                user_id: userId,
                total_points: dynamicPointsResult.totalPoints,
                q1_correct: dynamicPointsResult.details.leagueWinnerCorrect,
                q2_correct: dynamicPointsResult.details.topScorerCorrect,
                q3_correct: dynamicPointsResult.details.bestGoalDifferenceCorrect,
                q4_correct: dynamicPointsResult.details.lastPlaceCorrect,
            });
        } else {
            logger.warn({ roundId, userId }, 'Dynamic points calculation returned null for user. Skipping RPC update for this user.');
        }
    }

    // 6. Call RPC if there's data to update
    if (payloadForRPC.length > 0) {
        logger.info({ roundId, count: payloadForRPC.length }, `Calling handle_dynamic_points_update RPC function...`);
        const { error: rpcError } = await client.rpc('handle_dynamic_points_update', {
            p_round_id: roundId,
            p_dynamic_point_updates: payloadForRPC as unknown as Json,
        });

        if (rpcError) {
            logger.error({ roundId, error: rpcError }, 'Error calling handle_dynamic_points_update RPC.');
            return { 
                success: false, 
                message: 'Failed to store dynamic points transactionally via RPC.',
                details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, error: rpcError }
            };
        }
        usersSuccessfullyUpdated = payloadForRPC.length;
        logger.info({ roundId, count: usersSuccessfullyUpdated }, `Successfully stored/updated dynamic points for users.`);
    } else {
        logger.info({ roundId }, 'No dynamic points data to send to RPC. All users might have had calculation errors or no users with answers.');
    }

    const duration = Date.now() - overallStartTime;
    
    // Enhanced: Log aggregate multiple correct answers statistics for the round
    logger.info({ 
        roundId, 
        durationMs: duration, 
        usersProcessed, 
        usersUpdated: usersSuccessfullyUpdated,
        // Multiple answers aggregate stats
        multipleAnswersStats: {
            ...aggregateStats,
            percentageUsersWithTies: usersProcessed > 0 ? Math.round((aggregateStats.usersWithMultipleAnswerPoints / usersProcessed) * 100) : 0
        }
    }, `Dynamic points processing completed${aggregateStats.totalTieScenarios > 0 ? ` - detected ${aggregateStats.totalTieScenarios} tie scenarios across ${aggregateStats.usersWithMultipleAnswerPoints} users` : ''}.`);
    
    return {
        success: true,
        message: 'Dynamic points processing completed.',
        details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, durationMs: duration }
    };

  } catch (error) {
    const duration = Date.now() - overallStartTime;
    logger.error(
        { roundId, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, durationMs: duration },
        'Unexpected error during dynamic points processing.'
    );
    return {
        success: false,
        message: 'An unexpected error occurred during dynamic points processing.',
        details: { usersProcessed, usersUpdated: usersSuccessfullyUpdated, durationMs: duration, error: error instanceof Error ? error : new Error(String(error)) }
    };
  }
}

/**
 * Applies the non-participant scoring rule:
 * Users who didn't submit any bets for a round get the same points as the lowest-scoring participant.
 * 
 * @param bettingRoundId The ID of the betting round to apply the rule to
 * @param client A Supabase client instance
 * @returns Promise<NonParticipantScoringResult> Result of the operation
 */
export async function applyNonParticipantScoringRule(
  bettingRoundId: BettingRoundId,
  client: SupabaseClient<Database>
): Promise<NonParticipantScoringResult> {
  try {
    // 1. Get all users who participated in this round (have at least one bet)
    const { data: participantData, error: participantError } = await client
      .from('user_bets')
      .select('user_id')
      .eq('betting_round_id', bettingRoundId);

    if (participantError) {
      logger.error({ bettingRoundId, error: participantError }, "Failed to fetch participants for non-participant scoring");
      return { 
        success: false, 
        message: "Failed to fetch participants", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: null, participantCount: 0, nonParticipantCount: 0, error: participantError } 
      };
    }

    // Get unique participant user IDs
    const participantUserIds = new Set(participantData?.map(bet => bet.user_id) || []);
    
    if (participantUserIds.size === 0) {
      logger.info({ bettingRoundId }, "No participants found - everyone gets 0 points by default");
      return { 
        success: true, 
        message: "No participants found - no non-participant scoring needed", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: null, participantCount: 0, nonParticipantCount: 0 } 
      };
    }

    // 2. Calculate the minimum score among participants
    // Get all user points for this round by summing their individual bet points
    const { data: userPointsData, error: userPointsError } = await client
      .from('user_bets')
      .select('user_id, points_awarded')
      .eq('betting_round_id', bettingRoundId)
      .not('points_awarded', 'is', null);

    if (userPointsError) {
      logger.error({ bettingRoundId, error: userPointsError }, "Failed to fetch user points for minimum calculation");
      return { 
        success: false, 
        message: "Failed to fetch user points", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: null, participantCount: participantUserIds.size, nonParticipantCount: 0, error: userPointsError } 
      };
    }

    // Sum points by user
    const userPointTotals = new Map<string, number>();
    (userPointsData || []).forEach(bet => {
      const currentTotal = userPointTotals.get(bet.user_id) || 0;
      userPointTotals.set(bet.user_id, currentTotal + (bet.points_awarded || 0));
    });

    if (userPointTotals.size === 0) {
      logger.info({ bettingRoundId }, "No scored bets found yet - non-participant scoring skipped");
      return { 
        success: true, 
        message: "No scored bets found yet - non-participant scoring skipped", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: null, participantCount: participantUserIds.size, nonParticipantCount: 0 } 
      };
    }

    // Find minimum score among participants
    const minimumScore = Math.min(...Array.from(userPointTotals.values()));
    logger.info({ bettingRoundId, minimumScore, participantCount: userPointTotals.size }, "Found minimum participant score");

    // 3. Get all users in the system
    const { data: allUsersData, error: allUsersError } = await client
      .from('profiles')
      .select('id');

    if (allUsersError) {
      logger.error({ bettingRoundId, error: allUsersError }, "Failed to fetch all users for non-participant scoring");
      return { 
        success: false, 
        message: "Failed to fetch all users", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: minimumScore, participantCount: participantUserIds.size, nonParticipantCount: 0, error: allUsersError } 
      };
    }

    // 4. Identify non-participants
    const allUserIds = new Set(allUsersData?.map(user => user.id) || []);
    const nonParticipantUserIds = Array.from(allUserIds).filter(userId => !participantUserIds.has(userId));

    if (nonParticipantUserIds.length === 0) {
      logger.info({ bettingRoundId }, "All users participated - no non-participant scoring needed");
      return { 
        success: true, 
        message: "All users participated - no non-participant scoring needed", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: minimumScore, participantCount: participantUserIds.size, nonParticipantCount: 0 } 
      };
    }

    // 5. Create "virtual" bets for non-participants with the minimum score
    // We'll need to get the fixtures for this round to create appropriate bet records
    const { data: roundFixtures, error: roundFixturesError } = await client
      .from('betting_round_fixtures')
      .select('fixture_id')
      .eq('betting_round_id', bettingRoundId);

    if (roundFixturesError || !roundFixtures || roundFixtures.length === 0) {
      logger.error({ bettingRoundId, error: roundFixturesError }, "Failed to fetch round fixtures for non-participant bets");
      return { 
        success: false, 
        message: "Failed to fetch round fixtures", 
        details: { nonParticipantsProcessed: 0, minimumParticipantScore: minimumScore, participantCount: participantUserIds.size, nonParticipantCount: nonParticipantUserIds.length, error: roundFixturesError } 
      };
    }

    // For each non-participant, create bet records with points that sum to minimumScore
    // We'll distribute the points across fixtures (giving 1 point to the first fixtures until we reach minimumScore)
    const fixtureIds = roundFixtures.map(rf => rf.fixture_id);
    const pointsPerFixture = Math.min(1, minimumScore); // Each bet can only give 0 or 1 point max
    const fixturesToScore = Math.min(minimumScore, fixtureIds.length); // How many fixtures need to give 1 point

    let nonParticipantsProcessed = 0;
    
    for (const userId of nonParticipantUserIds) {
      // Create bet records for this non-participant
      const betsToInsert = fixtureIds.map((fixtureId, index) => ({
        user_id: userId,
        fixture_id: fixtureId,
        betting_round_id: bettingRoundId,
        prediction: '1' as const, // Dummy prediction (doesn't matter since points are pre-set)
        points_awarded: index < fixturesToScore ? pointsPerFixture : 0, // Give points to first N fixtures
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await client
        .from('user_bets')
        .insert(betsToInsert);

      if (insertError) {
        logger.error({ bettingRoundId, userId, error: insertError }, "Failed to insert non-participant bets");
        // Continue with other users
        continue;
      }

      nonParticipantsProcessed++;
      logger.debug({ bettingRoundId, userId, pointsAwarded: minimumScore }, "Created non-participant bets");
    }

    logger.info({ 
      bettingRoundId, 
      nonParticipantsProcessed, 
      minimumScore, 
      participantCount: participantUserIds.size,
      nonParticipantCount: nonParticipantUserIds.length 
    }, "Non-participant scoring rule applied successfully");

    return {
      success: true,
      message: `Non-participant scoring completed: ${nonParticipantsProcessed} users given ${minimumScore} points`,
      details: { 
        nonParticipantsProcessed, 
        minimumParticipantScore: minimumScore, 
        participantCount: participantUserIds.size,
        nonParticipantCount: nonParticipantUserIds.length 
      }
    };

  } catch (error) {
    logger.error({ bettingRoundId, error: error instanceof Error ? error.message : String(error) }, "Unexpected error in non-participant scoring");
    return {
      success: false,
      message: "Unexpected error in non-participant scoring",
      details: { nonParticipantsProcessed: 0, minimumParticipantScore: null, participantCount: 0, nonParticipantCount: 0, error: error instanceof Error ? error : new Error(String(error)) }
    };
  }
}

/**
 * Helper function to determine the result (1, X, 2) from home and away goals.
 * @param home Home team goals (can be null if match not finished)
 * @param away Away team goals (can be null if match not finished)  
 * @returns Result as '1', 'X', '2', or null if cannot be determined
 */
function getResultFromGoals(home: number | null, away: number | null): Result {
    if (home === null || away === null) return null;
    if (home > away) return '1';
    if (home < away) return '2';
    return 'X';
} 