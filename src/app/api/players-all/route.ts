import { NextResponse } from 'next/server';
import { supabaseServerClient } from '@/lib/supabase/server';

// This endpoint fetches ALL players for season questions (like top scorer)
// Unlike /api/players, it doesn't require players to have played games

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

  try {
    console.log(`API Route /api/players-all: Fetching all players for league ${leagueId}, year ${seasonYear}...`);
    
    // For Premier League (league ID 39), we'll filter by recently updated players
    if (leagueId === 39 && seasonYear === 2025) {
      // Since we just updated PL players, we can use the last_api_update timestamp
      // Players updated after August 17, 2025 are the PL players we just added
      const updateCutoff = '2025-08-17T00:00:00';
      
      const { data: players, error } = await supabaseServerClient
        .from('players')
        .select('id, api_player_id, name, firstname, lastname, last_api_update')
        .gte('last_api_update', updateCutoff)
        .order('name');
      
      if (error) {
        console.error('Error fetching Premier League players:', error);
        return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
      }
      
      console.log(`Found ${players?.length || 0} Premier League players (updated after ${updateCutoff})`);
      
      // Format players for the frontend
      const formattedPlayers = players?.map(player => ({
        id: player.id,
        name: player.name || `${player.firstname} ${player.lastname}`.trim()
      })) || [];
      
      return NextResponse.json(formattedPlayers);
    }
    
    // For other leagues, return all players (existing behavior)
    const query = supabaseServerClient
      .from('players')
      .select('id, api_player_id, name, firstname, lastname')
      .order('name');
    
    const { data: players, error } = await query;
    
    if (error) {
      console.error('Error fetching players:', error);
      return NextResponse.json({ error: 'Failed to fetch players from database' }, { status: 500 });
    }
    
    // Format players for the frontend
    const formattedPlayers = players?.map(player => ({
      id: player.id,
      name: player.name || `${player.firstname} ${player.lastname}`.trim()
    })) || [];
    
    console.log(`API Route /api/players-all: Returning ${formattedPlayers.length} players`);
    return NextResponse.json(formattedPlayers);
    
  } catch (error: unknown) {
    console.error('Error in /api/players-all route:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Internal server error fetching players', details: message }, { status: 500 });
  }
}