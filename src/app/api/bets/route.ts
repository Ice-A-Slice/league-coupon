import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Define the expected structure for a single bet submission
interface BetSubmission {
  fixture_id: number;
  prediction: '1' | 'X' | '2'; // Use literal types matching the ENUM
}

// Define the expected request body structure
type BetSubmissionPayload = BetSubmission[];

export async function POST(request: Request) {
  // await needed to resolve type inference issue for cookieStore during build
  const cookieStore = await cookies();

  // Define cookie methods beforehand
  const cookieMethods = {
      get(name: string) {
          return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
          try {
              cookieStore.set({ name, value, ...options });
          } catch (error) {
              // Handle read-only cookies error (e.g., in Route Handler)
              console.error("Error setting cookie in Route Handler:", error); // Uncomment error log
          }
      },
      remove(name: string, options: CookieOptions) {
          try {
              cookieStore.set({ name, value: '', ...options });
          } catch (error) {
              // Handle read-only cookies error
              console.error("Error removing cookie in Route Handler:", error); // Uncomment error log
          }
      },
  };

  // Create client using the pattern from @supabase/ssr docs for Route Handlers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Pass the pre-defined methods
      cookies: cookieMethods,
    }
  );

  // 1. Check Authentication
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    console.error('Error getting session or no user found:', sessionError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  console.log(`User ${userId} attempting to submit bets.`);

  // 2. Parse Request Body (Basic)
  let submissions: BetSubmissionPayload;
  try {
    submissions = await request.json();
    if (!Array.isArray(submissions) || submissions.length === 0) {
       return NextResponse.json({ error: 'Invalid request body. Expected a non-empty array of bets.' }, { status: 400 });
    }
    // TODO: Add more robust validation (e.g., Zod)
  } catch {
    return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
  }

  console.log(`Received ${submissions.length} bet submissions from user ${userId}.`);

  // Declare roundId variable accessible to later scopes
  let roundId: number | null = null;

  // 3. Locking Check
  try {
    // Assume all submissions are for the same round, check the first fixture
    const firstFixtureId = submissions[0].fixture_id;

    // Get the round_id for the first fixture
    const { data: fixtureData, error: fixtureError } = await supabase
      .from('fixtures')
      .select('round_id')
      .eq('id', firstFixtureId)
      .single();

    if (fixtureError || !fixtureData) {
      console.error(`Locking Check Error: Fixture ${firstFixtureId} not found or error fetching:`, fixtureError);
      return NextResponse.json({ error: `Fixture with ID ${firstFixtureId} not found.` }, { status: 404 });
    }

    // Assign roundId here
    roundId = fixtureData.round_id;
    if (!roundId) {
         console.error(`Locking Check Error: Fixture ${firstFixtureId} missing round_id.`);
         return NextResponse.json({ error: 'Internal server error: Fixture data incomplete.' }, { status: 500 });
    }

    // Find the earliest kickoff time for this round
    const { data: roundKickoffData, error: kickoffError } = await supabase
      .from('fixtures')
      .select('kickoff')
      .eq('round_id', roundId)
      .order('kickoff', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (kickoffError) {
         console.error(`Locking Check Error: Could not fetch kickoff for round ${roundId}:`, kickoffError);
         return NextResponse.json({ error: 'Internal server error: Could not verify round kickoff.' }, { status: 500 });
    }

    if (!roundKickoffData?.kickoff) {
        // This could happen if a round exists but has no fixtures yet
        console.warn(`Locking Check: No kickoff time found for round ${roundId}. Allowing submission.`);
        // Proceed without locking in this edge case, or decide on specific handling
    } else {
        const minKickoffTime = new Date(roundKickoffData.kickoff);
        const now = new Date();

        console.log(`Round ${roundId} kickoff: ${minKickoffTime.toISOString()}, Current time: ${now.toISOString()}`);

        if (now >= minKickoffTime) {
          console.log(`User ${userId} submission rejected: Round ${roundId} has already started.`);
          return NextResponse.json({ error: 'Cannot submit bets, the round has already started.' }, { status: 403 });
        }
        console.log(`Round ${roundId} is open for betting. Proceeding...`);
    }

  } catch (e) {
      console.error('Error during locking check:', e);
      return NextResponse.json({ error: 'Internal server error during submission validation.' }, { status: 500 });
  }

  // Check if roundId was successfully assigned before proceeding
  if (roundId === null) {
     console.error('Critical Error: roundId is null after locking check. Aborting upsert.');
     return NextResponse.json({ error: 'Internal server error processing request.'}, { status: 500 });
  }

  // 4. Prepare data for Upsert
  const upsertData = submissions.map(sub => ({
    user_id: userId,
    fixture_id: sub.fixture_id,
    prediction: sub.prediction, // Ensure this matches the ENUM ('1', 'X', '2')
    round_id: roundId, // Use the determined roundId
    submitted_at: new Date().toISOString(), // Explicitly set submission time for all upserted rows
  }));

  // 5. Perform Upsert using supabase client
  try {
    console.log(`Upserting ${upsertData.length} bets for user ${userId}, round ${roundId}...`);
    const { error: upsertError } = await supabase
      .from('user_bets')
      .upsert(upsertData, {
        onConflict: 'user_id, fixture_id' // Explicitly tell Supabase which columns cause the conflict
      });
      // Supabase handles conflict on UNIQUE(user_id, fixture_id) automatically

    if (upsertError) {
      console.error(`Error upserting bets for user ${userId}:`, upsertError);
      if (upsertError.code === '23503') { // Foreign key violation
           return NextResponse.json({ error: 'Invalid fixture ID provided.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to save bets to database.' }, { status: 500 });
    }

    console.log(`Successfully saved bets for user ${userId}, round ${roundId}.`);

    // 6. Return success response
    return NextResponse.json({ message: 'Bets submitted successfully!' }, { status: 200 });

  } catch (e) {
      console.error('Unexpected error during upsert:', e);
      return NextResponse.json({ error: 'Internal server error saving bets.' }, { status: 500 });
  }
} 