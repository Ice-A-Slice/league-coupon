import { NextRequest, NextResponse } from 'next/server';
import { processAndStoreDynamicPointsForRound } from '@/lib/scoring';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { roundId } = await request.json();
    
    // Create a proper service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ 
        error: 'Server configuration error - missing credentials' 
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    if (roundId === null || roundId === undefined) {
      // Recalculate for all scored rounds in competition 1, season 2025
      console.log('Recalculating dynamic points for all scored rounds in competition 1, season 2025...');
      
      // First, get the current season with explicit competition 1 and year 2025
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('competition_id, api_season_year')
        .eq('is_current', true)
        .eq('competition_id', 1)
        .eq('api_season_year', 2025)
        .single();
        
      if (seasonError || !currentSeason) {
        console.error('Error fetching current season:', seasonError);
        return NextResponse.json({ 
          error: `Failed to fetch current season: ${seasonError?.message || 'No current season found'}` 
        }, { status: 500 });
      }
      
      // Get scored rounds for competition 1 only
      const { data: scoredRounds, error: roundsError } = await supabase
        .from('betting_rounds')
        .select('id')
        .eq('status', 'scored')
        .eq('competition_id', 1)
        .order('id', { ascending: true });
        
      if (roundsError) {
        console.error('Error fetching scored rounds:', roundsError);
        return NextResponse.json({ 
          error: `Failed to fetch scored rounds: ${roundsError.message}` 
        }, { status: 500 });
      }
      
      if (!scoredRounds || scoredRounds.length === 0) {
        return NextResponse.json({ 
          success: true,
          message: 'No scored rounds found to recalculate',
          details: { roundsProcessed: 0, usersUpdated: 0 }
        });
      }
      
      // Clear existing dynamic points for competition 1 rounds
      console.log(`Clearing existing dynamic points for ${scoredRounds.length} scored rounds in competition 1...`);
      const { error: deleteError } = await supabase
        .from('user_round_dynamic_points')
        .delete()
        .in('betting_round_id', scoredRounds.map(r => r.id));
        
      if (deleteError) {
        console.error('Error clearing all existing points:', deleteError);
        return NextResponse.json({ 
          error: `Failed to clear existing points: ${deleteError.message}` 
        }, { status: 500 });
      }
      
      // Recalculate for each scored round
      let totalUsersUpdated = 0;
      let successfulRounds = 0;
      
      for (const round of scoredRounds) {
        try {
          console.log(`Processing round ${round.id}...`);
          const result = await processAndStoreDynamicPointsForRound(round.id, supabase);
          
          if (result.success) {
            totalUsersUpdated += result.details?.usersUpdated || 0;
            successfulRounds++;
          } else {
            console.error(`Failed to process round ${round.id}:`, result.message);
          }
        } catch (error) {
          console.error(`Error processing round ${round.id}:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Processed ${successfulRounds}/${scoredRounds.length} scored rounds successfully`,
        details: { 
          roundsProcessed: successfulRounds,
          totalRounds: scoredRounds.length,
          usersUpdated: totalUsersUpdated 
        }
      });
      
    } else {
      // Recalculate for a specific round
      console.log(`Recalculating dynamic points for round ${roundId}...`);
      
      // Clear existing dynamic points for this round
      const { error: deleteError } = await supabase
        .from('user_round_dynamic_points')
        .delete()
        .eq('betting_round_id', roundId);
        
      if (deleteError) {
        console.error('Error clearing existing points:', deleteError);
        return NextResponse.json({ 
          error: `Failed to clear existing points: ${deleteError.message}` 
        }, { status: 500 });
      }
      
      // Use the proper function to calculate dynamic points
      const result = await processAndStoreDynamicPointsForRound(roundId, supabase);
      
      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          message: result.message,
          details: result.details 
        });
      } else {
        console.error('Recalculation failed:', result.message, result.details);
        return NextResponse.json({ 
          success: false, 
          message: result.message,
          error: result.details?.error || result.message
        }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error('Error in recalculate-dynamic-points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${errorMessage}`
    }, { status: 500 });
  }
}