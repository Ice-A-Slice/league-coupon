import { NextResponse } from 'next/server';
import { getTeamsForSeason } from '@/lib/supabase/queries';
import { supabaseServerClient } from '@/lib/supabase/server';

// Add the conditional server-only check for the test environment
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('server-only');
}

// Helper function to find seasonId (can be moved to queries.ts later if reused)
async function findSeasonId(leagueApiId: number, seasonYear: number): Promise<number | null> {
  const { data: seasonData, error } = await supabaseServerClient
    .from('seasons')
    .select('id, competition:competitions!inner(api_league_id)')
    .eq('api_season_year', seasonYear)
    .eq('competition.api_league_id', leagueApiId)
    .single(); // Expect only one season matching league and year

  if (error) {
    console.error(`Error finding season ID for league ${leagueApiId}, year ${seasonYear}:`, error);
    return null;
  }
  if (!seasonData) {
    console.warn(`Could not find season ID for league ${leagueApiId}, year ${seasonYear}`);
    return null;
  }
  return seasonData.id;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueIdParam = searchParams.get('league');
  const seasonYearParam = searchParams.get('season');

  if (!leagueIdParam || !seasonYearParam) {
    return NextResponse.json({ error: 'Missing league or season query parameter' }, { status: 400 });
  }

  const leagueId = parseInt(leagueIdParam, 10);
  const seasonYear = parseInt(seasonYearParam, 10);

  if (isNaN(leagueId) || isNaN(seasonYear)) {
    return NextResponse.json({ error: 'Invalid league or season parameter' }, { status: 400 });
  }

  console.log(`API Route /api/teams: Finding season ID for league ${leagueId}, year ${seasonYear}...`);
  const seasonId = await findSeasonId(leagueId, seasonYear);

  if (seasonId === null) {
    return NextResponse.json({ error: `Season not found in database for league ${leagueId}, year ${seasonYear}` }, { status: 404 });
  }

  console.log(`API Route /api/teams: Found season ID ${seasonId}. Fetching teams...`);
  try {
    const teams = await getTeamsForSeason(seasonId);
    if (teams === null) {
      return NextResponse.json({ error: 'Failed to fetch teams from database' }, { status: 500 });
    }
    return NextResponse.json(teams);
  } catch (error: unknown) {
    console.error('Error in /api/teams route:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Internal server error fetching teams', details: message }, { status: 500 });
  }
} 