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
} from '../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('/api/standings - Standings API Integration Tests', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null }>;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase(true);
    
    // Create test profiles for standings
    testProfiles = [
      { id: 'standings-user-1', full_name: 'Test User 1' },
      { id: 'standings-user-2', full_name: 'Test User 2' },
      { id: 'standings-user-3', full_name: 'Test User 3' },
    ];
    await createTestProfiles(testProfiles);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = () => {
    return new NextRequest('http://localhost/api/standings', {
      method: 'GET'
    });
  };

  describe('GET /api/standings', () => {
    it('should return league standings with inactive cup status by default', async () => {
      // Create some user bets for league standings data
      await client
        .from('user_bets')
        .insert([
          {
            user_id: testProfiles[0].id,
            betting_round_id: testIds.bettingRounds[0],
            fixture_id: testIds.fixtures[0],
            home_goals: 2,
            away_goals: 1,
            points_awarded: 3
          },
          {
            user_id: testProfiles[1].id,
            betting_round_id: testIds.bettingRounds[0],
            fixture_id: testIds.fixtures[0],
            home_goals: 1,
            away_goals: 1,
            points_awarded: 1
          }
        ]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should have league standings
      expect(data.league_standings).toBeDefined();
      expect(Array.isArray(data.league_standings)).toBe(true);

      // Cup should not be active by default
      expect(data.cup.is_active).toBe(false);
      expect(data.cup.season_id).toBe(testIds.season);
      expect(data.cup.season_name).toBe('2024 Season');
      expect(data.cup.activated_at).toBeNull();
      expect(data.cup.standings).toBeUndefined();

      // Should have metadata
      expect(data.metadata).toBeDefined();
      expect(data.metadata.timestamp).toBeDefined();
      expect(data.metadata.has_cup_data).toBe(false);
      expect(data.metadata.total_league_participants).toBeDefined();
    });

    it('should include cache headers', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBeTruthy();
    });

    it('should return both league and cup standings when cup is active', async () => {
      // Activate the cup for current season
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2025-01-20T10:00:00Z'
        })
        .eq('id', testIds.season!);

      // Create some user bets for league standings
      await client
        .from('user_bets')
        .insert([
          {
            user_id: testProfiles[0].id,
            betting_round_id: testIds.bettingRounds[0],
            fixture_id: testIds.fixtures[0],
            home_goals: 2,
            away_goals: 1,
            points_awarded: 3
          },
          {
            user_id: testProfiles[1].id,
            betting_round_id: testIds.bettingRounds[0],
            fixture_id: testIds.fixtures[0],
            home_goals: 1,
            away_goals: 1,
            points_awarded: 2
          }
        ]);

      // Create some cup standings data
      await client
        .from('user_last_round_special_points')
        .insert([
          {
            user_id: testProfiles[0].id,
            betting_round_id: testIds.bettingRounds[0],
            season_id: testIds.season!,
            points: 15
          },
          {
            user_id: testProfiles[1].id,
            betting_round_id: testIds.bettingRounds[0],
            season_id: testIds.season!,
            points: 10
          }
        ]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Should have league standings
      expect(data.league_standings).toBeDefined();
      expect(Array.isArray(data.league_standings)).toBe(true);

      // Cup should be active
      expect(data.cup.is_active).toBe(true);
      expect(data.cup.season_id).toBe(testIds.season);
      expect(data.cup.season_name).toBe('2024 Season');
      expect(data.cup.activated_at).toBe('2025-01-20T10:00:00+00:00');
      
      // Should have cup standings with enhanced user data
      expect(data.cup.standings).toBeDefined();
      expect(Array.isArray(data.cup.standings)).toBe(true);
      if (data.cup.standings && data.cup.standings.length > 0) {
        const firstStanding = data.cup.standings[0];
        expect(firstStanding.user_id).toBeDefined();
        expect(firstStanding.user).toBeDefined();
        expect(firstStanding.user.id).toBeDefined();
        expect(firstStanding.user.full_name).toBeDefined();
        expect(firstStanding.total_points).toBeDefined();
        expect(firstStanding.position).toBeDefined();
      }

      // Should have metadata with cup data
      expect(data.metadata.has_cup_data).toBe(true);
      expect(data.metadata.total_cup_participants).toBeDefined();
    });

    it('should handle cup standings fetch failure gracefully', async () => {
      // Activate the cup but don't create cup standings data
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2025-01-20T10:00:00Z'
        })
        .eq('id', testIds.season!);

      // Create league standings data
      await client
        .from('user_bets')
        .insert([
          {
            user_id: testProfiles[0].id,
            betting_round_id: testIds.bettingRounds[0],
            fixture_id: testIds.fixtures[0],
            home_goals: 2,
            away_goals: 1,
            points_awarded: 3
          }
        ]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should still have league standings
      expect(data.league_standings).toBeDefined();
      
      // Cup should be active but have empty standings
      expect(data.cup.is_active).toBe(true);
      expect(data.cup.standings).toBeDefined();
      expect(data.cup.standings).toEqual([]);
      expect(data.metadata.total_cup_participants).toBe(0);
    });

    it('should return league standings when no current season exists', async () => {
      // Remove is_current flag from all seasons
      await client
        .from('seasons')
        .update({ is_current: false })
        .eq('id', testIds.season!);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should still have league standings (empty)
      expect(data.league_standings).toBeDefined();
      expect(Array.isArray(data.league_standings)).toBe(true);

      // Cup should not be active with null season info
      expect(data.cup.is_active).toBe(false);
      expect(data.cup.season_id).toBeNull();
      expect(data.cup.season_name).toBeNull();
      expect(data.metadata.has_cup_data).toBe(false);
    });

    it('should maintain backward compatibility with league_standings field', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Must always include league_standings field for backward compatibility
      expect(data.league_standings).toBeDefined();
      expect(Array.isArray(data.league_standings)).toBe(true);
    });

    it('should include performance metadata', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should have performance metadata
      expect(data.metadata).toBeDefined();
      expect(data.metadata.timestamp).toBeDefined();
      expect(typeof data.metadata.timestamp).toBe('string');
      expect(data.metadata.total_league_participants).toBeDefined();
      expect(typeof data.metadata.total_league_participants).toBe('number');
    });
  });
});