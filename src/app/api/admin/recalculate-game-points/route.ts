import { NextRequest, NextResponse } from 'next/server';
import { calculateAndStoreMatchPoints } from '@/lib/scoring';
import { supabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { roundId } = await request.json();
    
    if (!roundId) {
      return NextResponse.json({ error: 'Round ID is required' }, { status: 400 });
    }
    
    console.log(`Recalculating game points for round ${roundId}...`);
    
    // Use the proper function to calculate match points
    const result = await calculateAndStoreMatchPoints(
      roundId,
      supabaseServerClient
    );
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: result.message,
        details: result.details 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: result.message,
        error: result.details?.error 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in recalculate-game-points:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}