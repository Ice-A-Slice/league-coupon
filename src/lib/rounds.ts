import { createClient } from '@/utils/supabase/client';
import { getCurrentSeasonId } from './seasons'; // Import function to get current season

// const supabase = createClient(); // Removed from module scope

/**
 * Retrieves the database ID of the current betting round for the active season.
 * The current betting round is defined as the round containing the earliest
 * fixture with status 'NS' (Not Started).
 *
 * @returns {Promise<number | null>} A promise that resolves to the ID of the current betting round,
 *                                  or null if no active season or upcoming round is found, or an error occurs.
 */
export async function getCurrentBettingRoundId(): Promise<number | null> {
  const supabase = createClient(); // Instantiate client inside the function
  console.log('Fetching current betting round ID...');
  try {
    // First, get the ID of the currently active season
    const currentSeasonId = await getCurrentSeasonId();

    if (currentSeasonId === null) {
      console.warn('Cannot fetch betting round ID because no active season was found.');
      return null;
    }

    console.log(`Active season ID: ${currentSeasonId}. Finding earliest NS fixture...`);

    // Query fixtures for the active season, finding the earliest 'NS' fixture
    // We need to join with rounds to filter by season_id
    const { data: fixtureData, error: fixtureError } = await supabase
      .from('fixtures')
      .select(`
        round_id,
        rounds ( season_id ) 
      `) // Select round_id directly
      .eq('status_short', 'NS') // Filter by Not Started status
      .eq('rounds.season_id', currentSeasonId) // Filter by the current season ID via join
      .order('kickoff', { ascending: true }) // Order by kickoff time to find the earliest
      .limit(1) // We only need the very first one
      .maybeSingle(); // Use maybeSingle to return null instead of error if no row found

    if (fixtureError) {
        console.error('Error fetching earliest NS fixture:', fixtureError);
        return null;
    }

    if (!fixtureData) {
        console.log(`No 'Not Started' fixtures found for season ${currentSeasonId}. No current betting round.`);
        return null;
    }

    console.log(`Current betting round ID found: ${fixtureData.round_id}`);
    return fixtureData.round_id;

  } catch (err) {
    console.error('Unexpected error in getCurrentBettingRoundId:', err);
    return null;
  }
} 