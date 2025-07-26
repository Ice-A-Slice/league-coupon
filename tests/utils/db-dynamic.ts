import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

let testClient: SupabaseClient<Database> | null = null;
let serviceRoleClient: SupabaseClient<Database> | null = null;

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
 * Gets a service role client for operations that need to bypass RLS.
 */
async function getServiceRoleClient(): Promise<SupabaseClient<Database>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required environment variables');
  }

  if (!serviceRoleClient) {
    serviceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey);
  }

  return serviceRoleClient;
}

/**
 * Seeds the database with test data, using existing data where possible.
 * This version is designed to work with both empty and populated databases.
 */
export async function seedTestData(): Promise<void> {
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
        name: '2024 Test Season',
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
      { name: `Test Round 1 - ${Date.now()}`, season_id: testIds.season },
      { name: `Test Round 2 - ${Date.now()}`, season_id: testIds.season }
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

  const timestamp = Date.now();
  const { data: fixtures, error: fixturesError } = await client
    .from('fixtures')
    .insert([
      {
        api_fixture_id: timestamp,
        round_id: testIds.rounds[0],
        home_team_id: testIds.teams[0],
        away_team_id: testIds.teams[1],
        kickoff: futureDate1.toISOString(),
        status_short: 'NS',
        status_long: 'Not Started'
      },
      {
        api_fixture_id: timestamp + 1,
        round_id: testIds.rounds[0],
        home_team_id: testIds.teams[2],
        away_team_id: testIds.teams[3],
        kickoff: futureDate2.toISOString(),
        status_short: 'NS',
        status_long: 'Not Started'
      },
      {
        api_fixture_id: timestamp + 2,
        round_id: testIds.rounds[1],
        home_team_id: testIds.teams[0],
        away_team_id: testIds.teams[2],
        kickoff: futureDate3.toISOString(),
        status_short: 'NS',
        status_long: 'Not Started'
      },
      {
        api_fixture_id: timestamp + 3,
        round_id: testIds.rounds[0],
        home_team_id: testIds.teams[1],
        away_team_id: testIds.teams[3],
        kickoff: futureDate1.toISOString(),
        status_short: 'FT',
        status_long: 'Match Finished',
        home_goals: 2,
        away_goals: 1,
        result: '1'
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
        name: `Test Betting Round 1 - ${timestamp}`,
        competition_id: testIds.competition,
        status: 'open',
        earliest_fixture_kickoff: futureDate1.toISOString(),
        latest_fixture_kickoff: futureDate2.toISOString()
      },
      {
        name: `Test Betting Round 2 - ${timestamp}`,
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
      { betting_round_id: testIds.bettingRounds[0], fixture_id: testIds.fixtures[3] },
      { betting_round_id: testIds.bettingRounds[1], fixture_id: testIds.fixtures[2] }
    ]);

  if (brfError) throw new Error(`Failed to create betting round fixtures: ${brfError.message}`);

  console.log('[TEST_DB] Test data seeded successfully!');
  console.log('[TEST_DB] Available test IDs:', testIds);
}

/**
 * Creates test user profiles with auth users.
 */
export async function createTestProfiles(profiles: Array<{
  id: string;
  full_name: string | null;
}>): Promise<void> {
  const client = await getServiceRoleClient();
  console.log(`[TEST_DB] Creating ${profiles.length} test profiles...`);
  
  testIds.profiles = [];

  for (const profile of profiles) {
    // Generate unique email for each test user
    const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    
    // Create auth user
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email,
      password: 'test123456',
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name || 'Test User'
      }
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    const userId = authUser.user!.id;
    testIds.profiles.push(userId);

    // Wait for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 200));

    // Ensure profile exists with correct data
    const { error: profileError } = await client
      .from('profiles')
      .upsert({
        id: userId,
        full_name: profile.full_name || 'Test User'
      });

    if (profileError) {
      throw new Error(`Failed to upsert profile: ${profileError.message}`);
    }
    
    // Update the original profile object with the actual user ID
    profile.id = userId;
  }

  console.log(`[TEST_DB] Created ${profiles.length} test profiles with IDs: ${testIds.profiles.join(', ')}`);
}

/**
 * Cleans up test data created during tests.
 */
export async function cleanupTestData(): Promise<void> {
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
}

/**
 * Resets the database for testing.
 */
export async function resetTestDb(seed: boolean = true): Promise<void> {
  await cleanupTestData();
  if (seed) {
    await seedTestData();
  }
}

/**
 * Seeds Hall of Fame data for testing.
 */
export async function seedHallOfFameData(profiles: Array<{ id: string }>): Promise<void> {
  const client = await getServiceRoleClient();
  console.log('[TEST_DB] Seeding Hall of Fame data...');

  const winners = [
    {
      season_id: testIds.season!,
      user_id: profiles[0].id,
      league_id: 1,
      total_points: 150,
      game_points: 120,
      dynamic_points: 30,
      competition_type: 'league',
    },
    {
      season_id: testIds.season!,
      user_id: profiles[1].id,
      league_id: 1,
      total_points: 145,
      game_points: 115,
      dynamic_points: 30,
      competition_type: 'last_round_special',
    },
  ];

  const { error } = await client.from('season_winners').insert(winners);

  if (error) {
    throw new Error(`Failed to seed season_winners: ${error.message}`);
  }

  console.log('[TEST_DB] Hall of Fame data seeded successfully.');
}