// import { jest } from '@jest/globals'; // Removed unused import
// Removed unused import: import { RoundManagementService } from './roundManagementService';
// Removed unused import: import { calculateTimeDifference } from '@/lib/utils';
// Removed unused import: import { describe, it, expect, beforeEach } from '@jest/globals';
import { describe, it, expect } from '@jest/globals'; // Import only used functions

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import the actual service export (lowercase 'r')
import { roundManagementService } from './roundManagementService';
// Import the missing Tables type
import { Tables } from '@/types/supabase';

// Need the actual service for its static/instance methods if testing the class directly
// If just testing the helper function, this might not be needed.
// Re-importing RoundManagementService as it's likely needed for the `describe` block target
// Corrected import statement syntax
// Removed unused class import, kept the actual service export
// import { RoundManagementService } from './roundManagementService'; 

// Define Fixture type - Use the actual type imported if possible, 
// but ensure mock data matches required fields.
type MockFixture = Partial<Tables<'fixtures'> & { id: number; kickoff: string }> & {
  // Add required non-nullable fields for type safety
  id: number;
  kickoff: string;
  api_fixture_id: number;
  away_team_id: number;
  home_team_id: number;
  round_id: number;
  status_short: string;
};

describe('roundManagementService', () => {
  describe('defineAndOpenNextBettingRound', () => {
    it('should exist as a function on the service', () => {
      // Basic check to ensure the function is exported correctly
      expect(typeof roundManagementService.defineAndOpenNextBettingRound).toBe('function');
    });

    // --- TODO: Add detailed behavior tests as functionality is implemented --- 
    it.todo('should check for existing open rounds before proceeding');
  });

  // --- Tests for groupFixturesForRound --- 
  describe('groupFixturesForRound', () => {
    // Create fixtures with specific time gaps to test the grouping logic
    // These fixtures have a 72+ hour gap between fixture 3 and 4
    const fixturesWithGap: MockFixture[] = [
      { id: 1, kickoff: '2024-01-01T10:00:00Z', api_fixture_id: 101, away_team_id: 1, home_team_id: 2, round_id: 1, status_short: 'NS' }, 
      { id: 2, kickoff: '2024-01-02T10:00:00Z', api_fixture_id: 102, away_team_id: 3, home_team_id: 4, round_id: 1, status_short: 'NS' }, 
      { id: 3, kickoff: '2024-01-03T10:00:00Z', api_fixture_id: 103, away_team_id: 5, home_team_id: 6, round_id: 1, status_short: 'NS' }, 
      // 4-day gap (96 hours) between fixture 3 and 4
      { id: 4, kickoff: '2024-01-07T10:00:00Z', api_fixture_id: 104, away_team_id: 7, home_team_id: 8, round_id: 2, status_short: 'NS' }, 
      { id: 5, kickoff: '2024-01-08T10:00:00Z', api_fixture_id: 105, away_team_id: 9, home_team_id: 10, round_id: 2, status_short: 'NS' }, 
    ];

    // These fixtures have no significant gaps (all less than 72 hours)
    const fixturesWithoutGap: MockFixture[] = [
      { id: 1, kickoff: '2024-01-01T10:00:00Z', api_fixture_id: 101, away_team_id: 1, home_team_id: 2, round_id: 1, status_short: 'NS' }, 
      { id: 2, kickoff: '2024-01-02T10:00:00Z', api_fixture_id: 102, away_team_id: 3, home_team_id: 4, round_id: 1, status_short: 'NS' }, 
      { id: 3, kickoff: '2024-01-03T10:00:00Z', api_fixture_id: 103, away_team_id: 5, home_team_id: 6, round_id: 1, status_short: 'NS' }, 
      // Only 2-day gap (48 hours) between fixture 3 and 4
      { id: 4, kickoff: '2024-01-05T10:00:00Z', api_fixture_id: 104, away_team_id: 7, home_team_id: 8, round_id: 2, status_short: 'NS' }, 
      { id: 5, kickoff: '2024-01-06T10:00:00Z', api_fixture_id: 105, away_team_id: 9, home_team_id: 10, round_id: 2, status_short: 'NS' }, 
    ];

    it('should group fixtures before the first gap > 72 hours', async () => {
      const result = await roundManagementService.groupFixturesForRound(fixturesWithGap as Tables<'fixtures'>[]);
      
      expect(result).toHaveLength(3);
      expect(result?.map((f: Tables<'fixtures'>) => f.id)).toEqual([1, 2, 3]); // Check IDs
    });

    it('should return all fixtures if no gap exceeds the threshold', async () => {
      const result = await roundManagementService.groupFixturesForRound(fixturesWithoutGap as Tables<'fixtures'>[]);
      
      expect(result).toHaveLength(5);
      expect(result?.map((f: Tables<'fixtures'>) => f.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return a valid group for a single fixture', async () => {
      const singleFixture: MockFixture[] = [
        { id: 1, kickoff: '2024-01-01T10:00:00Z', api_fixture_id: 101, away_team_id: 1, home_team_id: 2, round_id: 1, status_short: 'NS' }
      ];
      
      const result = await roundManagementService.groupFixturesForRound(singleFixture as Tables<'fixtures'>[]);
      
      expect(result).toHaveLength(1);
      expect(result?.map((f: Tables<'fixtures'>) => f.id)).toEqual([1]);
    });

    it('should return null if the input array is empty', async () => {
      const result = await roundManagementService.groupFixturesForRound([]);
      expect(result).toBeNull();
    });
  });

  // TODO: Add describe blocks for other service methods if they are added later
});