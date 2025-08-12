import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/user-season-answers
 * 
 * Fetches the current user's season answers for pre-populating questionnaire forms.
 * Uses dual authentication (token + cookie fallback) to work across environments.
 * 
 * Returns:
 * - 200: Success with user season answers
 * - 401: Unauthorized (no user)
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Try to get auth from Authorization header first (for localStorage-based auth)
    const authHeader = request.headers.get('authorization');
    let user = null;
    let supabase = null;

    console.log('🔍 User Season Answers API: Auth header present:', !!authHeader);

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      console.log('🔍 User Season Answers API: Using token auth, token length:', token.length);
      
      // Create a supabase client with the token
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          },
          cookies: {
            get() { return undefined; },
          },
        }
      );

      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser();
      console.log('🔍 User Season Answers API: Token auth result - user:', !!tokenUser, 'error:', tokenError?.message);
      user = tokenUser;
    }

    // Fallback to cookie-based auth
    if (!user) {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore ? cookieStore.get(name)?.value : undefined;
            },
          },
        }
      );

      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      console.log('🔍 User Season Answers API: Cookie auth result - user:', !!cookieUser, 'error:', cookieError?.message);
      user = cookieUser;
    }

    if (!user) {
      console.log('🔍 User Season Answers API: No user found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 User Season Answers API: User authenticated:', user.email);

    // Get current season ID
    const { data: currentSeason, error: seasonError } = await supabase!
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .single();

    if (seasonError) {
      console.error('Error fetching current season:', seasonError);
      return NextResponse.json({ error: 'Could not find current season' }, { status: 500 });
    }

    if (!currentSeason) {
      return NextResponse.json({ 
        userSeasonAnswers: null,
        message: 'No current season found' 
      });
    }

    // Fetch user's season answers
    const { data: answersData, error: answersError } = await supabase!
      .from('user_season_answers')
      .select('question_type, answered_team_id, answered_player_id')
      .eq('user_id', user.id)
      .eq('season_id', currentSeason.id);

    if (answersError) {
      console.error('Error fetching user season answers:', answersError);
      return NextResponse.json({ error: 'Could not fetch user answers' }, { status: 500 });
    }

    // Transform the normalized rows into a formatted object
    const userSeasonAnswers: Record<string, number> = {};
    if (answersData && answersData.length > 0) {
      answersData.forEach((answer) => {
        const value = answer.answered_team_id || answer.answered_player_id;
        switch (answer.question_type) {
          case 'league_winner':
            userSeasonAnswers.league_winner = value;
            break;
          case 'top_scorer':
            userSeasonAnswers.top_scorer = value;
            break;
          case 'best_goal_difference':
            userSeasonAnswers.best_goal_difference = value;
            break;
          case 'last_place':
            userSeasonAnswers.last_place = value;
            break;
        }
      });
    }

    console.log('🔍 User Season Answers API: Found answers:', Object.keys(userSeasonAnswers).length);

    return NextResponse.json({
      userSeasonAnswers: Object.keys(userSeasonAnswers).length > 0 ? userSeasonAnswers : null,
      userId: user.id,
      seasonId: currentSeason.id
    });

  } catch (error) {
    console.error('User Season Answers API: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}