import { NextResponse } from 'next/server';
import { syncFixturesForActiveSeason } from '@/services/sync/syncFixtures';

export async function GET(request: Request) {
  // Recommended security: Check for Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron access attempt');
    return new NextResponse('Unauthorized', {
      status: 401,
    });
  }

  console.log('Starting scheduled fixture sync via API route...');

  try {
    // Call the main sync function directly
    const result = await syncFixturesForActiveSeason();
    console.log('Scheduled sync finished:', result.message);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message, details: result.details });
    } else {
      // Return 500 for cron job failures to indicate issues
      return NextResponse.json(
        { success: false, message: result.message, details: result.details }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Critical error in scheduled sync API route:', error);
    return NextResponse.json(
        { success: false, message: 'Cron handler encountered a critical error.', details: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
      );
  }
} 