import { SupabaseClient } from '@supabase/supabase-js';
import { testIds } from './db';

/**
 * Auth-only createTestProfiles function that works without profile table dependencies
 * Creates auth.users with user_metadata containing profile information
 */
export async function createTestProfiles(
  client: SupabaseClient,
  profiles: Array<{ id: string; full_name: string | null }>
): Promise<void> {
  console.log(`[TEST_DB] Creating ${profiles.length} test auth users (auth-only mode)...`);
  testIds.profiles = [];

  for (const profile of profiles) {
    // Generate unique email for each test user
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const email = `test-${timestamp}-${randomSuffix}@test.com`;
    
    // Create auth user with all profile data in user_metadata
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email,
      password: 'test123456',
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name || 'Test User',
        name: profile.full_name || 'Test User', // Alternative metadata field
        display_name: profile.full_name || 'Test User' // Another alternative field
      }
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    const userId = authUser.user!.id;
    testIds.profiles.push(userId);
    
    // Update the original profile object with the actual user ID
    profile.id = userId;
    
    console.log(`[TEST_DB] Created auth user ${userId} with email ${email} and metadata:`, authUser.user.user_metadata);
  }

  console.log(`[TEST_DB] Created ${profiles.length} test auth users (auth-only) with IDs: ${testIds.profiles.join(', ')}`);
}