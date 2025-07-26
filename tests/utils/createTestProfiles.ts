import { SupabaseClient } from '@supabase/supabase-js';
import { testIds } from './db';

/**
 * Simplified createTestProfiles function that works with dynamic IDs
 */
export async function createTestProfiles(
  client: SupabaseClient,
  profiles: Array<{ id: string; full_name: string | null }>
): Promise<void> {
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