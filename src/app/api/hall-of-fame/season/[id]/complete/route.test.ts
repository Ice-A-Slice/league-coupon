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
} from '../../../../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// Mock crypto.randomUUID for consistent test output
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
  },
});

describe('/api/hall-of-fame/season/[id]/complete - Hall of Fame Season Complete API Integration Tests', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null }>;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase(true);
    
    // Create test profiles for winners
    testProfiles = [
      { id: 'winner-user-1', full_name: 'John League Winner' },
      { id: 'winner-user-2', full_name: 'Jane Cup Winner' },
      { id: 'winner-user-3', full_name: 'Alex Legacy Winner' },
    ];
    await createTestProfiles(testProfiles);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = (seasonId: string) => {
    const url = `http://localhost/api/hall-of-fame/season/${seasonId}/complete`;
    return new NextRequest(url, { method: 'GET' });
  };

  const createMockParams = (id: string) => Promise.resolve({ id });

  const createSeasonWinners = async (seasonId: number, scenarios: 'both' | 'league-only' | 'cup-only' | 'none' | 'legacy') => {
    const winners = [];

    if (scenarios === 'both') {
      winners.push(
        {
          season_id: seasonId,
          user_id: testProfiles[0].id,
          league_id: testIds.competition!,
          total_points: 167,
          game_points: 137,
          dynamic_points: 30,
          competition_type: 'league',
        },
        {
          season_id: seasonId,
          user_id: testProfiles[1].id,
          league_id: testIds.competition!,
          total_points: 45,
          game_points: 45,
          dynamic_points: 0,
          competition_type: 'last_round_special',
        }
      );
    } else if (scenarios === 'league-only') {
      winners.push({
        season_id: seasonId,
        user_id: testProfiles[0].id,
        league_id: testIds.competition!,
        total_points: 165,
        game_points: 135,
        dynamic_points: 30,
        competition_type: 'league',
      });
    } else if (scenarios === 'cup-only') {
      winners.push({
        season_id: seasonId,
        user_id: testProfiles[1].id,
        league_id: testIds.competition!,
        total_points: 50,
        game_points: 50,
        dynamic_points: 0,
        competition_type: 'last_round_special',
      });
    } else if (scenarios === 'legacy') {
      // Legacy data without competition_type (should default to league)
      winners.push({
        season_id: seasonId,
        user_id: testProfiles[2].id,
        league_id: testIds.competition!,
        total_points: 150,
        game_points: 120,
        dynamic_points: 30,
        competition_type: null, // Legacy data
      });
    }

    if (winners.length > 0) {
      await client
        .from('season_winners')
        .insert(winners);
    }
  };

  const updateSeasonCupStatus = async (seasonId: number, activated: boolean) => {
    await client
      .from('seasons')
      .update({
        last_round_special_activated: activated,
        last_round_special_activated_at: activated ? '2024-04-01T00:00:00Z' : null,
      })
      .eq('id', seasonId);
  };

  const markSeasonCompleted = async (seasonId: number, completed = true) => {
    await client
      .from('seasons')
      .update({
        completed_at: completed ? '2024-05-31T23:59:59Z' : null,
        winner_determined_at: completed ? '2024-06-01T00:00:00Z' : null,
      })
      .eq('id', seasonId);
  };

  describe('GET /api/hall-of-fame/season/[id]/complete', () => {
    it('should return complete season data with both league and cup winners', async () => {
      const seasonId = testIds.season!;
      
      // Setup: Mark season completed, activate cup, create both winners
      await markSeasonCompleted(seasonId, true);
      await updateSeasonCupStatus(seasonId, true);
      await createSeasonWinners(seasonId, 'both');

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(seasonId);
      expect(responseData.data.league_winners).toHaveLength(1);
      expect(responseData.data.cup_winners).toHaveLength(1);
      
      // Check league winner
      expect(responseData.data.league_winners[0].competition_type).toBe('league');
      expect(responseData.data.league_winners[0].profile.full_name).toBe('John League Winner');
      expect(responseData.data.league_winners[0].total_points).toBe(167);
      
      // Check cup winner
      expect(responseData.data.cup_winners[0].competition_type).toBe('last_round_special');
      expect(responseData.data.cup_winners[0].profile.full_name).toBe('Jane Cup Winner');
      expect(responseData.data.cup_winners[0].total_points).toBe(45);
      
      // Check season data
      expect(responseData.data.season.last_round_special_activated).toBe(true);
      expect(responseData.data.season.completed_at).toBeTruthy();
      
      // Check metadata
      expect(responseData.metadata.has_league_winners).toBe(true);
      expect(responseData.metadata.has_cup_winners).toBe(true);
      expect(responseData.metadata.league_winners_count).toBe(1);
      expect(responseData.metadata.cup_winners_count).toBe(1);
      expect(responseData.metadata.cup_was_activated).toBe(true);
    });

    it('should return season with only league winner when cup was not activated', async () => {
      const seasonId = testIds.season!;
      
      // Setup: Mark season completed, no cup activation, create league winner only
      await markSeasonCompleted(seasonId, true);
      await updateSeasonCupStatus(seasonId, false);
      await createSeasonWinners(seasonId, 'league-only');

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(seasonId);
      expect(responseData.data.league_winners).toHaveLength(1);
      expect(responseData.data.cup_winners).toHaveLength(0);
      expect(responseData.data.season.last_round_special_activated).toBe(false);
      
      expect(responseData.metadata.has_league_winners).toBe(true);
      expect(responseData.metadata.has_cup_winners).toBe(false);
      expect(responseData.metadata.cup_was_activated).toBe(false);
    });

    it('should return season with no winners when season is not completed', async () => {
      const seasonId = testIds.season!;
      
      // Setup: Season not completed (default state), no winners
      await updateSeasonCupStatus(seasonId, false);
      await createSeasonWinners(seasonId, 'none');

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.season_id).toBe(seasonId);
      expect(responseData.data.league_winners).toHaveLength(0);
      expect(responseData.data.cup_winners).toHaveLength(0);
      expect(responseData.data.season.completed_at).toBeNull();
      
      expect(responseData.metadata.has_league_winners).toBe(false);
      expect(responseData.metadata.has_cup_winners).toBe(false);
    });

    it('should handle legacy data without competition_type correctly', async () => {
      const seasonId = testIds.season!;
      
      // Setup: Legacy winner without competition_type
      await markSeasonCompleted(seasonId, true);
      await updateSeasonCupStatus(seasonId, false);
      await createSeasonWinners(seasonId, 'legacy');

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.league_winners).toHaveLength(1);
      expect(responseData.data.cup_winners).toHaveLength(0);
      
      // Legacy data should be treated as league winner
      expect(responseData.data.league_winners[0].competition_type).toBe('league');
      expect(responseData.data.league_winners[0].profile.full_name).toBe('Alex Legacy Winner');
    });

    it('should return 400 for invalid season ID', async () => {
      const request = createMockRequest('invalid');
      const params = createMockParams('invalid');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 400 for floating point season ID', async () => {
      const request = createMockRequest('1.5');
      const params = createMockParams('1.5');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 400 for negative season ID', async () => {
      const request = createMockRequest('-1');
      const params = createMockParams('-1');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid season ID');
    });

    it('should return 404 when season does not exist', async () => {
      const request = createMockRequest('999999');
      const params = createMockParams('999999');

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Season not found');
    });

    it('should include proper caching headers', async () => {
      const seasonId = testIds.season!;

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=600');
    });

    it('should handle multiple winners of same type correctly', async () => {
      const seasonId = testIds.season!;
      
      // Create multiple league winners (tied scenario)
      await markSeasonCompleted(seasonId, true);
      await client
        .from('season_winners')
        .insert([
          {
            season_id: seasonId,
            user_id: testProfiles[0].id,
            league_id: testIds.competition!,
            total_points: 160,
            game_points: 130,
            dynamic_points: 30,
            competition_type: 'league',
          },
          {
            season_id: seasonId,
            user_id: testProfiles[1].id,
            league_id: testIds.competition!,
            total_points: 160, // Same score - tied winners
            game_points: 130,
            dynamic_points: 30,
            competition_type: 'league',
          }
        ]);

      const request = createMockRequest(seasonId.toString());
      const params = createMockParams(seasonId.toString());

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.league_winners).toHaveLength(2);
      expect(responseData.data.cup_winners).toHaveLength(0);
      expect(responseData.metadata.league_winners_count).toBe(2);
      expect(responseData.metadata.cup_winners_count).toBe(0);
    });
  });
});