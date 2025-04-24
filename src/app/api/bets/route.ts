import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Represents the structure of a single bet submission within the request payload.
 */
interface BetSubmission {
  /** The unique identifier for the fixture (match) the bet is placed on. */
  fixture_id: number;
  /** The predicted outcome ('1' for home win, 'X' for draw, '2' for away win). */
  prediction: '1' | 'X' | '2'; // Use literal types matching the ENUM
}

/**
 * Represents the expected structure of the request body for the POST /api/bets endpoint.
 * It should be an array of `BetSubmission` objects.
 */
type BetSubmissionPayload = BetSubmission[];

/**
 * Handles POST requests to /api/bets for submitting user bets for a specific round.
 * 
 * This handler performs the following steps:
 * 1. **Authentication:** Verifies the user is logged in using Supabase auth.
 * 2. **Request Parsing:** Parses the JSON request body, expecting an array of `BetSubmission` objects.
 * 3. **Locking Check:** Determines the round based on the first fixture ID and checks if the 
 *    earliest kickoff time for that round has passed. If it has, the submission is rejected (403).
 * 4. **Data Preparation:** Formats the received submissions into the structure required for the `user_bets` table upsert.
 * 5. **Database Upsert:** Upserts the bets into the `user_bets` table using Supabase, 
 *    handling conflicts based on `user_id` and `fixture_id`.
 * 6. **Response:** Returns a success message (200) or an appropriate error response (400, 401, 403, 404, 500).
 *
 * @param {Request} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a Next.js response object.
 */
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
  // Use getUser() for stronger server-side authentication check
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  // const { data: { session }, error: sessionError } = await supabase.auth.getSession(); // Old method

  // Adjust check for user object and userError
  if (userError || !user) { 
    // console.error('Error getting session or no user found:', sessionError); // Old check
    console.error('Error getting user or no user found:', userError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get userId from the user object
  // const userId = session.user.id; // Old way
  const userId = user.id;
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