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

  // --- Refactored: Find Betting Round, Validate Status & Deadline (Task related fix) ---
  let bettingRoundId: number;
  let bettingRoundStatus: string;
  let bettingRoundDeadline: Date;

  try {
    const submittedFixtureIds = [...new Set(submissions.map(sub => sub.fixture_id))];
    if (submittedFixtureIds.length === 0) {
        return NextResponse.json({ error: 'No fixture IDs found in submission.' }, { status: 400 });
    }
    // Log the specific IDs being checked
    console.log(`Validating submission for fixture IDs: ${submittedFixtureIds.join(', ')}`);

    // 1. Find the betting round ID(s) these fixtures belong to
    const { data: roundFixtureLinks, error: linkError } = await supabase
      .from('betting_round_fixtures')
      .select('betting_round_id')
      .in('fixture_id', submittedFixtureIds);

    if (linkError) {
      console.error(`Validation Error: Could not fetch betting round links for fixtures:`, linkError);
      return NextResponse.json({ error: 'Internal server error: Could not validate submission.' }, { status: 500 });
    }

    if (!roundFixtureLinks || roundFixtureLinks.length === 0) {
        console.error(`Validation Error: Submitted fixtures do not belong to any known betting round.`);
        return NextResponse.json({ error: 'Invalid submission: Fixtures do not belong to a betting round.' }, { status: 400 });
    }

    // 2. Ensure all fixtures belong to the SAME betting round
    const uniqueBettingRoundIds = [...new Set(roundFixtureLinks.map(link => link.betting_round_id))];
    if (uniqueBettingRoundIds.length > 1) {
        console.error(`Validation Error: Submitted fixtures belong to multiple betting rounds: ${uniqueBettingRoundIds.join(', ')}.`);
        return NextResponse.json({ error: 'Invalid submission: Bets must be for a single round.' }, { status: 400 });
    }
    bettingRoundId = uniqueBettingRoundIds[0]; // We have the correct ID now!

    // 3. Fetch the betting round details (status and deadline)
    const { data: roundData, error: roundError } = await supabase
      .from('betting_rounds')
      .select('status, earliest_fixture_kickoff') // Use the round's earliest kickoff as the deadline
      .eq('id', bettingRoundId)
      .single();

    if (roundError || !roundData) {
      console.error(`Validation Error: Could not fetch betting round ${bettingRoundId}:`, roundError);
      // This could mean the round exists in links but not in rounds table (data inconsistency)
      return NextResponse.json({ error: 'Internal server error: Could not verify betting round details.' }, { status: 500 });
    }

    // 4. Check Round Status
    bettingRoundStatus = roundData.status;
    if (bettingRoundStatus !== 'open') {
        console.log(`User ${userId} submission rejected: Betting round ${bettingRoundId} is not open (status: ${bettingRoundStatus}).`);
        return NextResponse.json({ error: `Betting is closed for this round (Status: ${bettingRoundStatus}).` }, { status: 403 });
    }

    // 5. Check Deadline
    if (!roundData.earliest_fixture_kickoff) {
        console.error(`Validation Error: Betting round ${bettingRoundId} is missing earliest_fixture_kickoff.`);
        return NextResponse.json({ error: 'Internal server error: Round deadline not configured.' }, { status: 500 });
        }
    bettingRoundDeadline = new Date(roundData.earliest_fixture_kickoff);
        const nowUtcMillis = Date.now();
    const deadlineUtcMillis = bettingRoundDeadline.getTime();

    console.log(`Betting round ${bettingRoundId} deadline UTC millis: ${deadlineUtcMillis} (${bettingRoundDeadline.toISOString()}), Current UTC millis: ${nowUtcMillis} (${new Date(nowUtcMillis).toISOString()})`);

    if (nowUtcMillis >= deadlineUtcMillis) {
      console.log(`User ${userId} submission rejected: Deadline for betting round ${bettingRoundId} passed.`);
          return NextResponse.json({ error: 'Cannot submit bets, the betting deadline has passed.' }, { status: 403 });
    }

    console.log(`Submission validated for user ${userId}, betting round ${bettingRoundId}. Proceeding...`);

  } catch (e) {
      console.error('Error during submission validation:', e);
      return NextResponse.json({ error: 'Internal server error during submission validation.' }, { status: 500 });
  }
  // --- End Refactored Validation ---

  // 4. Prepare data for Upsert
  const upsertData = submissions.map(sub => ({
    user_id: userId,
    fixture_id: sub.fixture_id,
    prediction: sub.prediction, 
    betting_round_id: bettingRoundId, // Use the correct column name
    submitted_at: new Date().toISOString(),
  }));

  // 5. Perform Upsert using supabase client
  try {
    console.log(`Upserting ${upsertData.length} bets for user ${userId}, round ${bettingRoundId}...`);
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

    console.log(`Successfully saved bets for user ${userId}, round ${bettingRoundId}.`);

    // 6. Return success response
    return NextResponse.json({ message: 'Bets submitted successfully!' }, { status: 200 });

  } catch (e) {
      console.error('Unexpected error during upsert:', e);
      return NextResponse.json({ error: 'Internal server error saving bets.' }, { status: 500 });
  }
} 