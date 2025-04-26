// src/services/sync/syncFixtures.ts

import { supabaseServerClient } from '@/lib/supabase/server'; // Use server client for potential background jobs
import { getCurrentSeasonId } from '@/lib/seasons';
import { fetchFixtures } from '@/services/football-api/client';
import { roundManagementService } from '@/services/roundManagementService'; // Import the service
import type { Tables } from '@/types/supabase';

// Define type for the data we need from the DB fixture record for comparison
type DbFixtureComparable = Pick<
  Tables<'fixtures'>,
  'id' | 'api_fixture_id' | 'kickoff' | 'status_short' | 'home_goals' | 'away_goals' | 'result' | 'home_goals_ht' | 'away_goals_ht' | 'referee' | 'round_id' |
  'home_team_id' | 'away_team_id' // Added team IDs
>;

// Define a more specific type for the expected season details structure
type SeasonDetailsResponse = {
  api_season_year: number;
  // Expect competitions to be an object, not an array, due to the .single() and FK relation
  competitions: { 
    api_league_id: number;
  } | null; // Allow null if no competition relation exists
} | null

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
    // Use the specific type defined above
    const { data: seasonDetails, error: seasonError } = await supabaseServerClient
      .from('seasons')
      .select(`
        api_season_year,
        competitions ( api_league_id )
      `)
      .eq('id', activeSeasonDbId)
      .single<SeasonDetailsResponse>(); // Apply the specific type

    // Access the nested competition data as an object
    const competitionData = seasonDetails?.competitions;
    const apiLeagueId = competitionData?.api_league_id;
    const apiSeasonYear = seasonDetails?.api_season_year;

    // Check using the direct object access - should now satisfy TypeScript
    if (seasonError || !seasonDetails || !competitionData || !apiLeagueId || !apiSeasonYear) {
      console.error('Error fetching active season API details:', seasonError);
      console.log(`DEBUG Check: seasonError=${!!seasonError}, !seasonDetails=${!seasonDetails}, !competitionData=${!competitionData}, apiLeagueId=${apiLeagueId}, apiSeasonYear=${apiSeasonYear}`);
      return { success: false, message: 'Failed to retrieve API identifiers for the active season.', details: seasonError };
    }

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
  let roundCreationStatus: { success: boolean; message: string } | undefined;

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
    // Select team IDs directly
    const { data: dbFixturesData, error: dbError } = await supabaseServerClient
        .from('fixtures')
        .select(`
            id, api_fixture_id, kickoff, status_short, home_goals, away_goals, result, home_goals_ht, away_goals_ht, referee, round_id, 
            home_team_id, away_team_id, 
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
        // Ensure required IDs and kickoff are not null before adding to map
        if (f.api_fixture_id && f.round_id && f.home_team_id && f.away_team_id && f.kickoff) { 
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
            comparableFixture.round_id = f.round_id;
            comparableFixture.home_team_id = f.home_team_id; // Add home_team_id
            comparableFixture.away_team_id = f.away_team_id; // Add away_team_id

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
            console.warn(`API fixture ${apiFixture.id} not found in DB for season ${seasonDbId}. Skipping.`);
            skippedCount++;
            continue;
        }
        
        // Ensure dbFixture (from map) has required fields
        if (!dbFixture.round_id || !dbFixture.home_team_id || !dbFixture.away_team_id || !dbFixture.kickoff) {
            console.error(`Critical Error: Fixture ID ${dbFixture.id} retrieved from map is missing required fields. Skipping update.`);
            skippedCount++;
            continue;
        }

        // Compare relevant fields
        let needsUpdate = false;
        // Start with non-nullable fields required for update
        const updatePayload: Partial<Tables<'fixtures'>> & { id: number; api_fixture_id: number; round_id: number; home_team_id: number; away_team_id: number; kickoff: string; } = {
             id: dbFixture.id, 
             api_fixture_id: dbFixture.api_fixture_id, 
             round_id: dbFixture.round_id, 
             home_team_id: dbFixture.home_team_id, 
             away_team_id: dbFixture.away_team_id, 
             kickoff: dbFixture.kickoff // Explicitly include kickoff
        }; 

        // Compare kickoff time - *Now we only ADD if it differs from the already included kickoff*
        if (apiFixture.date && apiFixture.date !== updatePayload.kickoff) {
            updatePayload.kickoff = apiFixture.date;
            needsUpdate = true;
        }
        // Compare status
        if (apiFixture.status?.short && apiFixture.status.short !== dbFixture.status_short) {
            updatePayload.status_short = apiFixture.status.short;
            updatePayload.status_long = apiFixture.status.long; 
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
         // Compare Referee
         if (apiFixture.referee && apiFixture.referee !== dbFixture.referee) {
            updatePayload.referee = apiFixture.referee;
            needsUpdate = true;
        }

        // Recalculate result if goals changed
        const currentApiResult = calculateResult(apiGoals.home, apiGoals.away);
        if ((needsUpdate && updatePayload.home_goals !== undefined) || (needsUpdate && updatePayload.away_goals !== undefined) || currentApiResult !== dbFixture.result) {
            if (currentApiResult !== dbFixture.result) {
                 updatePayload.result = currentApiResult;
                 needsUpdate = true;
            }
        }

        if (needsUpdate) {
            updatePayload.last_api_update = new Date().toISOString(); 
            updates.push(updatePayload);
        } else {
            skippedCount++;
        }
    }

    // 4. Execute DB Updates if any changes were found
    if (updates.length > 0) {
        console.log(`Found ${updates.length} fixtures needing updates. Applying...`);
        const { error: updateError } = await supabaseServerClient
            .from('fixtures')
            .upsert(updates, { onConflict: 'id' }); 

        if (updateError) {
            console.error('Error applying fixture updates to DB:', updateError);
            errorCount = updates.length; 
            return { success: false, message: `Failed to apply ${updates.length} fixture updates.`, details: updateError };
        }
        updatedCount = updates.length;
        console.log(`Successfully applied ${updatedCount} fixture updates.`);
    } else {
        console.log('No fixture updates required.');
    }

    // --- 5. Attempt to Create Next Betting Round (Task 8.3 & 8.4) ---
    console.log(`Fixture sync complete for season ${seasonDbId}. Attempting to trigger round creation...`);
    // Call the round management service to try and create the next round.
    // This is wrapped in a try/catch within the service method itself,
    // so errors here won't stop the sync process completion.
    roundCreationStatus = await roundManagementService._tryCreateNextBettingRound();
    
    // Log the specific outcome for clarity
    if (roundCreationStatus.success) {
      console.log(`Automated round creation check for season ${seasonDbId} completed. Status: ${roundCreationStatus.message}`);
    } else {
      console.warn(`Automated round creation check for season ${seasonDbId} failed. Status: ${roundCreationStatus.message}`);
    }
    // --- End Round Creation Attempt ---

    const finalMessage = `Fixture sync completed for season ${seasonDbId}. Fetched: ${apiFixtures.length}, Updated: ${updatedCount}, Skipped/No Change: ${skippedCount}, Errors: ${errorCount}. Round Creation Status: ${roundCreationStatus?.message || 'Not attempted / Error before attempt'}`;
    return {
        success: true, // Sync itself succeeded up to this point
        message: finalMessage,
        details: { 
            fetched: apiFixtures.length, 
            updated: updatedCount, 
            skipped: skippedCount, 
            errors: errorCount,
            roundCreation: roundCreationStatus // Include round creation status
        }
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