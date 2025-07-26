/**
 * @jest-environment node
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { calculateRoundCupPoints, getCupStandings } from '../cupScoringService';
import {
  connectToTestDb,
  resetDatabase,
  disconnectDb,
  createTestProfiles,
  testIds,
} from '../../../../tests/utils/db';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('Cup Scoring Service Integration Tests', () => {
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase(true);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('calculateRoundCupPoints', () => {
    it('should skip calculation when cup not activated', async () => {
      // Use a betting round from seeded test data
      const bettingRoundId = testIds.bettingRounds[0];
      
      const result = await calculateRoundCupPoints(bettingRoundId);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cup not activated');
      expect(result.details.pointsCalculated).toBe(0);
    });

    it('should accept options parameter', async () => {
      const bettingRoundId = testIds.bettingRounds[0];
      const options = { onlyAfterActivation: false };
      
      const result = await calculateRoundCupPoints(bettingRoundId, options);
      
      // Should get further in execution since we're not checking activation
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('getCupStandings', () => {
    it('should return empty array for season with no cup participants', async () => {
      const seasonId = testIds.season!;
      
      const result = await getCupStandings(seasonId);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle current season when no season ID provided', async () => {
      const result = await getCupStandings();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle season with cup participants', async () => {
      const seasonId = testIds.season!;
      
      // Create test profiles for cup participants
      const testProfiles = [
        { id: 'cup-user-1', full_name: 'Cup Participant 1' },
        { id: 'cup-user-2', full_name: 'Cup Participant 2' },
      ];
      await createTestProfiles(testProfiles);
      
      // Add some last round special points for these users
      const { error } = await client
        .from('user_last_round_special_points')
        .insert([
          {
            user_id: testProfiles[0].id,
            betting_round_id: testIds.bettingRounds[0],
            season_id: seasonId,
            points: 15
          },
          {
            user_id: testProfiles[1].id,
            betting_round_id: testIds.bettingRounds[0],
            season_id: seasonId,
            points: 10
          }
        ]);

      if (error) {
        throw new Error(`Failed to seed cup points: ${error.message}`);
      }
      
      const result = await getCupStandings(seasonId);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
}); 