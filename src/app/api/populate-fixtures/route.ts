import { NextResponse } from 'next/server';
import { populateFixturesForSeason } from '@/lib/populate-db';
import 'server-only';

// Simple API route to trigger the database population manually.
// In a real application, this should be protected (e.g., admin only)
// or triggered by a secure mechanism like a cron job or webhook.
export async function GET() {
  console.log('API route /api/populate-fixtures called.');

  // Populate Premier League 2025/26
  const leagueId = 39;
  const seasonYear = 2025;

  try {
    console.log(`🚀 Starting population for league ${leagueId}, season ${seasonYear}...`);
    
    // Run asynchronously to avoid Vercel timeout, but logs will show progress
    populateFixturesForSeason(leagueId, seasonYear).then(() => {
      console.log(`✅ Population completed for league ${leagueId}, season ${seasonYear}.`);
    }).catch((error) => {
      console.error(`❌ Population failed for league ${leagueId}, season ${seasonYear}:`, error);
    });

    return NextResponse.json({
      message: `Population started for league ${leagueId}, season ${seasonYear}. Check server logs for progress.`,
      success: true
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