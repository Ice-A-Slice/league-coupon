// src/lib/scoring.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { Database, Json } from '@/types/supabase'; // Import Database AND Json type

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
            p_bet_updates: betUpdatesForRPC as unknown as Json // Use two-step cast
        });

        if (rpcError) {
            logger.error({ bettingRoundId, error: rpcError }, "Error calling handle_round_scoring function.");
            // Attempt to reset status back to 'closed'? Maybe too complex, just log and return error.
            // Note: The transaction within the RPC function should have rolled back.
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
             .update({ status: 'scored', scored_at: new Date().toISOString() })
             .eq('id', bettingRoundId)
             .not('status', 'eq', 'scored'); // Only update if not already scored

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

    // 7. Final success result
    const duration = Date.now() - startTime;
    logger.info({ bettingRoundId, durationMs: duration }, `Scoring completed successfully.`);
    return {
      success: true,
      message: "Scoring completed successfully.",
      details: { 
          betsProcessed: betsProcessed, 
          betsUpdated: betUpdatesForRPC.length, // Number of bets sent to RPC
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

// Helper function (can be defined here or imported)
function getResultFromGoals(home: number | null, away: number | null): Result {
    if (home === null || away === null) return null;
    if (home > away) return '1';
    if (home < away) return '2';
    return 'X';
} 