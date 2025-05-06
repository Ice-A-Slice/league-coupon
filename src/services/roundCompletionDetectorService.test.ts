import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// The server-only module is automatically mocked from __mocks__/server-only.js
jest.mock('server-only');

// Mock the Supabase client before importing the service
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockImplementation((_table) => {
      // Default mock implementation that can be overridden in tests
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  },
}));

// Import logger for spying in tests
import { logger } from '@/utils/logger';

// Import after mocking
import { roundCompletionDetectorService } from './roundCompletionDetectorService';
import { supabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

// Type definitions for mocks - prefixed with _ to indicate they're used for type checking
// but may not be directly referenced in the code
type _MockBettingRound = Database['public']['Tables']['betting_rounds']['Row'];
type _MockFixture = Database['public']['Tables']['fixtures']['Row'];
type MockBettingRoundFixture = Database['public']['Tables']['betting_round_fixtures']['Row']; // Used in the tests

describe('RoundCompletionDetectorService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('detectAndMarkCompletedRounds', () => {
    it('should exist as a function on the service', () => {
      expect(typeof roundCompletionDetectorService.detectAndMarkCompletedRounds).toBe('function');
    });

    it('should detect a completed round and mark its status as scoring', async () => {
      // Arrange: Mock Data
      const roundIdToCheck = 1;
      const fixtureId1 = 101;
      const fixtureId2 = 102;

      // Setup mock responses
      const mockOpenRounds = [{ id: roundIdToCheck }];
      const mockLinks = [
        { fixture_id: fixtureId1 },
        { fixture_id: fixtureId2 },
      ];
      const mockFixtures = [
        { status_short: 'FT' }, // Finished
        { status_short: 'AET' }, // Finished
      ];

      // Create a fresh mock for the from method
      const fromMock = jest.fn();
      
      // First call - get open rounds
      fromMock.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        eq: jest.fn().mockResolvedValue({
          data: mockOpenRounds,
          error: null
        }),
      }));
      
      // Second call - get round fixtures
      fromMock.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        eq: jest.fn().mockResolvedValue({
          data: mockLinks,
          error: null
        }),
      }));
      
      // Third call - get fixtures
      fromMock.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        in: jest.fn().mockResolvedValue({
          data: mockFixtures,
          error: null
        }),
      }));
      
      // Fourth call - update round status
      fromMock.mockImplementationOnce(() => ({
        update: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
      }));
      
      // Replace the from implementation
      // @ts-expect-error - Mock implementation
      jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);

      // Act
      const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.completedRoundIds).toEqual([roundIdToCheck]);
      
      // Verify the from method was called 4 times
      expect(fromMock).toHaveBeenCalledTimes(4);
    });

    it('should return success with no completed rounds if no open rounds are found', async () => {
      // Arrange: Mock empty response for open rounds
      const fromMock = jest.fn();
      
      fromMock.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        // @ts-expect-error - Mock implementation
        eq: jest.fn().mockResolvedValue({
          data: [], // No open rounds
          error: null
        }),
      }));
      
      // @ts-expect-error - Mock implementation
      jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);

      // Act
      const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.completedRoundIds).toEqual([]);
      
      // Verify only one call was made
      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(fromMock).toHaveBeenCalledWith('betting_rounds');
    });

    // TEST: Round with Unfinished Fixtures
    it('should not mark a round if at least one fixture is not finished', async () => {
        // Arrange: Mock Data
        const roundIdToCheck = 2;
        const fixtureId3 = 103;
        const fixtureId4 = 104;

        const mockOpenRounds = [{ id: roundIdToCheck }];
        const mockLinks = [
            { fixture_id: fixtureId3 },
            { fixture_id: fixtureId4 },
        ];
        const mockFixtures = [
            { status_short: 'FT' },    // Finished
            { status_short: 'NS' },    // Not Started
        ];

        // Arrange: Mock Client Behavior
        const fromMock = jest.fn();
        const updateMock = jest.fn(); // To verify update is NOT called

        // Call 1: Fetch open rounds
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockOpenRounds, error: null }),
        }));

        // Call 2: Fetch fixture links
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null }),
        }));

        // Call 3: Fetch fixtures
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            in: jest.fn().mockResolvedValue({ data: mockFixtures, error: null }),
        }));

        // Mock the update specifically to track if it gets called
        // Although the implementation shouldn't reach this table call
        fromMock.mockImplementationOnce(() => ({
            update: updateMock.mockReturnThis(), 
            eq: jest.fn().mockReturnThis(), // Need to chain eq
        }));

        // @ts-expect-error - Mock implementation for Supabase client
        jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);

        // Act
        const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

        // Assert
        expect(result.errors).toHaveLength(0);
        expect(result.completedRoundIds).toEqual([]); // No rounds should be completed

        // Verify calls
        expect(fromMock).toHaveBeenCalledTimes(3); // rounds(select), links(select), fixtures(select)
        expect(fromMock).toHaveBeenCalledWith('betting_rounds');
        expect(fromMock).toHaveBeenCalledWith('betting_round_fixtures');
        expect(fromMock).toHaveBeenCalledWith('fixtures');
        
        // Crucially, verify the update was NOT called
        expect(updateMock).not.toHaveBeenCalled();
    });

    // TEST: Round with No Linked Fixtures
    it('should handle rounds with no linked fixtures gracefully (log warning, consider incomplete)', async () => {
        // Arrange: Mock Data
        const roundIdToCheck = 3;
        const mockOpenRounds = [{ id: roundIdToCheck }];
        // Explicitly type mockLinks using the defined alias
        const mockLinks: Pick<MockBettingRoundFixture, 'fixture_id'>[] = []; // Empty array for links

        // Arrange: Mock Client Behavior
        const fromMock = jest.fn();
        const updateMock = jest.fn(); // To verify update is NOT called

        // Call 1: Fetch open rounds
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockOpenRounds, error: null }),
        }));

        // Call 2: Fetch fixture links (returns empty)
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null }),
        }));
        
        // Mock the update specifically to track if it gets called
        // Although the implementation shouldn't reach this table call
        fromMock.mockImplementationOnce(() => ({
            update: updateMock.mockReturnThis(), 
            eq: jest.fn().mockReturnThis(), 
        }));

        // @ts-expect-error - Mock implementation for Supabase client
        jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);

        // Spy on logger.warn to check the warning message
        const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        // Act
        const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

        // Assert
        expect(result.errors).toHaveLength(0);
        expect(result.completedRoundIds).toEqual([]); // No rounds should be completed

        // Verify calls
        expect(fromMock).toHaveBeenCalledTimes(2); // rounds(select), links(select)
        expect(fromMock).toHaveBeenCalledWith('betting_rounds');
        expect(fromMock).toHaveBeenCalledWith('betting_round_fixtures');
        
        // Verify update was NOT called
        expect(updateMock).not.toHaveBeenCalled();
        
        // Verify warning was logged
        expect(loggerWarnSpy).toHaveBeenCalledWith({ roundId: roundIdToCheck }, 'No fixtures found linked to this round. Considering it incomplete.');

        loggerWarnSpy.mockRestore(); // Clean up spy
    });

    // TEST: Error Fetching Open Rounds
    it('should return errors if fetching open rounds fails', async () => {
        // Arrange: Mock Client Behavior - Simulate error fetching open rounds
        const dbError = new Error('Database connection error');
        const fromMock = jest.fn();

        // Call 1: Fetch open rounds (fails)
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: null, error: dbError }),
        }));

        // @ts-expect-error - Mock implementation for Supabase client
        jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);
        
        // Spy on logger.error
        const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

        // Assert
        expect(result.completedRoundIds).toEqual([]);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(`Failed to fetch open rounds: ${dbError.message}`);

        // Verify only the first DB call was attempted
        expect(fromMock).toHaveBeenCalledTimes(1);
        expect(fromMock).toHaveBeenCalledWith('betting_rounds');
        
        // Verify error was logged
        expect(loggerErrorSpy).toHaveBeenCalledWith({ error: dbError }, 'Error fetching open betting rounds');

        loggerErrorSpy.mockRestore(); // Clean up spy
    });

    // TEST: Error Updating Round Status
    it('should return errors if updating round status fails', async () => {
        // Arrange: Mock Data (Similar to happy path)
        const roundIdToCheck = 4;
        const fixtureId5 = 105;
        const mockOpenRounds = [{ id: roundIdToCheck }];
        const mockLinks = [{ fixture_id: fixtureId5 }];
        const mockFixtures = [{ status_short: 'FT' }];
        const dbUpdateError = new Error('Failed to update row');

        // Arrange: Mock Client Behavior
        const fromMock = jest.fn();

        // Call 1: Fetch open rounds (Success)
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockOpenRounds, error: null }),
        }));

        // Call 2: Fetch fixture links (Success)
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: mockLinks, error: null }),
        }));

        // Call 3: Fetch fixtures (Success)
        fromMock.mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            in: jest.fn().mockResolvedValue({ data: mockFixtures, error: null }),
        }));

        // Call 4: Update round status (FAILS)
        fromMock.mockImplementationOnce(() => ({
            update: jest.fn().mockReturnThis(),
            // @ts-expect-error - Mock response data structure
            eq: jest.fn().mockResolvedValue({ data: null, error: dbUpdateError }),
        }));

        // @ts-expect-error - Mock implementation for Supabase client
        jest.spyOn(supabaseServerClient, 'from').mockImplementation(fromMock);

        // Spy on logger.error
        const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        const result = await roundCompletionDetectorService.detectAndMarkCompletedRounds();

        // Assert
        expect(result.completedRoundIds).toEqual([]); // No rounds successfully marked
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(`Failed to update round ${roundIdToCheck} status: ${dbUpdateError.message}`);

        // Verify calls
        expect(fromMock).toHaveBeenCalledTimes(4); // rounds(select), links(select), fixtures(select), rounds(update)
        
        // Verify error was logged
        expect(loggerErrorSpy).toHaveBeenCalledWith({ error: dbUpdateError, roundId: roundIdToCheck }, 'Error updating round status to scoring');

        loggerErrorSpy.mockRestore(); // Clean up spy
    });
  });
});