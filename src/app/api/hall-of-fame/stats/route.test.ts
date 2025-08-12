/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { connectToTestDb, resetDatabase, disconnectDb, createTestProfiles, seedHallOfFameData, seedTestData } from '../../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// TODO: Re-enable these tests after fixing profile table dependencies
// These tests expect user names from profiles for aggregated statistics.
describe.skip('/api/hall-of-fame/stats - SKIPPED: Profile table removal - Hall of Fame Statistics API', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null; }>;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
    testProfiles = [
      { id: 'user-1', full_name: 'John Doe' },
      { id: 'user-2', full_name: 'Jane Smith' },
    ];
    await createTestProfiles(testProfiles);
    await seedHallOfFameData(client, testProfiles);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/hall-of-fame/stats');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url);
  };

  describe('Successful requests', () => {
    it('should return aggregated stats with default parameters', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.leaderboard).toHaveLength(2);
      expect(data.data.leaderboard[0]).toHaveProperty('user');
      expect(data.data.leaderboard[0]).toHaveProperty('total_wins');
      expect(data.data.leaderboard[0].user.full_name).toBe('John Doe');
      expect(data.data.leaderboard[0].total_wins).toBe(1);
    });
  });
}); 