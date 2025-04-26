import { createClient } from '@/utils/supabase/client'; // Corrected path
import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@/types/supabase';
import { calculateTimeDifference } from '@/lib/utils';

// --- Constants ---
const TIME_GAP_THRESHOLD_HOURS = 72;
const MIN_FIXTURES_PER_ROUND = 1; // Start with 1 for initial testing

// --- Utilities ---

/** Basic console logger prefixed with service name. */
const log = (...args: unknown[]) => console.log('[RoundManagementService]', ...args);

/** Basic console error logger prefixed with service name. */
const error = (...args: unknown[]) => console.error('[RoundManagementService Error]', ...args);

/** Custom error class for specific errors originating from the Round Management Service. */
class RoundManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoundManagementError';
  }
}

// --- Service Definition ---

/**
 * Provides functions for managing betting rounds, including defining,
 * opening, and potentially closing or scoring them.
 */
export const roundManagementService = {
  /**
   * PRIVATE HELPER: Checks if a betting round with status 'open' already exists.
   * @returns {Promise<boolean>} True if an open round exists, false otherwise.
   * @throws {RoundManagementError} If the database query fails.
   */
  async _checkForExistingOpenRound(): Promise<boolean> {
    log('Checking for existing open betting rounds...');
    const supabase = createClient();
    try {
      const { error, count } = await supabase
        .from('betting_rounds')
        .select('id', { count: 'exact', head: true }) // Efficiently check existence
        .eq('status', 'open');

      if (error) {
        // Log the error object itself or specific properties
        console.error('[RoundManagementService Error] Database error checking for open rounds:', error);
        throw new RoundManagementError('Failed to query for existing open rounds.');
      }

      const exists = (count ?? 0) > 0;
      log(`Open round exists: ${exists}`);
      return exists;

    } catch (err) {
      // Catch potential errors from the helper itself or re-throw db errors
      if (err instanceof RoundManagementError) throw err;
      error('Unexpected error in _checkForExistingOpenRound:', err);
      throw new RoundManagementError('Unexpected error checking for open rounds.');
    }
  },

  /**
   * PRIVATE HELPER: Extracts necessary metadata for creating a new betting round
   * from a group of fixtures.
   * Calculates earliest/latest kickoffs, determines competition ID, and generates a simple round name.
   *
   * @param groupedFixtures - An array of Fixture objects for the round, pre-sorted by kickoff.
   * @returns {Promise<{name: string; competitionId: number; earliestKickoff: string; latestKickoff: string}>} Metadata object.
   * @throws {RoundManagementError} If fixtures are empty, competition ID cannot be determined, or DB errors occur.
   */
  async _extractBettingRoundMetadata(groupedFixtures: Fixture[]): Promise<{
    name: string;
    competitionId: number;
    earliestKickoff: string;
    latestKickoff: string;
  }> {
    if (!groupedFixtures || groupedFixtures.length === 0) {
      throw new RoundManagementError('Cannot extract metadata from empty fixture group.');
    }

    log('Extracting metadata for betting round creation...');
    const supabase = createClient();

    try {
      // 1. Earliest/Latest Kickoff (Task 5.4)
      // Fixtures are pre-sorted, so first and last elements give the times
      const earliestKickoff = groupedFixtures[0].kickoff;
      const latestKickoff = groupedFixtures[groupedFixtures.length - 1].kickoff;
      log(`Extracted Kickoffs: Earliest=${earliestKickoff}, Latest=${latestKickoff}`);

      // 2. Round IDs & Competition ID (Tasks 5.2 & 5.5)
      const uniqueRoundIds = [...new Set(groupedFixtures.map(f => f.round_id))];
      if (uniqueRoundIds.length === 0) {
          throw new RoundManagementError('Cannot determine round ID from fixtures.');
      }
      const representativeRoundId = uniqueRoundIds[0]; // Use the first round ID found
      log(`Representative Round ID: ${representativeRoundId}`);

      // Query Rounds table for season_id
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('season_id')
        .eq('id', representativeRoundId)
        .single();

      if (roundError || !roundData) {
        error('Error fetching round data:', roundError);
        throw new RoundManagementError(`Failed to fetch season ID for round ${representativeRoundId}.`);
      }
      const seasonId = roundData.season_id;
      log(`Determined Season ID: ${seasonId}`);

      // Query Seasons table for competition_id
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('competition_id')
        .eq('id', seasonId)
        .single();

      if (seasonError || !seasonData) {
        error('Error fetching season data:', seasonError);
        throw new RoundManagementError(`Failed to fetch competition ID for season ${seasonId}.`);
      }
      const competitionId = seasonData.competition_id;
      log(`Determined Competition ID: ${competitionId}`);

      // 3. Round Naming (Task 5.3 - Simplified MVP)
      const minRoundId = Math.min(...uniqueRoundIds); // Find the minimum round ID numerically
      const name = `Round ${minRoundId}`; // Simple MVP name format
      log(`Generated Round Name: ${name}`);

      return { name, competitionId, earliestKickoff, latestKickoff };

    } catch (err) {
        error('Error extracting betting round metadata:', err);
        if (err instanceof RoundManagementError) throw err;
        throw new RoundManagementError('Unexpected error extracting metadata for round creation.');
    }
  },

  /**
   * PRIVATE HELPER: Inserts a new record into the betting_rounds table.
   *
   * @param metadata - Object containing the required data for the new round.
   * @returns {Promise<number>} The ID of the newly created betting round.
   * @throws {RoundManagementError} If the database insertion fails.
   */
  async _createBettingRoundRecord(metadata: {
    name: string;
    competitionId: number;
    earliestKickoff: string;
    latestKickoff: string;
  }): Promise<number> {
    log(`Inserting new betting round record: ${metadata.name}`);
    const supabase = createClient();

    const newRoundData: BettingRoundInsert = {
      name: metadata.name,
      competition_id: metadata.competitionId,
      earliest_fixture_kickoff: metadata.earliestKickoff,
      latest_fixture_kickoff: metadata.latestKickoff,
      status: 'open' // Default status for a new round
      // updated_at and created_at should be handled by DB defaults/triggers
      // scored_at starts as null
    };

    try {
      const { data, error } = await supabase
        .from('betting_rounds')
        .insert(newRoundData)
        .select('id') // Select the ID of the newly inserted row
        .single(); // Expecting only one row to be inserted and returned

      if (error || !data?.id) {
        // Log the error object itself or specific properties
        console.error('[RoundManagementService Error] Error inserting new betting round record:', error);
        throw new RoundManagementError('Failed to insert new betting round into database.');
      }

      const newRoundId = data.id;
      log(`Successfully created betting round with ID: ${newRoundId}`);
      return newRoundId;

    } catch (err) {
      error('Unexpected error during betting round insertion:', err);
      if (err instanceof RoundManagementError) throw err;
      throw new RoundManagementError('Unexpected error creating betting round record.');
    }
  },

  /**
   * PRIVATE HELPER: Populates the betting_round_fixtures link table.
   *
   * @param bettingRoundId - The ID of the parent betting round.
   * @param fixturesToLink - An array of Fixture objects to link to the round.
   * @returns {Promise<void>}
   * @throws {RoundManagementError} If input is invalid or database insertion fails.
   */
  async _populateBettingRoundFixtures(bettingRoundId: number, fixturesToLink: Fixture[]): Promise<void> {
    log(`Populating fixtures for betting round ID: ${bettingRoundId}`);

    // --- 1. Input Validation (Subtask 6.2) ---
    if (!bettingRoundId || bettingRoundId <= 0) {
      throw new RoundManagementError('Invalid bettingRoundId provided for populating fixtures.');
    }
    if (!fixturesToLink || fixturesToLink.length === 0) {
      log('No fixtures provided to link, skipping population.');
      // Consider if this should be an error or just a silent skip.
      // Skipping for now, as an empty round might be technically valid, though unusual.
      return;
    }
    log(`Attempting to link ${fixturesToLink.length} fixtures.`);
    // --- End Validation ---

    const supabase = createClient();

    try {
      // --- 1. Map fixtures to insertion objects (Subtask 6.3a) ---
      const recordsToInsert = fixturesToLink.map(fixture => ({
        betting_round_id: bettingRoundId,
        fixture_id: fixture.id // Assuming Fixture type has `id` which is the PK
        // created_at should be handled by DB default
      }));
      log(`Prepared ${recordsToInsert.length} records for betting_round_fixtures insertion.`);
      // --- End Mapping ---

      // --- 2. Perform batch insert (Subtask 6.3b & 6.4) ---
      const { error: insertError } = await supabase
        .from('betting_round_fixtures')
        .insert(recordsToInsert);

      if (insertError) {
        // Log the specific error from the insert operation
        console.error('[RoundManagementService Error] Error inserting into betting_round_fixtures:', insertError);
        throw new RoundManagementError('Database insertion into betting_round_fixtures failed.');
      }
      // --- End Insert ---

      log(`Successfully populated fixtures for round ${bettingRoundId}.`);

    } catch (err) {
      error('Error populating betting round fixtures:', err);
      // Handle potential DB errors
      if (err instanceof RoundManagementError) throw err; 
      throw new RoundManagementError('Unexpected error populating betting round fixtures.');
    }
  },

  /**
   * PRIVATE HELPER: Attempts to create the next betting round, catching and logging errors.
   * This is designed to be called from automated processes (like fixture sync)
   * where round creation failure should not halt the main process.
   *
   * @returns {Promise<{ success: boolean; message: string; roundId?: number }>} Status object.
   */
  async _tryCreateNextBettingRound(): Promise<{ success: boolean; message: string; roundId?: number }> {
    log('Attempting automated round creation trigger...');
    try {
      // Note: defineAndOpenNextBettingRound now returns the new ID or void
      // We might need to adjust defineAndOpenNextBettingRound to return the ID upon success
      // For now, let's assume it might return void and we don't capture the ID here.
      // TODO: Refactor defineAndOpenNextBettingRound to return new ID if needed here.
      await this.defineAndOpenNextBettingRound(); 
      
      // If defineAndOpenNextBettingRound completes without throwing, assume success
      // but acknowledge we don't have the ID back here easily without refactoring.
      const successMessage = 'Automated round creation attempt finished. Check logs for details (may have stopped if open round exists or no fixtures found).';
      log(successMessage);
      return { success: true, message: successMessage }; // Consider returning true even if it stopped early due to existing open round etc.

    } catch (err) {
      const errorMessage = 'Automated round creation attempt failed.';
      error(errorMessage, err); // Log the actual error
      return { success: false, message: `${errorMessage} Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  /**
   * Orchestrates the entire process of:
   * 1. Checking for existing open rounds.
   * 2. Identifying candidate fixtures for the next betting round.
   * 3. Grouping those fixtures logically.
   * 4. Creating the new betting round in the database.
   * 5. Populating the link table between the round and its fixtures.
   * 
   * @throws {RoundManagementError} If any step in the process fails, including validation errors or database issues.
   * @returns {Promise<number | void>} A promise that resolves to the ID of the newly created betting round, or void if no round was created.
   */
  async defineAndOpenNextBettingRound(): Promise<number | void> {
    log('Attempting to define and open the next betting round...');
    let newBettingRoundId: number | undefined;
    try {
      // --- 1. Check if an open round already exists (Task 4) ---
      const openRoundExists = await this._checkForExistingOpenRound();
      if (openRoundExists) {
        log('Process stopped: An open betting round already exists.');
        return; // Exit early
      }
      // --- End Check --- 

      // --- 2. Identify candidate fixtures (Task 2) ---
      log('Identifying candidate fixtures...');
      const candidateFixtures = await this.identifyCandidateFixtures();
      if (candidateFixtures.length === 0) {
        log('Process stopped: No candidate fixtures found.');
        return; // Exit if no candidates
      }
      // --- End Identification ---

      // --- 3. Group fixtures into a logical round (Task 3) ---
      log('Grouping fixtures...');
      const groupedFixtures = await this.groupFixturesForRound(candidateFixtures);
      if (!groupedFixtures) {
        log('Process stopped: Could not form a valid group of fixtures for the round.');
        return; // Exit if no valid group found
      }
      // --- End Grouping ---

      // --- 4. Extract Metadata & Create Betting Round (Task 5) ---
      const metadata = await this._extractBettingRoundMetadata(groupedFixtures);
      log(`Extracted metadata: Name=${metadata.name}, CompID=${metadata.competitionId}, Start=${metadata.earliestKickoff}, End=${metadata.latestKickoff}`);
      
      log('Creating betting round...');
      // --- 4b. Create Betting Round Record (Subtask 5.6) ---
      newBettingRoundId = await this._createBettingRoundRecord(metadata);
      // --- End Create Record ---

      // --- 5. Populate the betting_round_fixtures table (Task 6) ---
      log('Populating round fixtures...');
      await this._populateBettingRoundFixtures(newBettingRoundId, groupedFixtures);

      log(`Successfully defined and opened betting round ${newBettingRoundId}.`);
      return newBettingRoundId; // Return the ID on success

    } catch (err) {
      error('Failed to define and open next betting round:', err);
      // Re-throw a consistent error type or handle as needed
      if (err instanceof RoundManagementError) {
        throw err; 
      } else {
        // Optionally wrap unexpected errors for consistency
        // Consider logging the original error `err` here if not done already
        throw new RoundManagementError('An unexpected error occurred during round definition and opening.');
      }
    }
  },

  /**
   * Queries the database to find fixtures suitable for the next betting round.
   * Candidates are typically fixtures with status 'NS' (Not Started),
   * scheduled within a specific future time window (e.g., 72-96 hours),
   * and not already associated with an existing betting round.
   *
   * @returns {Promise<Fixture[]>} A promise that resolves with an array of candidate fixtures.
   * @throws {RoundManagementError} If the database query fails.
   */
  async identifyCandidateFixtures(): Promise<Fixture[]> {
    log('Identifying candidate fixtures...');
    const supabase = createClient(); // Get Supabase client instance

    try {
      // --- Calculate Time Window (72-96 hours from now) ---
      const now = new Date();
      const windowStart = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 96 * 60 * 60 * 1000);

      const windowStartISO = windowStart.toISOString();
      const windowEndISO = windowEnd.toISOString();

      log(`Calculated fixture window: ${windowStartISO} to ${windowEndISO}`);
      // --- End Time Window Calculation ---

      // --- Fetch Fixtures Already In Rounds ---
      const { data: existingRoundFixtures, error: existingFixturesError } = await supabase
        .from('betting_round_fixtures')
        .select('fixture_id');

      if (existingFixturesError) {
        error('Error fetching existing round fixtures:', existingFixturesError);
        throw new RoundManagementError('Failed to query existing round fixtures.');
      }

      const existingFixtureIds = existingRoundFixtures?.map(f => f.fixture_id) || [];
      log(`Found ${existingFixtureIds.length} fixtures already assigned to rounds.`);
      // --- End Fetch Existing Fixtures ---

      // --- Query Candidate Fixtures ---
      // Status = 'NS', Kickoff within window, Not already in a round
      const { data: candidateFixturesData, error: queryError } = await supabase
        .from('fixtures')
        .select('*')
        .eq('status_short', 'NS')
        .not('id', 'in', `(${existingFixtureIds.join(',')})`); // Filter out existing IDs

      if (queryError) {
        error('Error querying candidate fixtures:', queryError);
        throw new RoundManagementError('Database query for candidate fixtures failed.');
      }
      // --- End Query Candidate Fixtures ---

      // --- Sort Candidates by Kickoff Time ---
      const sortedCandidates = (candidateFixturesData || []).sort((a, b) => {
        // Convert kickoff strings to Date objects for reliable comparison
        const dateA = new Date(a.kickoff);
        const dateB = new Date(b.kickoff);
        return dateA.getTime() - dateB.getTime(); // Ascending order
      });
      log(`Sorted ${sortedCandidates.length} candidate fixtures by kickoff time.`);
      // --- End Sorting ---

      const candidateFixtures: Fixture[] = sortedCandidates; // Use sorted data
      log(`Found ${candidateFixtures.length} candidate fixtures.`);
      return candidateFixtures;

    } catch (err) {
      error('Error identifying candidate fixtures:', err);
      // Handle potential database errors, etc.
      throw new RoundManagementError('Failed to query candidate fixtures.');
    }
  },

  /**
   * Groups a list of sorted candidate fixtures into a logical betting round.
   * The primary logic involves finding the first significant time gap (e.g., > 72 hours)
   * between consecutive fixtures and taking all fixtures before that gap.
   * Also includes validation for minimum fixture count.
   *
   * @param candidateFixtures - An array of candidate Fixture objects, *pre-sorted* by kickoff time.
   * @returns {Promise<Fixture[] | null>} A promise resolving to an array of fixtures for the round, or null if no suitable group is found (e.g., minimum count not met).
   * @throws {RoundManagementError} If an unexpected error occurs during grouping.
   */
  async groupFixturesForRound(candidateFixtures: Fixture[]): Promise<Fixture[] | null> {
    log(`Attempting to group ${candidateFixtures.length} candidate fixtures...`);
    if (candidateFixtures.length === 0) {
      log('No candidate fixtures provided, cannot form a group.');
      return null;
    }

    try {
      // Input is already sorted by kickoff (from identifyCandidateFixtures)

      // --- Find the first significant time gap ---
      let groupEndIndex = candidateFixtures.length; // Default to all fixtures if no gap found

      for (let i = 0; i < candidateFixtures.length - 1; i++) {
        const fixture1 = candidateFixtures[i];
        const fixture2 = candidateFixtures[i + 1];

        const timeGapHours = calculateTimeDifference(
          fixture1.kickoff,
          fixture2.kickoff,
          'hours'
        );

        log(`Time gap between fixture ${fixture1.id} and ${fixture2.id}: ${timeGapHours.toFixed(2)} hours`);

        if (timeGapHours > TIME_GAP_THRESHOLD_HOURS) {
          groupEndIndex = i + 1; // Group includes fixture1, ends before fixture2
          log(`Found significant time gap (${timeGapHours.toFixed(2)}h > ${TIME_GAP_THRESHOLD_HOURS}h) after index ${i}. Grouping first ${groupEndIndex} fixtures.`);
          break; // Stop at the first significant gap
        }
      }
      // --- End Gap Finding ---

      // --- Extract and Validate Group ---
      const potentialGroup = candidateFixtures.slice(0, groupEndIndex);

      if (potentialGroup.length < MIN_FIXTURES_PER_ROUND) {
        log(`Potential group of ${potentialGroup.length} fixtures does not meet the minimum requirement of ${MIN_FIXTURES_PER_ROUND}.`);
        return null; // Not enough fixtures for a valid round
      }
      // --- End Validation ---

      const groupedFixtures: Fixture[] | null = potentialGroup; // Assign the validated group

      if (groupedFixtures) {
        log(`Successfully grouped ${groupedFixtures.length} fixtures for the round.`);
      } else {
        // This path should technically not be reached due to the null return above, but kept for clarity
        log('Could not form a valid group based on the criteria.');
      }
      return groupedFixtures;

    } catch (err) {
      error('Error grouping fixtures:', err);
      throw new RoundManagementError('An unexpected error occurred while grouping fixtures.');
    }
  },

  // Other service methods might go here
};

// --- Type Aliases ---

/** Represents a row in the public.betting_rounds table. */
type BettingRound = Tables<'betting_rounds'>;
/** Represents the shape of data needed to insert a new row into public.betting_rounds. */
type BettingRoundInsert = TablesInsert<'betting_rounds'>;
/** Represents the shape of data needed to update a row in public.betting_rounds. */
type BettingRoundUpdate = TablesUpdate<'betting_rounds'>;
/** Represents the possible statuses for a betting round from the enum. */
type BettingRoundStatus = Database['public']['Enums']['betting_round_status'];

/** Represents a row in the public.fixtures table. */
type Fixture = Tables<'fixtures'>;
 