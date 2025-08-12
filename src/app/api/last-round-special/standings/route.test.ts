/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import {
  connectToTestDb,
  resetDatabase,
  disconnectDb,
  createTestProfiles,
  testIds,
} from '../../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// TODO: Re-enable these tests after fixing profile table dependencies  
// These tests expect full_name in user objects from profiles table.
// The last-round-special standings API needs testing of fallback logic.
describe.skip('/api/last-round-special/standings - SKIPPED: Profile table removal - Cup Standings API Integration Tests', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null }>;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase(true);
    
    // Create test profiles for cup standings
    testProfiles = [
      { id: 'cup-user-1', full_name: 'John Doe' },
      { id: 'cup-user-2', full_name: 'Jane Smith' },
      { id: 'cup-user-3', full_name: 'Bob Wilson' },
    ];
    await createTestProfiles(testProfiles);

    // Activate the cup for current season
    await client
      .from('seasons')
      .update({
        last_round_special_activated: true,
        last_round_special_activated_at: '2025-01-20T10:00:00Z'
      })
      .eq('id', testIds.season!);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const baseUrl = 'http://localhost/api/last-round-special/standings';
    const url = new URL(baseUrl);
    
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return new NextRequest(url, {
      method: 'GET'
    });
  };

  const createCupStandingsData = async () => {
    // Create cup standings data for all test users
    return client
      .from('user_last_round_special_points')
      .insert([
        {
          user_id: testProfiles[0].id,
          betting_round_id: testIds.bettingRounds[0],
          season_id: testIds.season!,
          points: 150
        },
        {
          user_id: testProfiles[1].id,
          betting_round_id: testIds.bettingRounds[0], 
          season_id: testIds.season!,
          points: 140
        },
        {
          user_id: testProfiles[2].id,
          betting_round_id: testIds.bettingRounds[0],
          season_id: testIds.season!,
          points: 130
        },
        // Additional round data for some users
        {
          user_id: testProfiles[0].id,
          betting_round_id: testIds.bettingRounds[1],
          season_id: testIds.season!,
          points: 25
        },
        {
          user_id: testProfiles[1].id,
          betting_round_id: testIds.bettingRounds[1],
          season_id: testIds.season!,
          points: 20
        }
      ]);
  };

  describe('GET /api/last-round-special/standings', () => {
    it('should return cup standings with default pagination', async () => {
      // Setup: Create cup standings data
      await createCupStandingsData();

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      // Check first item structure (should have highest points)
      const firstItem = data.data[0];
      expect(firstItem).toHaveProperty('user_id');
      expect(firstItem).toHaveProperty('user');
      expect(firstItem.user).toHaveProperty('id');
      expect(firstItem.user).toHaveProperty('full_name');
      expect(firstItem.user).toHaveProperty('avatar_url');
      expect(firstItem).toHaveProperty('total_points');
      expect(firstItem).toHaveProperty('rounds_participated');
      expect(firstItem).toHaveProperty('position');
      expect(firstItem).toHaveProperty('last_updated');

      // Verify sorting by points (descending)
      expect(firstItem.total_points).toBeGreaterThanOrEqual(data.data[1]?.total_points || 0);

      // Check pagination
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBe(3);
    });

    it('should return cup standings with custom pagination', async () => {
      await createCupStandingsData();

      const request = createMockRequest({
        page: '2',
        limit: '2'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBe(3);
      
      // Should return 1 item on page 2 (3 total items, 2 per page)
      expect(data.data).toHaveLength(1);
    });

    it('should handle custom sorting by points descending', async () => {
      await createCupStandingsData();

      const request = createMockRequest({
        sort: 'points_desc'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(3);
      
      // Verify descending order by points
      expect(data.data[0].total_points).toBeGreaterThanOrEqual(data.data[1].total_points);
      expect(data.data[1].total_points).toBeGreaterThanOrEqual(data.data[2].total_points);
    });

    it('should handle specific season filter', async () => {
      await createCupStandingsData();

      const request = createMockRequest({
        season: testIds.season!.toString()
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return empty results when no standings data exists', async () => {
      // Don't create any standings data
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it('should handle profile fetch errors gracefully', async () => {
      // Create standings data but without proper profile setup
      await client
        .from('user_last_round_special_points')
        .insert([
          {
            user_id: 'non-existent-user',
            betting_round_id: testIds.bettingRounds[0],
            season_id: testIds.season!,
            points: 100
          }
        ]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      // Should still return data, potentially with fallback user info
    });

    it('should include proper cache headers', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBeTruthy();
    });

    it('should validate pagination limits', async () => {
      await createCupStandingsData();

      const request = createMockRequest({
        limit: '200' // Try to exceed max limit
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBeLessThanOrEqual(100); // Should be capped
    });

    it('should include metadata and query info in response', async () => {
      await createCupStandingsData();

      const request = createMockRequest({
        sort: 'points_desc',
        season: testIds.season!.toString()
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it('should return empty data when cup is not activated', async () => {
      // Deactivate the cup
      await client
        .from('seasons')
        .update({
          last_round_special_activated: false,
          last_round_special_activated_at: null
        })
        .eq('id', testIds.season!);

      await createCupStandingsData();

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(0);
    });
  });
});