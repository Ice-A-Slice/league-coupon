import 'server-only'; // Ensure this is server-side

import { supabaseServerClient } from '@/lib/supabase/server';
// import type { Tables } from '@/types/supabase'; // Removed unused import
import { logger } from '@/utils/logger';

// Define the set of fixture statuses considered 'finished'
const FINISHED_FIXTURE_STATUSES: ReadonlySet<string> = new Set([
    'FT', // Finished
    'AET', // Finished after extra time
    'PEN' // Finished after penalties
    // Add other statuses if needed (e.g., awarded, cancelled but counts as finished for round?)
]);

class RoundCompletionDetectorService {
    /**
     * Checks all 'open' betting rounds and updates the status of those
     * where all associated fixtures are finished.
     * @returns {Promise<{ completedRoundIds: number[], errors: Error[] }>} - IDs of rounds updated to 'scoring' and any errors encountered.
     */
    async detectAndMarkCompletedRounds(): Promise<{ completedRoundIds: number[], errors: Error[] }> {
        logger.info('Starting round completion detection...');
        const completedRoundIds: number[] = [];
        const errors: Error[] = [];

        try {
            // 1. Fetch all 'open' betting rounds
            const { data: openRounds, error: openRoundsError } = await supabaseServerClient
                .from('betting_rounds')
                .select('id')
                .eq('status', 'open');

            if (openRoundsError) {
                logger.error({ error: openRoundsError }, 'Error fetching open betting rounds');
                errors.push(new Error(`Failed to fetch open rounds: ${openRoundsError.message}`));
                // Decide if we should continue or return early depending on severity
                return { completedRoundIds, errors }; 
            }

            if (!openRounds || openRounds.length === 0) {
                logger.info('No open betting rounds found.');
                return { completedRoundIds, errors };
            }

            logger.info(`Found ${openRounds.length} open betting rounds to check.`);

            // 2. Check each round for completion
            for (const round of openRounds) {
                try {
                    const roundId = round.id;
                    const isComplete = await this.isRoundComplete(roundId);

                    if (isComplete) {
                        logger.info(`Betting round ${roundId} detected as complete. Marking for scoring.`);
                        // 3. Mark the round for scoring
                        const { error: updateError } = await supabaseServerClient
                            .from('betting_rounds')
                            .update({ status: 'scoring' }) // Or 'ready_for_scoring'
                            .eq('id', roundId);

                        if (updateError) {
                            logger.error({ error: updateError, roundId }, 'Error updating round status to scoring');
                            errors.push(new Error(`Failed to update round ${roundId} status: ${updateError.message}`));
                        } else {
                            logger.info(`Successfully marked round ${roundId} for scoring.`);
                            completedRoundIds.push(roundId);
                        }
                    }
                } catch (roundCheckError: unknown) {
                     logger.error({ error: roundCheckError, roundId: round.id }, 'Error checking completion for round');
                     const message = roundCheckError instanceof Error ? roundCheckError.message : String(roundCheckError);
                     errors.push(new Error(`Error processing round ${round.id}: ${message}`));
                }
            }

        } catch (error: unknown) {
            logger.error({ error }, 'Unexpected error during round completion detection process.');
            const message = error instanceof Error ? error.message : String(error);
            errors.push(new Error(`Unexpected error: ${message}`));
        }

        logger.info(`Round completion detection finished. Marked ${completedRoundIds.length} rounds for scoring.`);
        if (errors.length > 0) {
             logger.warn(`Encountered ${errors.length} errors during the process.`);
        }

        return { completedRoundIds, errors };
    }

    /**
     * Checks if a specific betting round is complete by verifying all its fixtures are finished.
     * @param {number} roundId - The ID of the betting round to check.
     * @returns {Promise<boolean>} - True if all fixtures are finished, false otherwise.
     * @throws {Error} If fixtures cannot be fetched or processed.
     */
    private async isRoundComplete(roundId: number): Promise<boolean> {
        logger.debug(`Checking completion status for round ${roundId}...`);

        // Fetch associated fixture IDs from the join table
        const { data: roundFixturesLink, error: linkError } = await supabaseServerClient
            .from('betting_round_fixtures')
            .select('fixture_id')
            .eq('betting_round_id', roundId);

        if (linkError) {
            logger.error({ error: linkError, roundId }, 'Error fetching fixture links for round');
            throw new Error(`Failed to fetch fixture links for round ${roundId}: ${linkError.message}`);
        }

        if (!roundFixturesLink || roundFixturesLink.length === 0) {
            logger.warn({ roundId }, 'No fixtures found linked to this round. Considering it incomplete.');
            // Or should an empty round be considered complete? Decide business logic.
            // For now, assume incomplete if no fixtures.
            return false;
        }

        const fixtureIds = roundFixturesLink.map(link => link.fixture_id);
        logger.debug({ roundId, fixtureCount: fixtureIds.length }, `Found ${fixtureIds.length} fixtures linked to round.`);

        // Fetch the actual fixtures to check their status
        const { data: fixtures, error: fixtureError } = await supabaseServerClient
            .from('fixtures')
            .select('status_short')
            .in('id', fixtureIds);

        if (fixtureError) {
             logger.error({ error: fixtureError, roundId }, 'Error fetching fixture details for round');
             throw new Error(`Failed to fetch fixture details for round ${roundId}: ${fixtureError.message}`);
        }

        if (!fixtures || fixtures.length !== fixtureIds.length) {
             logger.warn({ roundId, expected: fixtureIds.length, actual: fixtures?.length ?? 0 }, 'Mismatch between linked fixtures and fetched fixture details. Potential data inconsistency.');
             // Handle this case - perhaps throw an error or log and consider incomplete?
             // For now, consider incomplete if mismatch.
             return false;
        }

        // Check if ALL fetched fixtures have a finished status
        const allFinished = fixtures.every(fixture =>
            fixture.status_short && FINISHED_FIXTURE_STATUSES.has(fixture.status_short)
        );

        logger.debug({ roundId, allFinished }, `Round completion check result: ${allFinished}`);
        return allFinished;
    }
}

// Export an instance of the service
export const roundCompletionDetectorService = new RoundCompletionDetectorService(); 