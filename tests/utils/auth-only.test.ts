/**
 * Test to validate auth-only approach works
 */
import { connectToTestDb, createTestProfiles, resetDatabase, disconnectDb } from './db';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

describe('Auth-Only Test Infrastructure', () => {
  let client: any;
  let serviceClient: any;

  beforeAll(async () => {
    client = await connectToTestDb();
    serviceClient = createSupabaseServiceRoleClient();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('should create test users with auth-only approach', async () => {
    await resetDatabase(true);
    
    const testProfiles = [
      { id: 'test-1', full_name: 'Test User 1' },
      { id: 'test-2', full_name: 'Test User 2' }
    ];

    // This should work with our new auth-only createTestProfiles
    await createTestProfiles(testProfiles);

    // Verify users were created
    expect(testProfiles[0].id).toBeDefined();
    expect(testProfiles[1].id).toBeDefined();
    expect(testProfiles[0].id).not.toBe('test-1'); // Should be UUID now
    expect(testProfiles[1].id).not.toBe('test-2'); // Should be UUID now

    // Verify auth users exist and have metadata (using service role client)
    const { data: user1, error: error1 } = await serviceClient.auth.admin.getUserById(testProfiles[0].id);
    const { data: user2, error: error2 } = await serviceClient.auth.admin.getUserById(testProfiles[1].id);

    expect(error1).toBeNull();
    expect(error2).toBeNull();
    expect(user1?.user?.user_metadata?.full_name).toBe('Test User 1');
    expect(user2?.user?.user_metadata?.full_name).toBe('Test User 2');
  }, 30000); // 30 second timeout
});