import { NextResponse } from 'next/server';
import { populateFixturesForSeason } from '@/lib/populate-db';
import 'server-only';

// Simple API route to trigger the database population manually.
// In a real application, this should be protected (e.g., admin only)
// or triggered by a secure mechanism like a cron job or webhook.
export async function GET() {
  console.log('API route /api/populate-fixtures called.');

  // Example: Populate Premier League 2024/25
  const leagueId = 39;
  const seasonYear = 2024;

  try {
    // We run this asynchronously but don't necessarily wait for it here.
    // The console logs in populateFixturesForSeason will show progress.
    // For a real job, you might want better status reporting or use a background queue.
    populateFixturesForSeason(leagueId, seasonYear);

    console.log(`Triggered population for league ${leagueId}, season ${seasonYear}. Check server console for progress.`);

    return NextResponse.json({
      message: `Triggered population for league ${leagueId}, season ${seasonYear}. Check server console for progress.`,
    }, { status: 202 }); // 202 Accepted indicates the process has started

  } catch (error: unknown) {
    console.error('Error triggering population route:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to trigger population', details: message },
      { status: 500 }
    );
  }
} 