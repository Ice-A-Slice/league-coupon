/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';
import {
  connectToTestDb,
  resetDatabase,
  disconnectDb,
  createTestProfiles,
  seedTestData,
  seedHallOfFameData,
} from '../../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('/api/admin/hall-of-fame - Admin Hall of Fame Management API', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null }>;

  // Mock environment variable
  const originalEnv = process.env;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    await resetDatabase();
    await seedTestData();
    
    // Create test profiles and seed hall of fame data
    testProfiles = [
      { id: 'user-1', full_name: 'Test Winner 1' },
      { id: 'user-2', full_name: 'Test Winner 2' },
    ];
    await createTestProfiles(testProfiles);
    await seedHallOfFameData(client, testProfiles);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = (
    method: string,
    searchParams: Record<string, string> = {},
    body: unknown = null,
    authHeader?: string,
    cronSecret?: string
  ) => {
    const url = new URL('http://localhost/api/admin/hall-of-fame');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const request = new NextRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'content-type': 'application/json',
        ...(authHeader && { 'authorization': authHeader }),
        ...(cronSecret && { 'x-cron-secret': cronSecret }),
      }
    });

    return request;
  };

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });

    it('should accept Bearer token authentication', async () => {
      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should accept X-Cron-Secret header authentication', async () => {
      const request = createMockRequest('GET', {}, null, undefined, 'test-secret');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject invalid authentication tokens', async () => {
      const request = createMockRequest('GET', {}, null, 'Bearer wrong-secret');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });

    it('should handle missing CRON_SECRET configuration', async () => {
      delete process.env.CRON_SECRET;
      
      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/hall-of-fame', () => {
    it('should return Hall of Fame data with default parameters', async () => {
      const request = createMockRequest('GET', {}, null, 'Bearer test-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should handle filters correctly', async () => {
      // Get the seeded season ID for filtering
      const { data: season } = await client.from('seasons').select('id, competition_id').limit(1).single();
      if (!season) throw new Error('No season found in test data');

      const request = createMockRequest('GET', {
        competition_id: season.competition_id.toString(),
        season_id: season.id.toString(),
        user_id: testProfiles[0].id,
      }, null, 'Bearer test-secret');
      
      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data).toBeDefined();
    });

    it('should enforce maximum limit', async () => {
      const request = createMockRequest('GET', {
        limit: '999' // Try to request more than max
      }, null, 'Bearer test-secret');
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBeLessThanOrEqual(200); // Max limit enforced
    });
  });

  describe('POST /api/admin/hall-of-fame', () => {
    it('should create a new Hall of Fame entry', async () => {
      // Get actual seeded data
      const { data: season } = await client.from('seasons').select('id').limit(1).single();
      if (!season) throw new Error('No season found in test data');

      const newWinnerData = {
        season_id: season.id,
        user_id: testProfiles[1].id, // Use second profile (first one already has entry from seeding)
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        competition_type: 'league'
      };

      const request = createMockRequest('POST', {}, newWinnerData, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.operation).toBe('created');
      expect(data.data).toBeDefined();
    });

    it('should update existing winner when override_existing is true', async () => {
      // Get existing winner data
      const { data: existingWinner } = await client
        .from('season_winners')
        .select('*')
        .limit(1)
        .single();
      
      if (!existingWinner) throw new Error('No existing winner found');

      const updateData = {
        season_id: existingWinner.season_id,
        user_id: existingWinner.user_id,
        total_points: 200,
        game_points: 170,
        dynamic_points: 30,
        competition_type: existingWinner.competition_type,
        override_existing: true
      };

      const request = createMockRequest('POST', {}, updateData, 'Bearer test-secret');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.operation).toBe('updated');
    });

    it('should reject when winner already exists without override', async () => {
      // Try to create winner that already exists
      const { data: existingWinner } = await client
        .from('season_winners')
        .select('*')
        .limit(1)
        .single();
      
      if (!existingWinner) throw new Error('No existing winner found');

      const duplicateData = {
        season_id: existingWinner.season_id,
        user_id: existingWinner.user_id,
        total_points: 100,
        game_points: 80,
        dynamic_points: 20,
        competition_type: existingWinner.competition_type
      };

      const request = createMockRequest('POST', {}, duplicateData, 'Bearer test-secret');
      const response = await POST(request);

      expect(response.status).toBe(409);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        total_points: 100
        // Missing required fields
      };

      const request = createMockRequest('POST', {}, incompleteData, 'Bearer test-secret');
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/hall-of-fame', () => {
    it('should delete winner by winner_id', async () => {
      // Get existing winner
      const { data: existingWinner } = await client
        .from('season_winners')
        .select('*')
        .limit(1)
        .single();
      
      if (!existingWinner) throw new Error('No existing winner found');

      const request = createMockRequest('DELETE', {}, {
        winner_id: existingWinner.id
      }, 'Bearer test-secret');
      
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Winner deleted successfully');
    });

    it('should delete winner by season_id', async () => {
      // Debug: Check what winners exist
      const { data: allWinners } = await client
        .from('season_winners')
        .select('*');
      
      console.log('DEBUG: All winners in database:', allWinners);
      
      // Get existing winner's season
      const { data: existingWinner } = await client
        .from('season_winners')
        .select('*')
        .limit(1)
        .single();
      
      if (!existingWinner) throw new Error(`No existing winner found. All winners: ${JSON.stringify(allWinners)}`);

      const request = createMockRequest('DELETE', {}, {
        season_id: existingWinner.season_id
      }, 'Bearer test-secret');
      
      const response = await DELETE(request);

      expect(response.status).toBe(200);
    });

    it('should require either winner_id or season_id', async () => {
      const request = createMockRequest('DELETE', {}, {}, 'Bearer test-secret');
      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });

    it('should handle non-existent winner', async () => {
      const request = createMockRequest('DELETE', {}, {
        winner_id: 999999
      }, 'Bearer test-secret');
      
      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });
  });
});