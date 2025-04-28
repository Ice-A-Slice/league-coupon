// src/lib/scoring.ts

import { type SupabaseClient } from '@supabase/supabase-js'; // Import the type
import type { Database } from '@/types/supabase';
import { logger } from '@/utils/logger'; // Import the logger

type BettingRoundId = number;
type FixtureId = number;
type Prediction = Database['public']['Enums']['prediction_type']; // '1' | 'X' | '2'
type Result = Prediction | null; // Fixtures might not have a result yet, or goals could be null

interface ScoreCalculationResult {
  success: boolean;
  message: string;
  details?: {
    betsProcessed: number;
    betsUpdated: number;
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
  client: SupabaseClient<Database> // Add client parameter
): Promise<ScoreCalculationResult> {
  logger.info({ bettingRoundId }, `Starting score calculation.`);
  
  try {
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

    // 5. Calculate Points & 6. Prepare Updates
    const betsToUpdate: { id: string; points_awarded: number }[] = [];
    let betsProcessed = 0;

    for (const bet of userBets) {
        betsProcessed++;
        
        // Skip if points already awarded (idempotency)
        if (bet.points_awarded !== null) {
            continue; 
        }

        const fixtureResult = finishedFixtureResults.get(bet.fixture_id);

        // This check should technically be unnecessary because of the earlier check in Step 3,
        // but it's good defensive programming.
        if (!fixtureResult || !fixtureResult.result) {
            logger.warn({ bettingRoundId, betId: bet.id, fixtureId: bet.fixture_id }, `Skipping bet scoring: Missing or invalid final result for fixture.`);
            continue; 
        }

        // Calculate points (1 for correct, 0 for incorrect)
        const points = bet.prediction === fixtureResult.result ? 1 : 0;

        // Add to our list of updates needed
        betsToUpdate.push({
            id: bet.id, // The primary key of the user_bets row
            points_awarded: points
        });
    }
    
    logger.info({ bettingRoundId, calculatedCount: betsToUpdate.length, totalBets: betsProcessed }, `Calculated scores for bets.`);

    // 7. Update user_bets table with calculated points
    if (betsToUpdate.length > 0) {
      logger.info({ bettingRoundId, count: betsToUpdate.length }, `Updating points for bets...`);
      
      let updateErrorOccurred = false;
      let firstUpdateError: unknown = null;

      // Iterate and update each bet individually
      for (const betUpdate of betsToUpdate) {
        const { error: individualUpdateError } = await client
          .from('user_bets')
          .update({ points_awarded: betUpdate.points_awarded })
          .eq('id', betUpdate.id);
          
        if (individualUpdateError) {
            logger.error({ bettingRoundId, betId: betUpdate.id, error: individualUpdateError }, `Error updating points for bet.`);
            updateErrorOccurred = true;
            if (!firstUpdateError) {
                firstUpdateError = individualUpdateError; // Store the first error encountered
            }
            // Decide if we should continue trying other updates or break
            // For now, let's continue to try and update as many as possible
        }
      }

      // Check if any error occurred during the loop
      if (updateErrorOccurred) {
        return { 
          success: false, 
          message: "Failed to store calculated points for one or more bets.", 
          details: { betsProcessed: betsProcessed, betsUpdated: betsToUpdate.length - 1, error: firstUpdateError } 
        };
      }
      
      logger.info({ bettingRoundId, count: betsToUpdate.length }, `Successfully updated points for bets.`);
    } else {
        logger.info({ bettingRoundId }, `No bets required point updates.`);
    }

    // 8. Update betting_round status to 'scored'
    const now = new Date().toISOString();
    const { error: finalStatusError } = await client // Use passed-in client
      .from('betting_rounds')
      .update({ 
          status: 'scored', 
          scored_at: now, 
          updated_at: now // Also update updated_at
      })
      .eq('id', bettingRoundId);
      // Note: No .single() here as update doesn't guarantee returning the row by default
      // unless specific PostgREST headers are used or select() is added.
      // We primarily care if an error occurred.

    if (finalStatusError) {
      logger.error({ bettingRoundId, error: finalStatusError }, "Failed to mark betting round as scored after points update.");
      return { 
        success: false, 
        message: "Points stored, but failed to mark round as fully scored.", 
        details: { betsProcessed: betsProcessed, betsUpdated: betsToUpdate.length, error: finalStatusError } 
      };
    }

    logger.info({ bettingRoundId, scoredAt: now }, `Successfully marked betting round as scored.`);

    // 10. Return final success result
    return {
      success: true,
      message: `Scoring completed successfully for betting round ${bettingRoundId}.`,
      details: { betsProcessed: betsProcessed, betsUpdated: betsToUpdate.length }
    };

  } catch (error) {
    logger.error({ bettingRoundId, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 
                 `Unexpected error during score calculation.`);
    // TODO: Add logic to potentially revert status if needed
    return {
      success: false,
      message: "An unexpected error occurred during scoring.",
      details: { betsProcessed: 0, betsUpdated: 0, error: error instanceof Error ? error.message : String(error) }
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