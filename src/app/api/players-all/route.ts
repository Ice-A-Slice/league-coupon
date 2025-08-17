import { NextResponse } from 'next/server';
import { supabaseServerClient } from '@/lib/supabase/server';

// This endpoint fetches ALL players for season questions (like top scorer)
// Unlike /api/players, it doesn't require players to have played games

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueIdParam = searchParams.get('league');
  const seasonYearParam = searchParams.get('season');
  const positionParam = searchParams.get('position'); // Optional filter

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
    
    // For Premier League 2025, fetch all players
    // In production, you might want to filter by:
    // - Players in teams that are in the league for this season
    // - Players with certain positions (e.g., only attackers for top scorer)
    
    const query = supabaseServerClient
      .from('players')
      .select('id, api_player_id, name, firstname, lastname')
      .order('name');
    
    // If position filter is provided (e.g., for top scorer question)
    // This would require a position column or join with player_team_seasons
    if (positionParam === 'attacker') {
      // For now, return all players since we don't have position data in players table
      // In production, you'd filter by position
      console.log('Note: Position filtering not implemented yet');
    }
    
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