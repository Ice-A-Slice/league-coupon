import { NextResponse } from 'next/server';
import { syncFixturesForActiveSeason } from '@/services/sync/syncFixtures';

export async function GET(request: Request) {
  // Security: Check for a specific manual trigger secret
  const authHeader = request.headers.get('authorization');
  if (!process.env.MANUAL_SYNC_SECRET || authHeader !== `Bearer ${process.env.MANUAL_SYNC_SECRET}`) {
    console.warn('Unauthorized manual sync trigger attempt');
    return new NextResponse('Unauthorized', {
      status: 401,
    });
  }

  console.log('Starting MANUALLY TRIGGERED fixture sync via API route...');

  try {
    // Call the main sync function
    const result = await syncFixturesForActiveSeason();
    console.log('Manually triggered sync finished:', result.message);

    if (result.success) {
      // Return 200 OK on success
      return NextResponse.json({ success: true, message: result.message, details: result.details });
    } else {
      // Return 500 even for manual trigger if sync fails
      return NextResponse.json(
        { success: false, message: result.message, details: result.details }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Critical error in manual sync API route:', error);
    return NextResponse.json(
        { success: false, message: 'Manual sync handler encountered a critical error.', details: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
      );
  }
} 