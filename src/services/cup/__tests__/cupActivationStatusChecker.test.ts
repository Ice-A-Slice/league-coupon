/**
 * @jest-environment node
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { cupActivationStatusChecker } from '../cupActivationStatusChecker';
import {
  connectToTestDb,
  resetDatabase,
  disconnectDb,
  testIds,
} from '../../../../tests/utils/db';

// Mock next/cache since we don't need it for testing
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('Cup Activation Status Checker Integration Tests', () => {
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

  describe('checkCurrentSeasonActivationStatus', () => {
    it('should return not activated status for seeded season (default)', async () => {
      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: testIds.season,
        seasonName: '2024 Season'
      });
    });

    it('should return activated status when current season has cup activated', async () => {
      // Activate the cup for the current season
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2025-01-27T10:00:00Z'
        })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: true,
        activatedAt: '2025-01-27T10:00:00+00:00',
        seasonId: testIds.season,
        seasonName: '2024 Season'
      });
    });

    it('should handle null last_round_special_activated field', async () => {
      // Explicitly set last_round_special_activated to null
      await client
        .from('seasons')
        .update({
          last_round_special_activated: null,
          last_round_special_activated_at: null
        })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: testIds.season,
        seasonName: '2024 Season'
      });
    });

    it('should return default values when no current season exists', async () => {
      // Remove is_current flag from all seasons
      await client
        .from('seasons')
        .update({ is_current: false })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: null,
        seasonName: null
      });
    });
  });

  describe('checkSeasonActivationStatus', () => {
    it('should return activated status for specific season when cup is activated', async () => {
      // Activate the cup for the test season
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2024-03-15T14:30:00Z'
        })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(testIds.season!);

      expect(result).toEqual({
        isActivated: true,
        activatedAt: '2024-03-15T14:30:00+00:00',
        seasonId: testIds.season,
        seasonName: '2024 Season'
      });
    });

    it('should return not activated status for specific season when cup is not activated', async () => {
      // Ensure cup is not activated (default state from seeding)
      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(testIds.season!);

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: testIds.season,
        seasonName: '2024 Season'
      });
    });

    it('should return default values when season is not found', async () => {
      const result = await cupActivationStatusChecker.checkSeasonActivationStatus(999999);

      expect(result).toEqual({
        isActivated: false,
        activatedAt: null,
        seasonId: 999999,
        seasonName: null
      });
    });

    it('should throw error for invalid season ID', async () => {
      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(0))
        .rejects.toThrow('Valid season ID is required');

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(-1))
        .rejects.toThrow('Valid season ID is required');

      await expect(cupActivationStatusChecker.checkSeasonActivationStatus(null as unknown as number))
        .rejects.toThrow('Valid season ID is required');
    });
  });

  describe('isCurrentSeasonCupActivated', () => {
    it('should return true when current season cup is activated', async () => {
      // Activate the cup for the current season
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2025-01-27T10:00:00Z'
        })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(true);
    });

    it('should return false when current season cup is not activated', async () => {
      // Default seeded state has cup not activated
      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(false);
    });

    it('should return false when no current season exists', async () => {
      // Remove is_current flag from all seasons
      await client
        .from('seasons')
        .update({ is_current: false })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.isCurrentSeasonCupActivated();
      expect(result).toBe(false);
    });
  });

  describe('isSeasonCupActivated', () => {
    it('should return true when specified season cup is activated', async () => {
      // Activate the cup for the test season
      await client
        .from('seasons')
        .update({
          last_round_special_activated: true,
          last_round_special_activated_at: '2023-04-10T16:20:00Z'
        })
        .eq('id', testIds.season!);

      const result = await cupActivationStatusChecker.isSeasonCupActivated(testIds.season!);
      expect(result).toBe(true);
    });

    it('should return false when specified season cup is not activated', async () => {
      // Default seeded state has cup not activated
      const result = await cupActivationStatusChecker.isSeasonCupActivated(testIds.season!);
      expect(result).toBe(false);
    });

    it('should return false when specified season does not exist', async () => {
      const result = await cupActivationStatusChecker.isSeasonCupActivated(999999);
      expect(result).toBe(false);
    });
  });
}); 