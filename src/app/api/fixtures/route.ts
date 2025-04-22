import { NextResponse } from 'next/server';
import { getFixturesForRound } from '@/lib/supabase/queries';

// Apply the conditional check here as well
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('server-only');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueIdParam = searchParams.get('league');
  const seasonYearParam = searchParams.get('season');
  const roundName = searchParams.get('round');

  // Basic validation
  if (!leagueIdParam || !seasonYearParam || !roundName) {
    return NextResponse.json(
      { error: 'Missing required query parameters: league, season, round' }, 
      { status: 400 }
    );
  }

  const leagueId = parseInt(leagueIdParam, 10);
  const seasonYear = parseInt(seasonYearParam, 10);

  if (isNaN(leagueId) || isNaN(seasonYear)) {
    return NextResponse.json(
      { error: 'Invalid league or season parameter. Must be numbers.' }, 
      { status: 400 }
    );
  }

  console.log(`API Route /api/fixtures: Fetching for league ${leagueId}, season ${seasonYear}, round "${roundName}"`);

  try {
    const matches = await getFixturesForRound(roundName, seasonYear, leagueId);

    if (matches === null) {
      // This indicates an error occurred within getFixturesForRound
      return NextResponse.json(
        { error: 'Failed to fetch fixtures from database' }, 
        { status: 500 } 
      );
    }

    // Return the successfully fetched matches
    return NextResponse.json(matches);

  } catch (error: unknown) {
    console.error('Error in /api/fixtures route:', error);
    // Type check before accessing message
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error fetching fixtures', details: message }, 
      { status: 500 } 
    );
  }
} 