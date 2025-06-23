import { NextResponse } from 'next/server';
import { populateFixturesForSeason } from '@/lib/populate-db';

export async function GET(request: Request) {
  // Security: Check for a specific manual trigger secret
  const authHeader = request.headers.get('authorization');
  if (!process.env.MANUAL_SYNC_SECRET || authHeader !== `Bearer ${process.env.MANUAL_SYNC_SECRET}`) {
    console.warn('Unauthorized manual populate trigger attempt');
    return new NextResponse('Unauthorized', {
      status: 401,
    });
  }

  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get('leagueId');
  const seasonYear = searchParams.get('seasonYear');

  if (!leagueId || !seasonYear) {
    return new NextResponse('Missing required query parameters: leagueId and seasonYear', {
      status: 400,
    });
  }

  const leagueIdNum = parseInt(leagueId, 10);
  const seasonYearNum = parseInt(seasonYear, 10);

  if (isNaN(leagueIdNum) || isNaN(seasonYearNum)) {
    return new NextResponse('Invalid query parameters: leagueId and seasonYear must be numbers.', {
      status: 400,
    });
  }

  console.log(`Starting MANUALLY TRIGGERED season population via API route for league ${leagueIdNum}, season ${seasonYearNum}...`);

  try {
    // Call the main population function
    await populateFixturesForSeason(leagueIdNum, seasonYearNum);
    const message = `Successfully populated data for league ${leagueIdNum}, season ${seasonYearNum}.`;
    console.log(message);
    
    return NextResponse.json({ success: true, message });

  } catch (error) {
    console.error(`Critical error in manual population API route for league ${leagueIdNum}:`, error);
    return NextResponse.json(
        { success: false, message: 'Manual population handler encountered a critical error.', details: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
      );
  }
} 