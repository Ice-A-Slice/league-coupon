import { NextResponse } from 'next/server';
import { calculateStandings } from '@/services/standingsService'; // Adjust path if needed
// import { logger } from '@/utils/logger';

// Ensure the route is treated as dynamic to prevent caching issues
// if standings need to be real-time or frequently updated.
// Use 'force-dynamic' or revalidate options depending on caching strategy.
export const dynamic = 'force-dynamic';

/**
 * GET handler for the /api/standings endpoint.
 * Fetches the calculated standings including game points, dynamic points,
 * combined score, and rank.
 */
export async function GET() {
  const loggerContext = { api: '/api/standings', method: 'GET' };
  // logger.info(loggerContext, 'Standings request received.');
  console.log('[INFO]', loggerContext, 'Standings request received.');

  try {
    const standings = await calculateStandings();

    if (standings === null) {
      // Log the specific reason if standingsService provides more details
      // logger.error(loggerContext, 'Standings calculation failed in the service layer.');
      console.error('[ERROR]', loggerContext, 'Standings calculation failed in the service layer.');
      return NextResponse.json(
        { error: 'Failed to calculate standings.' },
        { status: 500 }
      );
    }

    // logger.info(loggerContext, `Successfully calculated and returning ${standings.length} standing entries.`);
    console.log('[INFO]', loggerContext, `Successfully calculated and returning ${standings.length} standing entries.`);
    return NextResponse.json(standings, { status: 200 });

  } catch (error) {
    // logger.error({ ...loggerContext, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Unexpected error fetching standings.');
    console.error('[ERROR]', { ...loggerContext, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Unexpected error fetching standings.');
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}