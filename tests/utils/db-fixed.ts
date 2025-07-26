import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

let testClient: SupabaseClient<Database> | null = null;
let serviceRoleClient: SupabaseClient<Database> | null = null;

// Global mutex to ensure database operations don't interfere with each other
let dbOperationMutex: Promise<void> = Promise.resolve();

// Store created IDs for use across tests
export const testIds = {
  competition: null as number | null,
  season: null as number | null,
  teams: [] as number[],
  rounds: [] as number[],
  fixtures: [] as number[],
  bettingRounds: [] as number[],
  profiles: [] as string[]
};

/**
 * Ensures database operations are executed sequentially to prevent race conditions
 */
async function withDbMutex<T>(operation: () => Promise<T>): Promise<T> {
  const currentOperation = dbOperationMutex.then(operation);
  dbOperationMutex = currentOperation.then(() => {}, () => {}); // Don't let failures block future operations
  return currentOperation;
}

/**
 * Connects to the local Supabase test instance using test credentials.
 * Uses environment variables for configuration.
 * 
 * @returns Promise<SupabaseClient<Database>> - The connected Supabase client
 * @throws Error if connection fails or environment variables are missing
 */
export async function connectToTestDb(): Promise<SupabaseClient<Database>> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
      );
    }

    // Create client if it doesn't exist
    if (!testClient) {
      testClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
    }

    // Test the connection by making a simple query
    const { error } = await testClient.from('profiles').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is acceptable
      throw new Error(`Failed to connect to test database: ${error.message}`);
    }

    console.log('[TEST_DB] Successfully connected to test database');
    return testClient;
  } catch (error) {
    console.error('[TEST_DB] Connection failed:', error);
    throw new Error(`Failed to connect to test database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets a service role client for operations that need to bypass RLS.
 * Used for database setup, seeding, and cleanup operations.
 *
 * @returns Promise<SupabaseClient<Database>> - The service role client
 * @throws Error if connection fails or environment variables are missing
 */
async function getServiceRoleClient(): Promise<SupabaseClient<Database>> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
      );
    }

    // Create service role client if it doesn't exist
    if (!serviceRoleClient) {
      serviceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    }

    return serviceRoleClient;
  } catch (error) {
    console.error('[TEST_DB] Service role client creation failed:', error);
    throw new Error(`Failed to create service role client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Seeds the database with test data, using existing data where possible.
 * This version is designed to work with both empty and populated databases.
 *
 * @returns Promise<void>
 * @throws Error if seeding fails
 */
export async function seedTestData(): Promise<void> {
  try {
    const client = await getServiceRoleClient();

    console.log('[TEST_DB] Starting intelligent database seeding...');

    // 1. Get or create competition
    let { data: competition } = await client
      .from('competitions')
      .select('*')
      .eq('name', 'Premier League')
      .single();

    if (!competition) {
      const { data: newComp, error: compError } = await client
        .from('competitions')
        .insert({
          name: 'Premier League',
          api_league_id: 39
        })
        .select()
        .single();

      if (compError) throw new Error(`Failed to create competition: ${compError.message}`);
      competition = newComp;
    }
    testIds.competition = competition!.id;
    console.log(`[TEST_DB] Using competition ID: ${testIds.competition}`);

    // 2. Get or create season
    let { data: season } = await client
      .from('seasons')
      .select('*')
      .eq('api_season_year', 2024)
      .eq('competition_id', testIds.competition)
      .single();

    if (!season) {
      const { data: newSeason, error: seasonError } = await client
        .from('seasons')
        .insert({
          api_season_year: 2024,
          competition_id: testIds.competition,
          name: '2024 Season',
          is_current: true
        })
        .select()
        .single();

      if (seasonError) throw new Error(`Failed to create season: ${seasonError.message}`);
      season = newSeason;
    }
    testIds.season = season!.id;
    console.log(`[TEST_DB] Using season ID: ${testIds.season}`);

    // 3. Get or create teams
    const teamNames = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City'];
    const teamApiIds = [42, 49, 40, 50];
    testIds.teams = [];

    for (let i = 0; i < teamNames.length; i++) {
      let { data: team } = await client
        .from('teams')
        .select('*')
        .eq('name', teamNames[i])
        .single();

      if (!team) {
        const { data: newTeam, error: teamError } = await client
          .from('teams')
          .insert({
            name: teamNames[i],
            api_team_id: teamApiIds[i]
          })
          .select()
          .single();

        if (teamError) throw new Error(`Failed to create team ${teamNames[i]}: ${teamError.message}`);
        team = newTeam;
      }
      testIds.teams.push(team!.id);
    }
    console.log(`[TEST_DB] Using team IDs: ${testIds.teams.join(', ')}`);

    // 4. Create rounds (always create new ones for test isolation)
    const { data: rounds, error: roundsError } = await client
      .from('rounds')
      .insert([
        { name: 'Test Round 1', season_id: testIds.season },
        { name: 'Test Round 2', season_id: testIds.season }
      ])
      .select();

    if (roundsError) throw new Error(`Failed to create rounds: ${roundsError.message}`);
    testIds.rounds = rounds!.map(r => r.id);
    console.log(`[TEST_DB] Created round IDs: ${testIds.rounds.join(', ')}`);

    // 5. Create fixtures
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 7);
    const futureDate2 = new Date(futureDate1);
    futureDate2.setHours(futureDate2.getHours() + 2);
    const futureDate3 = new Date(futureDate1);
    futureDate3.setDate(futureDate3.getDate() + 7);

    const { data: fixtures, error: fixturesError } = await client
      .from('fixtures')
      .insert([
        {
          api_fixture_id: Date.now(), // Use timestamp to ensure uniqueness
          round_id: testIds.rounds[0],
          home_team_id: testIds.teams[0],
          away_team_id: testIds.teams[1],
          kickoff: futureDate1.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        },
        {
          api_fixture_id: Date.now() + 1,
          round_id: testIds.rounds[0],
          home_team_id: testIds.teams[2],
          away_team_id: testIds.teams[3],
          kickoff: futureDate2.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        },
        {
          api_fixture_id: Date.now() + 2,
          round_id: testIds.rounds[1],
          home_team_id: testIds.teams[0],
          away_team_id: testIds.teams[2],
          kickoff: futureDate3.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        }
      ])
      .select();

    if (fixturesError) throw new Error(`Failed to create fixtures: ${fixturesError.message}`);
    testIds.fixtures = fixtures!.map(f => f.id);
    console.log(`[TEST_DB] Created fixture IDs: ${testIds.fixtures.join(', ')}`);

    // 6. Create betting rounds
    const { data: bettingRounds, error: bettingRoundsError } = await client
      .from('betting_rounds')
      .insert([
        {
          name: 'Test Betting Round 1',
          competition_id: testIds.competition,
          status: 'open',
          earliest_fixture_kickoff: futureDate1.toISOString(),
          latest_fixture_kickoff: futureDate2.toISOString()
        },
        {
          name: 'Test Betting Round 2',
          competition_id: testIds.competition,
          status: 'open',
          earliest_fixture_kickoff: futureDate3.toISOString(),
          latest_fixture_kickoff: futureDate3.toISOString()
        }
      ])
      .select();

    if (bettingRoundsError) throw new Error(`Failed to create betting rounds: ${bettingRoundsError.message}`);
    testIds.bettingRounds = bettingRounds!.map(br => br.id);
    console.log(`[TEST_DB] Created betting round IDs: ${testIds.bettingRounds.join(', ')}`);

    // 7. Create betting round fixtures relationships
    const { error: brfError } = await client
      .from('betting_round_fixtures')
      .insert([
        { betting_round_id: testIds.bettingRounds[0], fixture_id: testIds.fixtures[0] },
        { betting_round_id: testIds.bettingRounds[0], fixture_id: testIds.fixtures[1] },
        { betting_round_id: testIds.bettingRounds[1], fixture_id: testIds.fixtures[2] }
      ]);

    if (brfError) throw new Error(`Failed to create betting round fixtures: ${brfError.message}`);

    console.log('[TEST_DB] Test data seeded successfully!');
    console.log('[TEST_DB] Available test IDs:', testIds);

  } catch (error) {
    console.error('[TEST_DB] Seeding failed:', error);
    throw new Error(`Failed to seed test data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates test user profiles with auth users.
 * This creates actual auth users and their corresponding profiles.
 *
 * @param profiles - Array of profile data to create
 * @returns Promise<void>
 * @throws Error if profile creation fails
 */
export async function createTestProfiles(profiles: Array<{
  id: string;
  full_name: string;
}>): Promise<void> {
  try {
    const client = await getServiceRoleClient();
    console.log(`[TEST_DB] Creating ${profiles.length} test profiles...`);
    
    testIds.profiles = [];

    for (const profile of profiles) {
      // Generate a unique test email
      const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
      
      // Create auth user
      const { data: authUser, error: authError } = await client.auth.admin.createUser({
        email,
        password: 'test123456',
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name
        }
      });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      const userId = authUser.user!.id;
      testIds.profiles.push(userId);

      // Update or create profile
      const { error: profileError } = await client
        .from('profiles')
        .upsert({
          id: userId,
          full_name: profile.full_name
        });

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }
      
      // Update the original profile object with the actual user ID
      profile.id = userId;
    }

    console.log(`[TEST_DB] Created ${profiles.length} test profiles successfully`);
  } catch (error) {
    console.error('[TEST_DB] Profile creation failed:', error);
    throw new Error(`Failed to create test profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cleans up test data created during tests.
 * This removes only the data created by the current test run.
 *
 * @returns Promise<void>
 */
export async function cleanupTestData(): Promise<void> {
  try {
    const client = await getServiceRoleClient();
    console.log('[TEST_DB] Cleaning up test data...');

    // Delete in reverse order of dependencies
    
    // 1. Delete betting round fixtures
    if (testIds.bettingRounds.length > 0 && testIds.fixtures.length > 0) {
      await client
        .from('betting_round_fixtures')
        .delete()
        .in('betting_round_id', testIds.bettingRounds);
    }

    // 2. Delete betting rounds
    if (testIds.bettingRounds.length > 0) {
      await client
        .from('betting_rounds')
        .delete()
        .in('id', testIds.bettingRounds);
    }

    // 3. Delete fixtures
    if (testIds.fixtures.length > 0) {
      await client
        .from('fixtures')
        .delete()
        .in('id', testIds.fixtures);
    }

    // 4. Delete rounds
    if (testIds.rounds.length > 0) {
      await client
        .from('rounds')
        .delete()
        .in('id', testIds.rounds);
    }

    // 5. Delete test auth users (profiles cascade)
    for (const userId of testIds.profiles) {
      await client.auth.admin.deleteUser(userId);
    }

    // Reset testIds
    testIds.competition = null;
    testIds.season = null;
    testIds.teams = [];
    testIds.rounds = [];
    testIds.fixtures = [];
    testIds.bettingRounds = [];
    testIds.profiles = [];

    console.log('[TEST_DB] Test data cleaned up successfully');
  } catch (error) {
    console.error('[TEST_DB] Cleanup failed:', error);
    // Don't throw on cleanup errors to avoid masking test failures
  }
}

/**
 * Resets the database for testing.
 * If seed is true, it will also seed test data.
 *
 * @param seed - Whether to seed test data after reset
 * @returns Promise<void>
 */
export async function resetTestDb(seed: boolean = true): Promise<void> {
  return withDbMutex(async () => {
    await cleanupTestData();
    if (seed) {
      await seedTestData();
    }
  });
}

/**
 * Cleanly disconnects from the test database.
 * Releases all resources and resets the client instances.
 *
 * @returns Promise<void>
 */
export async function disconnectDb(): Promise<void> {
  try {
    if (testClient || serviceRoleClient) {
      // Supabase client doesn't have an explicit disconnect method
      // but we can reset our references to allow garbage collection
      testClient = null;
      serviceRoleClient = null;
      console.log('[TEST_DB] Disconnected from test database');
    }
  } catch (error) {
    console.error('[TEST_DB] Disconnect failed:', error);
    // Don't throw on disconnect errors
  }
}