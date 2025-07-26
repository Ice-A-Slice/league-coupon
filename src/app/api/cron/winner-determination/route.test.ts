// Mock dependencies first before any imports
jest.mock('@/services/winnerDeterminationService');
jest.mock('@/utils/logger');
jest.mock('@/utils/supabase/service');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// Mock next/server
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => {
      mockNextResponseJson(body, init); // Track calls
      return { 
        status: init?.status ?? 200, 
        body,
        json: async () => body // Make it easier to test
      }; 
    }),
  },
}));

import { GET } from './route';
import { WinnerDeterminationService } from '@/services/winnerDeterminationService';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { revalidatePath } from 'next/cache';

const mockWinnerDeterminationService = {
  determineWinnersForCompletedSeasons: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockRevalidatePath = jest.fn();

describe('/api/cron/winner-determination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the service constructor to return our mock
    (WinnerDeterminationService as jest.Mock).mockImplementation(() => mockWinnerDeterminationService);
    
    // Mock logger
    jest.mocked(logger).info = mockLogger.info;
    jest.mocked(logger).error = mockLogger.error;
    jest.mocked(logger).warn = mockLogger.warn;
    
    // Mock service role client
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({});
    
    // Mock revalidatePath
    (revalidatePath as jest.Mock).mockImplementation(mockRevalidatePath);
    
    // Clear NextResponse mock
    mockNextResponseJson.mockClear();
  });

  describe('Authentication', () => {
    it('should reject requests without CRON_SECRET environment variable', async () => {
      delete process.env.CRON_SECRET;
      
      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer any-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        { error: 'Server configuration error' }, 
        { status: 500 }
      );
    });

    it('should reject requests without CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'test-secret';
      const request = new Request('http://localhost/api/cron/winner-determination');
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
    });

    it('should reject requests with invalid CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer wrong-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
    });

    it('should accept requests with valid Bearer token', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([]);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer correct-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        { status: 200 }
      );
    });

    it('should accept requests with valid X-Cron-Secret header', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([]);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'X-Cron-Secret': 'correct-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        { status: 200 }
      );
    });
  });

  describe('Winner determination processing', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should handle successful processing with no seasons to process', async () => {
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([]);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total_seasons_processed: 0,
          total_winners_determined: 0,
          error_count: 0,
          message: expect.stringContaining('0 winners determined')
        }),
        { status: 200 }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No new winners to determine'),
        expect.any(Object)
      );
    });

    it('should handle successful processing with new winners determined', async () => {
      const mockResults = [
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        },
        {
          seasonId: 2,
          winners: [{ userId: 'user2', totalPoints: 95 }],
          totalPlayers: 3,
          isSeasonAlreadyDetermined: false,
          errors: []
        }
      ];

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue(mockResults);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total_seasons_processed: 2,
          total_winners_determined: 2,
          error_count: 0,
          message: expect.stringContaining('2 winners determined'),
          winner_determination_results: mockResults
        }),
        { status: 200 }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Winner determination completed successfully'),
        expect.any(Object)
      );

      // Should revalidate cache when winners are determined
      expect(mockRevalidatePath).toHaveBeenCalledWith('/standings');
    });

    it('should handle processing with already determined seasons', async () => {
      const mockResults = [
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: true, // Already determined
          errors: []
        },
        {
          seasonId: 2,
          winners: [{ userId: 'user2', totalPoints: 95 }],
          totalPlayers: 3,
          isSeasonAlreadyDetermined: false, // New determination
          errors: []
        }
      ];

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue(mockResults);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total_seasons_processed: 2,
          total_winners_determined: 1, // Only one new winner
          error_count: 0
        }),
        { status: 200 }
      );
    });

    it('should handle processing with some errors but still succeed', async () => {
      const mockResults = [
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        },
        {
          seasonId: 2,
          winners: [],
          totalPlayers: 3,
          isSeasonAlreadyDetermined: false,
          errors: [new Error('Database error for season 2')]
        }
      ];

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue(mockResults);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Should still succeed because we determined one winner
          total_seasons_processed: 2,
          total_winners_determined: 1,
          error_count: 1,
          detailed_errors: ['Database error for season 2']
        }),
        { status: 200 }
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('completed with some errors but determined winners successfully'),
        expect.any(Object)
      );
    });

    it('should handle processing with only errors', async () => {
      const mockResults = [
        {
          seasonId: 1,
          winners: [],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: [new Error('Database connection failed')]
        }
      ];

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue(mockResults);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false, // Should fail because no winners determined and has errors
          total_seasons_processed: 1,
          total_winners_determined: 0,
          error_count: 1,
          detailed_errors: ['Database connection failed']
        }),
        { status: 200 }
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('completed with errors and no winners determined'),
        expect.any(Object)
      );
    });

    it('should handle service throwing an error', async () => {
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockRejectedValue(
        new Error('Service initialization failed')
      );

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Winner determination failed',
          message: 'Service initialization failed'
        }),
        { status: 500 }
      );
      
      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Winner determination service failed'),
        expect.any(Object)
      );
    });

    it('should handle cache revalidation errors gracefully', async () => {
      const mockResults = [
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        }
      ];

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue(mockResults);
      mockRevalidatePath.mockImplementation(() => {
        throw new Error('Cache revalidation failed');
      });

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Should still succeed even if cache revalidation fails
          total_winners_determined: 1
        }),
        { status: 200 }
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to revalidate standings cache'),
        expect.any(Object)
      );
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should include all required fields in successful response', async () => {
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        }
      ]);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean),
          message: expect.any(String),
          timestamp: expect.any(String),
          duration_ms: expect.any(Number),
          total_seasons_processed: expect.any(Number),
          total_winners_determined: expect.any(Number),
          error_count: expect.any(Number),
          winner_determination_results: expect.any(Array)
        }),
        { status: 200 }
      );
    });

    it('should include all required fields in error response', async () => {
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockRejectedValue(
        new Error('Test error')
      );

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(String),
          duration_ms: expect.any(Number)
        }),
        { status: 500 }
      );
    });

    it('should only include detailed_errors when there are errors', async () => {
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([]);

      const request = new Request('http://localhost/api/cron/winner-determination', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      const callArgs = mockNextResponseJson.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('detailed_errors');
    });
  });
}); 