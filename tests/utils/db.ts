import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

let testClient: SupabaseClient<Database> | null = null;
let serviceRoleClient: SupabaseClient<Database> | null = null;

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

    // Truncate each table using DELETE with different strategies based on table
    for (const table of tablesToTruncate) {
      try {
        let deleteQuery;
        
        // Use different delete strategies based on table structure
        if (['profiles', 'user_bets', 'user_season_answers'].includes(table)) {
          // For UUID primary keys, use a condition that matches all
          deleteQuery = client.from(table as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } else if (table === 'betting_round_fixtures') {
          // Junction table without id column - delete by betting_round_id
          deleteQuery = client.from(table as any).delete().gte('betting_round_id', 0);
        } else {
          // For integer primary keys, use a condition that matches all
          deleteQuery = client.from(table as any).delete().gte('id', 0);
        }
        
        const { error } = await deleteQuery;
        
        if (error) {
          console.warn(`[TEST_DB] Warning: Could not truncate ${table}: ${error.message}`);
        } else {
          console.log(`[TEST_DB] Truncated table: ${table}`);
        }
      } catch (tableError) {
        console.warn(`[TEST_DB] Warning: Could not truncate ${table}:`, tableError);
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

/**
 * Seeds the database with predefined test data.
 * Uses service role client to bypass RLS policies.
 * Inserts data in the correct order to satisfy foreign key constraints.
 *
 * @returns Promise<void>
 * @throws Error if seeding fails
 */
export async function seedTestData(): Promise<void> {
  try {
    const client = await getServiceRoleClient();

    console.log('[TEST_DB] Starting database seeding...');

    // Seed competitions
    const { error: competitionsError } = await client
      .from('competitions')
      .upsert([
        {
          id: 1,
          name: 'Premier League',
          api_league_id: 39
        }
      ], { onConflict: 'id' });

    if (competitionsError) {
      throw new Error(`Failed to seed competitions: ${competitionsError.message}`);
    }

    // Seed seasons
    const { error: seasonsError } = await client
      .from('seasons')
      .upsert([
        {
          id: 1,
          api_season_year: 2024,
          competition_id: 1,
          name: '2024 Season',
          is_current: true
        }
      ], { onConflict: 'id' });

    if (seasonsError) {
      throw new Error(`Failed to seed seasons: ${seasonsError.message}`);
    }

    // Seed teams
    const { error: teamsError } = await client
      .from('teams')
      .upsert([
        { id: 1, name: 'Arsenal', api_team_id: 42 },
        { id: 2, name: 'Chelsea', api_team_id: 49 },
        { id: 3, name: 'Liverpool', api_team_id: 40 },
        { id: 4, name: 'Manchester City', api_team_id: 50 }
      ], { onConflict: 'id' });

    if (teamsError) {
      throw new Error(`Failed to seed teams: ${teamsError.message}`);
    }

    // Note: Profiles are not seeded here because they have foreign key constraints to auth.users
    // Individual tests should create profiles as needed using the service role client

    // Seed rounds
    const { error: roundsError } = await client
      .from('rounds')
      .upsert([
        {
          id: 1,
          name: 'Round 1',
          season_id: 1
        },
        {
          id: 2,
          name: 'Round 2',
          season_id: 1
        }
      ], { onConflict: 'id' });

    if (roundsError) {
      throw new Error(`Failed to seed rounds: ${roundsError.message}`);
    }

    // Seed fixtures (use future dates for testing)
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 7); // 1 week from now
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 7);
    futureDate2.setHours(futureDate2.getHours() + 2); // 2 hours later
    const futureDate3 = new Date();
    futureDate3.setDate(futureDate3.getDate() + 14); // 2 weeks from now

    const { error: fixturesError } = await client
      .from('fixtures')
      .upsert([
        {
          id: 1,
          api_fixture_id: 1001,
          round_id: 1,
          home_team_id: 1,
          away_team_id: 2,
          kickoff: futureDate1.toISOString(),
          status_short: 'NS', // Not Started
          home_goals: null,
          away_goals: null
        },
        {
          id: 2,
          api_fixture_id: 1002,
          round_id: 1,
          home_team_id: 3,
          away_team_id: 4,
          kickoff: futureDate2.toISOString(),
          status_short: 'NS', // Not Started
          home_goals: null,
          away_goals: null
        },
        {
          id: 3,
          api_fixture_id: 1003,
          round_id: 2,
          home_team_id: 2,
          away_team_id: 3,
          kickoff: futureDate3.toISOString(),
          status_short: 'NS', // Not Started
          home_goals: null,
          away_goals: null
        }
      ], { onConflict: 'id' });

    if (fixturesError) {
      throw new Error(`Failed to seed fixtures: ${fixturesError.message}`);
    }

    // Seed betting rounds
    const { error: bettingRoundsError } = await client
      .from('betting_rounds')
      .upsert([
        {
          id: 1,
          name: 'Betting Round 1',
          competition_id: 1,
          status: 'open',
          scored_at: null, // Will be set by tests when needed
          earliest_fixture_kickoff: futureDate1.toISOString(),
          latest_fixture_kickoff: futureDate2.toISOString()
        },
        {
          id: 2,
          name: 'Betting Round 2',
          competition_id: 1,
          status: 'open',
          scored_at: null,
          earliest_fixture_kickoff: futureDate3.toISOString(),
          latest_fixture_kickoff: futureDate3.toISOString()
        }
      ], { onConflict: 'id' });

    if (bettingRoundsError) {
      throw new Error(`Failed to seed betting rounds: ${bettingRoundsError.message}`);
    }

    // Seed betting round fixtures (junction table)
    const { error: bettingRoundFixturesError } = await client
      .from('betting_round_fixtures')
      .upsert([
        { betting_round_id: 1, fixture_id: 1 },
        { betting_round_id: 1, fixture_id: 2 },
        { betting_round_id: 2, fixture_id: 3 }
      ], { onConflict: 'betting_round_id,fixture_id' });

    if (bettingRoundFixturesError) {
      throw new Error(`Failed to seed betting round fixtures: ${bettingRoundFixturesError.message}`);
    }

    console.log('[TEST_DB] Database seeding completed successfully');
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
      // Season 1 winner
      {
        season_id: 1,
        user_id: profiles[0].id,
        league_id: 1, // Premier League
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        competition_type: 'league',
      },
      // Another winner for a different user
      {
        season_id: 1,
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
    
    // Map of original profile ID to actual created user ID
    const profileIdMap = new Map<string, string>();
    
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
            profileIdMap.set(profile.id, existingUser.id);
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
        profileIdMap.set(profile.id, authUser.user.id);
      } else {
        console.error(`[TEST_DB] No user data returned from auth.admin.createUser for ${profile.id}`);
        throw new Error(`No user data returned from auth.admin.createUser for ${profile.id}`);
      }
    }
    
    // Give the trigger a moment to work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create profile objects with the actual user IDs
    const actualProfiles = profiles.map(p => ({
      id: profileIdMap.get(p.id) || p.id,
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
    
    // Update the original profiles array with the actual user IDs for caller convenience
    for (let i = 0; i < profiles.length; i++) {
      const actualId = profileIdMap.get(profiles[i].id);
      if (actualId && actualId !== profiles[i].id) {
        console.log(`[TEST_DB] Updated profile ID ${profiles[i].id} -> ${actualId}`);
        profiles[i].id = actualId;
      }
    }
    
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
    if (testClient || serviceRoleClient) {
      // Supabase client doesn't have an explicit disconnect method
      // but we can reset our references to allow garbage collection
      testClient = null;
      serviceRoleClient = null;
      console.log('[TEST_DB] Disconnected from test database');
    }
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