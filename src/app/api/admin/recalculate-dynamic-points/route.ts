import { NextRequest, NextResponse } from 'next/server';
import { processAndStoreDynamicPointsForRound } from '@/lib/scoring';
import { supabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { roundId } = await request.json();
    
    if (!roundId) {
      return NextResponse.json({ error: 'Round ID is required' }, { status: 400 });
    }
    
    console.log(`Recalculating dynamic points for round ${roundId}...`);
    
    // Clear existing dynamic points for this round
    await supabaseServerClient
      .from('user_round_dynamic_points')
      .delete()
      .eq('betting_round_id', roundId);
    
    // Use the proper function to calculate dynamic points
    const result = await processAndStoreDynamicPointsForRound(
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
    console.error('Error in recalculate-dynamic-points:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}