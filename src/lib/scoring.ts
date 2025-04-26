// src/lib/scoring.ts

import { supabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type BettingRoundId = number;
type UserId = string;
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
 * @returns Promise<ScoreCalculationResult> An object indicating success or failure.
 */
export async function calculateAndStoreMatchPoints(
  bettingRoundId: BettingRoundId
): Promise<ScoreCalculationResult> {
  console.log(`Starting score calculation for betting_round_id: ${bettingRoundId}`);
  
  // Placeholder return for now
  // TODO: Implement the actual logic
  try {
    // Step 1: Check idempotency & set status to 'scoring'
    const { data: roundData, error: fetchError } = await supabaseServerClient
      .from('betting_rounds')
      .select('status')
      .eq('id', bettingRoundId)
      .single();

    if (fetchError) {
      console.error(`Error fetching betting round status for ID ${bettingRoundId}:`, fetchError);
      return { success: false, message: "Failed to fetch betting round status.", details: { betsProcessed: 0, betsUpdated: 0, error: fetchError } };
    }

    if (!roundData) {
       return { success: false, message: `Betting round with ID ${bettingRoundId} not found.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    if (roundData.status === 'scored' || roundData.status === 'scoring') {
      console.log(`Betting round ${bettingRoundId} is already ${roundData.status}. Skipping calculation.`);
      // It's not an error, the desired state is already achieved or in progress.
      return { success: true, message: `Scoring skipped: Round already ${roundData.status}.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    // Attempt to set status to 'scoring'
    const { error: updateStatusError } = await supabaseServerClient
      .from('betting_rounds')
      .update({ status: 'scoring', updated_at: new Date().toISOString() }) // Also update updated_at
      .eq('id', bettingRoundId)
      // Optionally add a condition to ensure we only update if status hasn't changed concurrently
      // .eq('status', roundData.status) // Uncomment if high concurrency is expected
      .select() // Required by Supabase update to return data/error
      .single(); // We expect to update one row

    if (updateStatusError) {
        // Handle potential race condition if status changed between select and update
        if (updateStatusError.code === 'PGRST116') { // PostgREST code for "MATCHING ROWS NOT FOUND"
             console.warn(`Could not set status to 'scoring' for round ${bettingRoundId}, likely already processed concurrently.`);
             // Treat as success because another process is likely handling it
             return { success: true, message: "Scoring likely handled by concurrent process.", details: { betsProcessed: 0, betsUpdated: 0 }};
        }
        console.error(`Error updating betting round ${bettingRoundId} status to 'scoring':`, updateStatusError);
        return { success: false, message: "Failed to set betting round status to 'scoring'.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
    }

    console.log(`Betting round ${bettingRoundId} status set to 'scoring'. Proceeding...`);

    // --- Steps 2-8 will go here ---
    
    // 2. Fetch Fixture IDs associated with the betting round
    const { data: fixtureLinks, error: linkError } = await supabaseServerClient
      .from('betting_round_fixtures')
      .select('fixture_id')
      .eq('betting_round_id', bettingRoundId);

    if (linkError) {
      console.error(`Error fetching fixture links for betting round ${bettingRoundId}:`, linkError);
      // TODO: Consider resetting status from 'scoring'
      return { success: false, message: "Failed to fetch associated fixtures.", details: { betsProcessed: 0, betsUpdated: 0, error: linkError } };
    }

    if (!fixtureLinks || fixtureLinks.length === 0) {
      console.warn(`No fixtures found linked to betting round ${bettingRoundId}. Marking as scored.`);
      // If there are no fixtures, there's nothing to score. Mark as done.
      const { error: updateStatusError } = await supabaseServerClient
        .from('betting_rounds')
        .update({ status: 'scored', scored_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', bettingRoundId);
        
      if (updateStatusError) {
           console.error(`Error marking empty betting round ${bettingRoundId} as scored:`, updateStatusError);
           // Status might still be 'scoring' here, which isn't ideal but hard to recover automatically
           return { success: false, message: "Failed to mark empty round as scored.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
      }
      return { success: true, message: "No fixtures linked to this round; marked as scored.", details: { betsProcessed: 0, betsUpdated: 0 } };
    }

    const fixtureIds = fixtureLinks.map(link => link.fixture_id);
    console.log(`Found ${fixtureIds.length} fixtures for round ${bettingRoundId}: ${fixtureIds.join(', ')}`);

    // --- Steps 3-8 will follow ---
    
    // 3. Fetch final results for these fixtures
    const { data: fixturesData, error: fixturesError } = await supabaseServerClient
      .from('fixtures')
      .select('id, home_goals, away_goals, status_short, result') // Select result too for direct comparison
      .in('id', fixtureIds); // Use the array of IDs from Step 2

    if (fixturesError) {
      console.error(`Error fetching fixture details for round ${bettingRoundId}:`, fixturesError);
      // TODO: Consider resetting status from 'scoring'
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
              console.warn(`Fixture ${fixture.id} has finished status '${fixture.status_short}' but null/invalid goals/result. Cannot score.`);
              // Decide how to handle - treat as unfinished for now? Or error out?
              allFixturesFinished = false; // Treat as not finished if result can't be determined
          }
      } else {
        allFixturesFinished = false; // Mark as not all finished if any fixture isn't in a finished state
      }
    }

    // If not all fixtures linked to the round are finished, we cannot score the round yet.
    if (!allFixturesFinished || finishedFixtureResults.size !== fixtureIds.length) {
        const missingCount = fixtureIds.length - finishedFixtureResults.size;
        console.log(`Scoring deferred for betting round ${bettingRoundId}: Not all ${fixtureIds.length} fixtures have finished and have valid results (${missingCount} pending/invalid). Status remains 'scoring'.`);
         // We leave the status as 'scoring' so the next run picks it up
        return { success: true, message: `Scoring deferred: Not all fixtures finished or have valid results.`, details: { betsProcessed: 0, betsUpdated: 0 } };
    }
    
    console.log(`Results fetched for ${finishedFixtureResults.size} finished fixtures in round ${bettingRoundId}.`);

    // --- Steps 4-8 will follow ---

    // 4. Fetch all user bets for this betting round
    const { data: userBets, error: betsError } = await supabaseServerClient
      .from('user_bets')
      .select('id, user_id, fixture_id, prediction, points_awarded')
      .eq('betting_round_id', bettingRoundId);

    if (betsError) {
      console.error(`Error fetching user bets for betting round ${bettingRoundId}:`, betsError);
      // TODO: Consider resetting status from 'scoring'
      return { success: false, message: "Failed to fetch user bets.", details: { betsProcessed: 0, betsUpdated: 0, error: betsError } };
    }

    if (!userBets || userBets.length === 0) {
      console.log(`No user bets found for betting round ${bettingRoundId}. Marking as scored.`);
      // If there are no bets, we can mark the round as scored immediately.
      const { error: updateStatusError } = await supabaseServerClient
        .from('betting_rounds')
        .update({ status: 'scored', scored_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', bettingRoundId);
        
      if (updateStatusError) {
           console.error(`Error marking no-bets round ${bettingRoundId} as scored:`, updateStatusError);
           return { success: false, message: "Failed to mark no-bets round as scored.", details: { betsProcessed: 0, betsUpdated: 0, error: updateStatusError } };
      }
      return { success: true, message: "No user bets for this round; marked as scored.", details: { betsProcessed: 0, betsUpdated: 0 } };
    }
    
    console.log(`Fetched ${userBets.length} user bets for round ${bettingRoundId}.`);

    // --- Steps 5-8 will follow ---

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
            console.warn(`Skipping bet ID ${bet.id} for fixture ${bet.fixture_id}: Missing or invalid final result.`);
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
    
    console.log(`Calculated scores for ${betsToUpdate.length} bets out of ${betsProcessed} total for round ${bettingRoundId}.`);

    // --- Steps 7-8 will follow ---

    // 7. Update user_bets table with calculated points
    if (betsToUpdate.length > 0) {
      console.log(`Updating points for ${betsToUpdate.length} bets...`);
      const { error: updateBetsError } = await supabaseServerClient
        .from('user_bets')
        .upsert(betsToUpdate, { onConflict: 'id' }); // Update based on the 'id' primary key

      if (updateBetsError) {
        console.error(`Error updating user_bets points for round ${bettingRoundId}:`, updateBetsError);
        // TODO: Consider resetting status from 'scoring'
        return { 
          success: false, 
          message: "Failed to store calculated points.", 
          details: { betsProcessed: betsProcessed, betsUpdated: 0, error: updateBetsError } 
        };
      }
      console.log(`Successfully updated points for ${betsToUpdate.length} bets.`);
    } else {
        console.log(`No bets required point updates for round ${bettingRoundId}.`);
    }

    // --- Step 8 will follow ---

    // 8. Update betting_round status to 'scored'
    const now = new Date().toISOString();
    const { error: finalStatusError } = await supabaseServerClient
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
      console.error(`Error marking betting round ${bettingRoundId} as scored:`, finalStatusError);
      // Critical state: Points awarded but round not marked as scored. Manual intervention might be needed.
      return { 
        success: false, 
        message: "Points stored, but failed to mark round as fully scored.", 
        details: { betsProcessed: betsProcessed, betsUpdated: betsToUpdate.length, error: finalStatusError } 
      };
    }

    console.log(`Successfully marked betting round ${bettingRoundId} as scored at ${now}.`);

    // 10. Return final success result
    return {
      success: true,
      message: `Scoring completed successfully for betting round ${bettingRoundId}.`,
      details: { betsProcessed: betsProcessed, betsUpdated: betsToUpdate.length }
    };

  } catch (error) {
    console.error(`Error during score calculation for betting_round_id: ${bettingRoundId}`, error);
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