// src/services/sync/syncFixtures.ts

import { supabaseServerClient } from '@/lib/supabase/server'; // Use server client for potential background jobs
import { getCurrentSeasonId } from '@/lib/seasons';
import { fetchFixtures } from '@/services/football-api/client';
import type { Tables } from '@/types/supabase';

// Define type for the data we need from the DB fixture record for comparison
type DbFixtureComparable = Pick<
  Tables<'fixtures'>,
  'id' | 'api_fixture_id' | 'kickoff' | 'status_short' | 'home_goals' | 'away_goals' | 'result' | 'home_goals_ht' | 'away_goals_ht' | 'referee' // Added missing fields
>;

/**
 * Main function to trigger fixture synchronization for the currently active season.
 * It retrieves the active season details and then calls the core sync logic.
 */
export async function syncFixturesForActiveSeason(): Promise<{ success: boolean; message: string; details?: unknown }> {
  console.log('Starting fixture sync for active season...');
  try {
    const activeSeasonDbId = await getCurrentSeasonId();
    if (!activeSeasonDbId) {
      return { success: false, message: 'No active season found in the database.' };
    }

    // Fetch the active season details to get API identifiers
    const { data: seasonDetails, error: seasonError } = await supabaseServerClient
      .from('seasons')
      .select(`
        api_season_year,
        competitions ( api_league_id )
      `)
      .eq('id', activeSeasonDbId)
      .single();

    // Access the first element of the competitions array
    const competitionData = seasonDetails?.competitions?.[0];

    if (seasonError || !seasonDetails || !competitionData || !competitionData.api_league_id) {
      console.error('Error fetching active season API details:', seasonError);
      return { success: false, message: 'Failed to retrieve API identifiers for the active season.', details: seasonError };
    }

    const apiLeagueId = competitionData.api_league_id;
    const apiSeasonYear = seasonDetails.api_season_year;

    console.log(`Found active season: DB ID=${activeSeasonDbId}, API League ID=${apiLeagueId}, API Season=${apiSeasonYear}`);

    // Call the core synchronization logic
    return await syncFixturesData(apiLeagueId, apiSeasonYear, activeSeasonDbId);

  } catch (error) {
    console.error('Unexpected error in syncFixturesForActiveSeason:', error);
    return { success: false, message: 'An unexpected error occurred during sync setup.', details: error instanceof Error ? error.message : String(error) };
  }
}


/**
 * Core logic to synchronize fixture data for a specific league and season
 * between the API and the local database.
 *
 * @param apiLeagueId - The league ID used by the external API.
 * @param apiSeasonYear - The season year used by the external API.
 * @param seasonDbId - The internal database ID for the season.
 */
async function syncFixturesData(
  apiLeagueId: number,
  apiSeasonYear: number,
  seasonDbId: number
): Promise<{ success: boolean; message: string; details?: unknown }> {
  console.log(`Syncing fixtures for API League ${apiLeagueId}, Season ${apiSeasonYear} (DB Season ID: ${seasonDbId})`);
  let updatedCount = 0;
  let skippedCount = 0; // Count fixtures already up-to-date
  let errorCount = 0;

  try {
    // 1. Fetch latest fixture data from API
    console.log('Fetching latest fixtures from API...');
    const apiResponse = await fetchFixtures(apiLeagueId, apiSeasonYear);
    if (!apiResponse || !apiResponse.response) {
        return { success: false, message: `API did not return fixture data for league ${apiLeagueId}, season ${apiSeasonYear}.` };
    }
    const apiFixtures = apiResponse.response;
    console.log(`Fetched ${apiFixtures.length} fixtures from API.`);

    // 2. Fetch existing fixtures from DB for this season
    console.log(`Fetching existing fixtures from DB for season ID ${seasonDbId}...`);
    // We need to join with rounds to filter by seasonDbId
    const { data: dbFixturesData, error: dbError } = await supabaseServerClient
        .from('fixtures')
        .select(`
            id, api_fixture_id, kickoff, status_short, home_goals, away_goals, result, home_goals_ht, away_goals_ht, referee,
            rounds ( season_id )
        `)
        .eq('rounds.season_id', seasonDbId); // Filter by DB season ID

    if (dbError) {
        console.error('Error fetching fixtures from DB:', dbError);
        return { success: false, message: 'Failed to fetch existing fixtures from database.', details: dbError };
    }

    // Create a map for quick lookup by api_fixture_id
    const dbFixturesMap = new Map<number, DbFixtureComparable>();
    dbFixturesData?.forEach(f => {
        if (f.api_fixture_id) { // Ensure api_fixture_id is not null
             // Explicitly cast to DbFixtureComparable after checking required fields if needed
            const comparableFixture: Partial<DbFixtureComparable> = {};
            comparableFixture.id = f.id;
            comparableFixture.api_fixture_id = f.api_fixture_id;
            comparableFixture.kickoff = f.kickoff;
            comparableFixture.status_short = f.status_short;
            comparableFixture.home_goals = f.home_goals;
            comparableFixture.away_goals = f.away_goals;
            comparableFixture.result = f.result;
            comparableFixture.home_goals_ht = f.home_goals_ht;
            comparableFixture.away_goals_ht = f.away_goals_ht;
            comparableFixture.referee = f.referee;

            dbFixturesMap.set(f.api_fixture_id, comparableFixture as DbFixtureComparable);
        }
    });
    console.log(`Found ${dbFixturesMap.size} existing fixtures in DB for this season.`);

    // 3. Compare and prepare updates
    const updates: (Partial<Tables<'fixtures'>> & { id: number })[] = []; // Array to hold update payloads

    for (const apiFixtureItem of apiFixtures) {
        const apiFixture = apiFixtureItem.fixture;
        const apiGoals = apiFixtureItem.goals;
        const apiScore = apiFixtureItem.score; // For HT score

        if (!apiFixture || !apiGoals || !apiScore) {
            console.warn(`Skipping API fixture ${apiFixture?.id} due to incomplete data.`);
            skippedCount++;
            continue;
        }

        const dbFixture = dbFixturesMap.get(apiFixture.id);

        if (!dbFixture) {
            // This shouldn't happen if initial population was complete, but log it.
            // For MVP, we won't insert missing fixtures here.
            console.warn(`API fixture ${apiFixture.id} not found in DB for season ${seasonDbId}. Skipping.`);
            skippedCount++;
            continue;
        }

        // Compare relevant fields
        let needsUpdate = false;
        const updatePayload: Partial<Tables<'fixtures'>> & { id: number } = { id: dbFixture.id }; // Start with DB id

        // Compare kickoff time (convert API string to match DB potentially, assuming DB is ISO string)
        if (apiFixture.date && apiFixture.date !== dbFixture.kickoff) {
            updatePayload.kickoff = apiFixture.date;
            needsUpdate = true;
        }
        // Compare status
        if (apiFixture.status?.short && apiFixture.status.short !== dbFixture.status_short) {
            updatePayload.status_short = apiFixture.status.short;
            updatePayload.status_long = apiFixture.status.long; // Update long status too
            needsUpdate = true;
        }
        // Compare goals
        if (apiGoals.home !== dbFixture.home_goals) {
            updatePayload.home_goals = apiGoals.home;
            needsUpdate = true;
        }
        if (apiGoals.away !== dbFixture.away_goals) {
            updatePayload.away_goals = apiGoals.away;
            needsUpdate = true;
        }
         // Compare HT goals
         if (apiScore.halftime?.home !== dbFixture.home_goals_ht) {
             updatePayload.home_goals_ht = apiScore.halftime.home;
             needsUpdate = true;
         }
         if (apiScore.halftime?.away !== dbFixture.away_goals_ht) {
             updatePayload.away_goals_ht = apiScore.halftime.away;
             needsUpdate = true;
         }
         // Compare Referee (Optional, but might be useful)
         if (apiFixture.referee && apiFixture.referee !== dbFixture.referee) {
            updatePayload.referee = apiFixture.referee;
            needsUpdate = true;
        }

        // Recalculate result if goals changed
        const currentApiResult = calculateResult(apiGoals.home, apiGoals.away);
        // Check if the result needs updating (either because goals changed OR the stored result was wrong)
        if ((needsUpdate && updatePayload.home_goals !== undefined) || (needsUpdate && updatePayload.away_goals !== undefined) || currentApiResult !== dbFixture.result) {
            if (currentApiResult !== dbFixture.result) {
                 updatePayload.result = currentApiResult;
                 needsUpdate = true; // Ensure needsUpdate is true if only result changed
            }
        }

        if (needsUpdate) {
            updatePayload.last_api_update = new Date().toISOString(); // Mark when we updated it
            updates.push(updatePayload);
        } else {
            skippedCount++; // Fixture is already up-to-date
        }
    }

    // 4. Execute DB Updates if any changes were found
    if (updates.length > 0) {
        console.log(`Found ${updates.length} fixtures needing updates. Applying...`);
        // Using upsert with the primary key 'id' acts as an update here
        // Consider batching for very large numbers of updates
        const { error: updateError } = await supabaseServerClient
            .from('fixtures')
            .upsert(updates, { onConflict: 'id' }); // Update based on primary key 'id'

        if (updateError) {
            console.error('Error applying fixture updates to DB:', updateError);
            // Depending on strategy, you might count these as errors or throw
            errorCount = updates.length; // Count all as errors for simplicity
            return { success: false, message: `Failed to apply ${updates.length} fixture updates.`, details: updateError };
        }
        updatedCount = updates.length;
        console.log(`Successfully applied ${updatedCount} fixture updates.`);
    } else {
        console.log('No fixture updates required.');
    }

    return {
        success: true,
        message: `Fixture sync completed. Fetched: ${apiFixtures.length}, Updated: ${updatedCount}, Skipped/No Change: ${skippedCount}, Errors: ${errorCount}`,
        details: { fetched: apiFixtures.length, updated: updatedCount, skipped: skippedCount, errors: errorCount }
    };

  } catch (error) {
    console.error(`Unexpected error during syncFixturesData for league ${apiLeagueId}, season ${apiSeasonYear}:`, error);
    return { success: false, message: 'An unexpected error occurred during the sync process.', details: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Helper function to calculate the 1X2 result from goals.
 */
function calculateResult(home: number | null, away: number | null): '1' | 'X' | '2' | null {
    if (home === null || away === null) return null;
    if (home > away) return '1';
    if (home < away) return '2';
    return 'X';
} 