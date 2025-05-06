import { NextResponse } from 'next/server';
import { calculateAndStoreMatchPoints, ScoreCalculationResult } from '@/lib/scoring'; // Assuming path and ScoreCalculationResult is exported
import { logger } from '@/utils/logger'; // Assuming path
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service'; // Reverted path
import { RoundCompletionDetectorService } from '@/services/roundCompletionDetectorService'; // Import class
import { revalidatePath } from 'next/cache'; // Import revalidatePath

// Defined a specific type for the results array
interface ProcessingResult extends ScoreCalculationResult {
  roundId: number;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startTime = Date.now(); // Define startTime here
  logger.info("Starting round processing cron job...");

  // Authenticate Cron job
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     logger.error("Unauthorized attempt to run cron job.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Declare variables needed in the try block scope
  let detectedRoundIds: number[] = [];
  let detectionErrors: Error[] = [];

  try {
    // Initialize Supabase service role client
    // No type argument needed as the function returns the typed client
    const serviceRoleClient = getSupabaseServiceRoleClient(); 

    // 1. Detect and Mark Completed Rounds
    // Instantiate the service correctly (assuming constructor takes no args now)
    const detectorService = new RoundCompletionDetectorService(); 
    logger.info('Starting scheduled round processing via detector service...');
    
    // Call the detection method
    const detectionResult = await detectorService.detectAndMarkCompletedRounds();

    // Destructure the results
    detectedRoundIds = detectionResult.completedRoundIds;
    detectionErrors = detectionResult.errors;

    // Log any errors during detection/marking
    if (detectionErrors && detectionErrors.length > 0) {
        logger.warn({ errors: detectionErrors.map((e: Error) => e.message) }, "Errors occurred during round completion detection/marking.");
    }

    if (detectedRoundIds.length === 0) {
      logger.info("No completed rounds found to process.");
      return NextResponse.json({ success: true, message: "No completed rounds found to process." });
    }

    logger.info({ rounds: detectedRoundIds }, `Found ${detectedRoundIds.length} rounds marked for processing.`);

    // 5. Process Each Completed Round
    const results: ProcessingResult[] = []; // Use the new combined type
    // Re-use the service role client for scoring
    const scoringClient = serviceRoleClient; 
    let successfullyProcessedAtLeastOneRound = false;
    for (const roundId of detectedRoundIds) {
      logger.info({ roundId }, "Processing scoring for round...");
      // Pass the client instance needed for scoring
      const scoringResult = await calculateAndStoreMatchPoints(roundId, scoringClient); 
      results.push({ roundId, ...scoringResult }); // Ensure roundId is included
      if (!scoringResult.success) {
        logger.error({ roundId, error: scoringResult.details?.error }, `Scoring failed for round.`);
        // Continue processing other rounds even if one fails, but log the error
      } else {
         // Log the number of bets updated instead of pointsAwarded
         logger.info({ roundId, betsUpdated: scoringResult.details?.betsUpdated }, `Successfully scored round.`);
         successfullyProcessedAtLeastOneRound = true;
      }
    }

    if (successfullyProcessedAtLeastOneRound) {
      try {
        revalidatePath('/'); // Revalidate the root page
        logger.info('[process-rounds] Cache revalidation triggered for path: /');
      } catch (revalError) {
        logger.error('[process-rounds] Error during cache revalidation:', revalError);
      }
    }

    const duration = Date.now() - startTime;
    logger.info({ durationMs: duration, processedCount: detectedRoundIds.length }, "Round processing finished.");

    // 6. Return Success Response
    return NextResponse.json({ 
        success: true, 
        message: `Processed ${detectedRoundIds.length} rounds.`, 
        results 
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Critical error in scheduled round processing API route.');
    // Return 500 for cron job failures
    return NextResponse.json(
        { success: false, message: 'Cron handler encountered a critical error.', details: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
    );
  }
} 