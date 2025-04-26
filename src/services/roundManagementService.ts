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
   * Orchestrates the entire process of:
   * 1. Checking for existing open rounds.
   * 2. Identifying candidate fixtures for the next betting round.
   * 3. Grouping those fixtures logically.
   * 4. Creating the new betting round in the database.
   * 5. Populating the link table between the round and its fixtures.
   * 
   * @throws {RoundManagementError} If any step in the process fails, including validation errors or database issues.
   * @returns {Promise<void>} A promise that resolves when the process completes successfully.
   */
  async defineAndOpenNextBettingRound(): Promise<void> {
    log('Attempting to define and open the next betting round...');
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
      // --- End Identification ---

      // --- 3. Group fixtures into a logical round (Task 3) ---
      log('Grouping fixtures...');
      const groupedFixtures = await this.groupFixturesForRound(candidateFixtures);
      if (!groupedFixtures) {
        log('Process stopped: Could not form a valid group of fixtures for the round.');
        return; // Exit if no valid group found
      }
      // --- End Grouping ---

      // --- 4. If a valid group exists, create the betting round (Task 5) ---
      log('Creating betting round...');
      // TODO: Implement betting round creation using groupedFixtures

      // --- 5. Populate the betting_round_fixtures table (Task 6) ---
      log('Populating round fixtures...');
      // TODO: Implement betting round fixture population

      log('Successfully defined and opened the next betting round.');

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
        .gte('kickoff', windowStartISO)
        .lte('kickoff', windowEndISO)
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
 