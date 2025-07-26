import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Removed singleton clients - using factory pattern instead

// Global mutex to ensure database operations don't interfere with each other
let dbOperationMutex: Promise<void> = Promise.resolve();

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

    // Always create a fresh client (factory pattern)
    const testClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

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
 * Creates a fresh service role client for operations that need to bypass RLS.
 * Used for database setup, seeding, and cleanup operations.
 * Uses factory pattern to avoid stale client issues.
 *
 * @returns Promise<SupabaseClient<Database>> - A fresh service role client
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

    // Always create a fresh client (factory pattern)
    return createClient<Database>(supabaseUrl, serviceRoleKey);
  } catch (error) {
    console.error('[TEST_DB] Service role client creation failed:', error);
    throw new Error(`Failed to create service role client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Truncates all user-defined tables to reset database state.
 * Uses service role client to bypass RLS policies.
 *
 * @returns Promise<void>
 * @throws Error if truncation fails
 */
export async function truncateAllTables(): Promise<void> {
  try {
    const client = await getServiceRoleClient();

    console.log('[TEST_DB] Starting database truncation...');

    // IMPROVED: Multiple passes to handle foreign key dependencies properly
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[TEST_DB] Cleanup attempt ${attempt}/${maxAttempts}...`);
      
      // List of tables to truncate in dependency order (children first, then parents)
      const tablesToTruncate = [
        'user_bets',
        'user_season_answers', 
        'user_round_dynamic_points',
        'user_last_round_special_points',
        'season_winners',
        'betting_round_fixtures',
        'betting_rounds',
        'fixtures',
        'rounds',
        'seasons',
        'teams',
        'competitions',
        'profiles',
        'players',
        'player_statistics'
      ];

      let allTablesEmpty = true;
      
      for (const table of tablesToTruncate) {
        try {
          // Use unconditional DELETE to remove ALL records regardless of constraints
          let result;
          
          if (['profiles', 'user_bets', 'user_season_answers', 'user_round_dynamic_points', 'user_last_round_special_points'].includes(table)) {
            // For UUID primary keys - delete everything
            result = await client.from(table as any).delete().not('id', 'is', null);
          } else if (table === 'betting_round_fixtures') {
            // Junction table - delete everything  
            result = await client.from(table as any).delete().not('betting_round_id', 'is', null);
          } else {
            // For integer primary keys - delete everything
            result = await client.from(table as any).delete().not('id', 'is', null);
          }
          
          if (result.error) {
            console.warn(`[TEST_DB] Warning: Could not clean ${table}: ${result.error.message}`);
            allTablesEmpty = false;
          } else {
            console.log(`[TEST_DB] Cleaned table: ${table} (deleted ${result.count || 'unknown'} records)`);
          }
          
          // Verify table is actually empty
          const { data: remainingData, error: checkError } = await client.from(table as any).select('*').limit(1);
          if (!checkError && remainingData && remainingData.length > 0) {
            console.warn(`[TEST_DB] WARNING: Table ${table} still contains ${remainingData.length} record(s) after cleanup`);
            allTablesEmpty = false;
          }
          
        } catch (tableError) {
          console.warn(`[TEST_DB] Error cleaning ${table}:`, tableError);
          allTablesEmpty = false;
        }
      }
      
      // If all tables are empty, we're done
      if (allTablesEmpty) {
        console.log(`[TEST_DB] All tables successfully emptied on attempt ${attempt}`);
        break;
      } else if (attempt === maxAttempts) {
        console.warn(`[TEST_DB] Some tables may still contain data after ${maxAttempts} attempts`);
      }
    }

    // Clean up auth schema tables (auth.users and related tables)
    // This needs to be done after public tables are cleaned due to foreign key constraints
    try {
      // Use auth admin API to clean up users
      // This will cascade to all dependent tables including profiles
      
      const { data: users, error: listError } = await client.auth.admin.listUsers();
      
      if (listError) {
        console.warn('[TEST_DB] Could not list auth users:', listError.message);
      } else if (users?.users && users.users.length > 0) {
        // IMPROVED: Delete ALL test users with broader patterns to catch edge cases
        const testUsers = users.users.filter(user => {
          if (!user.email) return false;
          
          // Match multiple test patterns to be more comprehensive
          return (
            user.email.includes('test-') ||
            user.email.includes('@example.com') ||
            user.email.includes('@test.com') ||
            user.email.startsWith('test') ||
            // Also match users created during test runs (they often have generated emails)
            (user.created_at && new Date(user.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Created in last 24h
          );
        });
        
        // IMPROVED: Delete users in batches to avoid rate limits and add retry logic
        const batchSize = 5;
        for (let i = 0; i < testUsers.length; i += batchSize) {
          const batch = testUsers.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (user) => {
            let retries = 3;
            while (retries > 0) {
              const { error: deleteError } = await client.auth.admin.deleteUser(user.id);
              if (deleteError) {
                retries--;
                if (retries === 0) {
                  console.warn(`[TEST_DB] Could not delete test user ${user.id} after 3 retries:`, deleteError.message);
                } else {
                  await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay before retry
                }
              } else {
                break;
              }
            }
          }));
          
          // Brief pause between batches
          if (i + batchSize < testUsers.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        if (testUsers.length > 0) {
          console.log(`[TEST_DB] Deleted ${testUsers.length} test auth users (and cascaded to profiles)`);
        } else {
          console.log('[TEST_DB] No test auth users to delete');
        }
        
        // IMPROVED: Wait a bit for cascading deletes to complete, then verify cleanup
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: remainingUsers } = await client.auth.admin.listUsers();
        const remainingTestUsers = remainingUsers?.users?.filter(user =>
          user.email && (
            user.email.includes('test-') ||
            user.email.includes('@example.com') ||
            user.email.includes('@test.com')
          )
        ) || [];
        
        if (remainingTestUsers.length > 0) {
          console.warn(`[TEST_DB] WARNING - ${remainingTestUsers.length} test users still remain after cleanup`);
        }
      } else {
        console.log('[TEST_DB] No auth users to delete');
      }

    } catch (authError) {
      console.warn('[TEST_DB] Could not clean auth tables:', authError);
    }

    console.log('[TEST_DB] Database truncation completed');
  } catch (error) {
    console.error('[TEST_DB] Truncation failed:', error);
    throw new Error(`Failed to truncate database tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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
 * Seeds the database with predefined test data.
 * Uses service role client to bypass RLS policies.
 * This version works with both empty and populated databases.
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
    const timestamp = Date.now();
    const { data: rounds, error: roundsError } = await client
      .from('rounds')
      .insert([
        { name: `Test Round 1 - ${timestamp}`, season_id: testIds.season },
        { name: `Test Round 2 - ${timestamp}`, season_id: testIds.season }
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
          api_fixture_id: 10000 + Math.floor(Math.random() * 90000), // Random 5-digit number
          round_id: testIds.rounds[0],
          home_team_id: testIds.teams[0],
          away_team_id: testIds.teams[1],
          kickoff: futureDate1.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        },
        {
          api_fixture_id: 10000 + Math.floor(Math.random() * 90000),
          round_id: testIds.rounds[0],
          home_team_id: testIds.teams[2],
          away_team_id: testIds.teams[3],
          kickoff: futureDate2.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        },
        {
          api_fixture_id: 10000 + Math.floor(Math.random() * 90000),
          round_id: testIds.rounds[1],
          home_team_id: testIds.teams[0],
          away_team_id: testIds.teams[2],
          kickoff: futureDate3.toISOString(),
          status_short: 'NS',
          status_long: 'Not Started'
        },
        {
          api_fixture_id: 10000 + Math.floor(Math.random() * 90000),
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
 * Seeds the database with Hall of Fame (season_winners) test data.
 * This should be called after `seedTestData()` and `createTestProfiles()`.
 *
 * @param client - The Supabase service role client instance
 * @param profiles - The profiles that have been created for the test
 * @returns Promise<void>
 */
export async function seedHallOfFameData(client: SupabaseClient<Database>, profiles: Array<{ id: string }>): Promise<void> {
  try {
    console.log('[TEST_DB] Seeding Hall of Fame data...');

    const winners = [
      // Season winner
      {
        season_id: testIds.season!,
        user_id: profiles[0].id,
        league_id: testIds.competition!, // Use actual competition ID
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        competition_type: 'league',
      },
      // Last round special winner
      {
        season_id: testIds.season!,
        user_id: profiles[1].id,
        league_id: testIds.competition!, // Use actual competition ID
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
  } catch (error) {
    console.error('[TEST_DB] Hall of Fame seeding failed:', error);
    throw new Error(`Failed to seed Hall of Fame data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates test profiles in the database using service role client.
 * First creates users in auth.users table, then creates corresponding profiles.
 * This satisfies the foreign key constraint between profiles and auth.users.
 *
 * @param profiles - Array of profile objects to create
 * @returns Promise<void>
 * @throws Error if profile creation fails
 */
export async function createTestProfiles(profiles: Array<{ id: string; full_name: string | null }>): Promise<void> {
  try {
    const client = await getServiceRoleClient();
    console.log(`[TEST_DB] Creating ${profiles.length} test profiles...`);
    
    testIds.profiles = [];
    
    // Check auth users before creation to handle conflicts
    const { data: existingAuthUsers } = await client.auth.admin.listUsers();
    
    // Check for existing test users that might conflict
    const existingTestUsers = existingAuthUsers?.users?.filter(user =>
      user.email && (
        user.email.includes('test-') ||
        user.email.includes('@example.com')
      )
    ) || [];
    
    if (existingTestUsers.length > 0) {
      console.warn(`[TEST_DB] Found ${existingTestUsers.length} existing test users that might cause conflicts`);
    }
    
    // First, create users in auth.users table
    for (const profile of profiles) {
      console.log(`[TEST_DB] Creating auth user: ${profile.id}`);
      
      // IMPROVED: Generate unique email to avoid conflicts
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uniqueEmail = `test-${profile.id.slice(-8)}-${timestamp}-${randomSuffix}@example.com`;
      
      const { data: authUser, error: authError } = await client.auth.admin.createUser({
        email: uniqueEmail,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          test_profile_id: profile.id // Store original ID for reference
        }
      });

      if (authError) {
        // IMPROVED: Try to find existing user by metadata if creation fails
        if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
          console.log(`[TEST_DB] Attempting to find existing auth user for ${profile.id}`);
          
          // Try to find existing user by similar email pattern
          const existingUser = existingAuthUsers?.users?.find(user =>
            user.email && user.email.includes(profile.id.slice(-8))
          );
          
          if (existingUser) {
            console.log(`[TEST_DB] Found existing auth user: ${existingUser.id} for profile ${profile.id}`);
            testIds.profiles.push(existingUser.id);
            profile.id = existingUser.id;
          } else {
            console.error(`[TEST_DB] Could not find existing auth user for ${profile.id}`);
            throw new Error(`Failed to create or find auth user for ${profile.id}: ${authError.message}`);
          }
        } else {
          console.error(`[TEST_DB] Failed to create auth user ${profile.id}:`, authError.message);
          throw new Error(`Failed to create auth user: ${authError.message}`);
        }
      } else if (authUser?.user) {
        console.log(`[TEST_DB] Created auth user: ${authUser.user.id} (requested: ${profile.id})`);
        testIds.profiles.push(authUser.user.id);
        profile.id = authUser.user.id;
      } else {
        console.error(`[TEST_DB] No user data returned from auth.admin.createUser for ${profile.id}`);
        throw new Error(`No user data returned from auth.admin.createUser for ${profile.id}`);
      }
    }
    
    // Give the trigger a moment to work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // At this point, profiles array has been updated with actual user IDs
    const actualProfiles = profiles.map(p => ({
      id: p.id,
      full_name: p.full_name
    }));
    
    // Check if profiles were auto-created by trigger
    const { data: existingProfiles } = await client
      .from('profiles')
      .select('id')
      .in('id', actualProfiles.map(p => p.id));
    
    const existingIds = new Set(existingProfiles?.map(p => p.id) || []);
    const missingProfiles = actualProfiles.filter(p => !existingIds.has(p.id));
    
    console.log(`[TEST_DB] Found ${existingProfiles?.length || 0} existing profiles, need to create ${missingProfiles.length}`);
    
    // Manually create any missing profiles (in case trigger didn't work)
    if (missingProfiles.length > 0) {
      const { error: profileError } = await client
        .from('profiles')
        .insert(missingProfiles);

      if (profileError) {
        console.error('[TEST_DB] Failed to create profiles:', profileError);
        throw new Error(`Failed to create test profiles: ${profileError.message}`);
      }
    }
    
    // Update profiles with the correct full_name (in case trigger created them with different values)
    const { error: updateError } = await client
      .from('profiles')
      .upsert(actualProfiles, { onConflict: 'id' });

    if (updateError) {
      console.error('[TEST_DB] Failed to update profiles:', updateError);
      throw new Error(`Failed to update test profiles: ${updateError.message}`);
    }
    
    console.log(`[TEST_DB] Successfully created/updated ${profiles.length} test profiles`);
    
    // Profile IDs have already been updated in the loop above
    console.log(`[TEST_DB] Profile IDs updated: ${profiles.map(p => p.id).join(', ')}`);
    
  } catch (error) {
    console.error('[TEST_DB] Profile creation failed:', error);
    throw new Error(`Failed to create test profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



/**
 * Cleanly disconnects from the test database.
 * Releases all resources and resets the client instances.
 *
 * @returns Promise<void>
 */
export async function disconnectDb(): Promise<void> {
  try {
    // With factory pattern, there are no persistent client references to clean up
    // Supabase clients are garbage collected automatically when they go out of scope
    console.log('[TEST_DB] Disconnected from test database (factory pattern - no cleanup needed)');
  } catch (error) {
    console.error('[TEST_DB] Error during disconnection:', error);
    throw new Error(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resets the entire database state by truncating all tables and optionally reseeding.
 * This is a convenience function that combines truncation and seeding.
 * 
 * @param seed - Whether to seed the database with test data after truncation
 * @returns Promise<void>
 */
export async function resetDatabase(seed: boolean = true): Promise<void> {
  return withDbMutex(async () => {
    try {
      console.log('[TEST_DB] Starting database reset...');
      
      await truncateAllTables();
      
      if (seed) {
        await seedTestData();
      }
      
      console.log('[TEST_DB] Database reset completed');
    } catch (error) {
      console.error('[TEST_DB] Database reset failed:', error);
      throw error;
    }
  });
}