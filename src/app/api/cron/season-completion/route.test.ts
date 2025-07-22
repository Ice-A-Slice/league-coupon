// Mock dependencies first before any imports
jest.mock('@/services/seasonCompletionDetectorService');
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
import { SeasonCompletionDetectorService } from '@/services/seasonCompletionDetectorService';
import { WinnerDeterminationService } from '@/services/winnerDeterminationService';
import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

const mockSeasonCompletionDetectorService = {
  detectAndMarkCompletedSeasons: jest.fn(),
};

const mockWinnerDeterminationService = {
  determineWinnersForCompletedSeasons: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('/api/cron/season-completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the service constructors to return our mocks
    (SeasonCompletionDetectorService as jest.Mock).mockImplementation(() => mockSeasonCompletionDetectorService);
    (WinnerDeterminationService as jest.Mock).mockImplementation(() => mockWinnerDeterminationService);
    
    // Mock logger
    jest.mocked(logger).info = mockLogger.info;
    jest.mocked(logger).error = mockLogger.error;
    jest.mocked(logger).warn = mockLogger.warn;
    
    // Mock service role client
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({});
    
    // Default mock for winner determination (no completed seasons to process)
    mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([]);
    
    // Clear NextResponse mock
    mockNextResponseJson.mockClear();
  });

  describe('Authentication', () => {
    it('should reject requests without CRON_SECRET', async () => {
      const request = new Request('http://localhost/api/cron/season-completion');
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
    });

    it('should reject requests with invalid CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer wrong-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
    });

    it('should accept requests with valid Bearer token', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [],
        errors: [],
        processedCount: 0,
        skippedCount: 0
      });

      const request = new Request('http://localhost/api/cron/season-completion', {
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
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [],
        errors: [],
        processedCount: 0,
        skippedCount: 0
      });

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'X-Cron-Secret': 'correct-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        { status: 200 }
      );
    });
  });

  describe('Season completion detection', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should handle successful detection with no completed seasons', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [],
        errors: [],
        processedCount: 0,
        skippedCount: 2
      });

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          completed_seasons: 0,
          seasons_in_progress: 2,
          season_detection_error_count: 0,
          completed_season_ids: [],
          total_winners_determined: 0,
          winner_determination_error_count: 0,
          message: expect.stringContaining('0 seasons marked as complete. 0 winners determined')
        }),
        { status: 200 }
      );
    });

    it('should handle successful detection with completed seasons', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [1, 2],
        errors: [],
        processedCount: 2,
        skippedCount: 0
      });

      // Mock successful winner determination
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([
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
      ]);

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          completed_seasons: 2,
          seasons_in_progress: 0,
          season_detection_error_count: 0,
          completed_season_ids: [1, 2],
          total_winners_determined: 2,
          winner_determination_error_count: 0,
          message: expect.stringContaining('2 seasons marked as complete. 2 winners determined')
        }),
        { status: 200 }
      );
      
      // Should log completion with winner determination
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Marked 2 seasons as complete and determined 2 winners'),
        expect.any(Object)
      );
    });

    it('should handle detection with errors but still succeed if some seasons completed', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [1],
        errors: [new Error('Database error for season 2')],
        processedCount: 1,
        skippedCount: 0
      });

      // Mock successful winner determination for the one completed season
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        }
      ]);

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          completed_seasons: 1,
          season_detection_error_count: 1,
          detailed_season_detection_errors: ['Database error for season 2'],
          total_winners_determined: 1,
          winner_determination_error_count: 0
        }),
        { status: 200 }
      );
      
      // Should log warnings about season detection errors
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Some errors occurred during season detection'),
        expect.any(Object)
      );
    });

    it('should handle detection with only errors', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [],
        errors: [new Error('Database connection failed')],
        processedCount: 0,
        skippedCount: 0
      });

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          completed_seasons: 0,
          season_detection_error_count: 1,
          detailed_season_detection_errors: ['Database connection failed'],
          total_winners_determined: 0,
          winner_determination_error_count: 0
        }),
        { status: 200 }
      );
    });

    it('should handle service throwing an error', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockRejectedValue(
        new Error('Service initialization failed')
      );

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Season completion detection and winner determination failed',
          message: 'Service initialization failed'
        }),
        { status: 500 }
      );
      
      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cron job failed'),
        expect.any(Object)
      );
    });

    it('should handle winner determination errors without failing season completion', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [1],
        errors: [],
        processedCount: 1,
        skippedCount: 0
      });

      // Mock winner determination service throwing an error
      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockRejectedValue(
        new Error('Winner determination failed')
      );

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Should still succeed because season completion worked
          completed_seasons: 1,
          season_detection_error_count: 0,
          total_winners_determined: 0,
          winner_determination_error_count: 1,
          detailed_winner_determination_errors: ['Winner determination failed']
        }),
        { status: 200 }
      );
      
      // Should log winner determination error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Winner determination service failed'),
        expect.any(Object)
      );
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    it('should include all required fields in successful response', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockResolvedValue({
        completedSeasonIds: [1],
        errors: [],
        processedCount: 1,
        skippedCount: 2
      });

      mockWinnerDeterminationService.determineWinnersForCompletedSeasons.mockResolvedValue([
        {
          seasonId: 1,
          winners: [{ userId: 'user1', totalPoints: 100 }],
          totalPlayers: 5,
          isSeasonAlreadyDetermined: false,
          errors: []
        }
      ]);

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean),
          message: expect.any(String),
          duration_ms: expect.any(Number),
          total_seasons_checked: 3,
          completed_seasons: expect.any(Number),
          seasons_in_progress: expect.any(Number),
          season_detection_error_count: expect.any(Number),
          completed_season_ids: expect.any(Array),
          total_winners_determined: expect.any(Number),
          winner_determination_error_count: expect.any(Number),
          winner_determination_processed: expect.any(Number),
          timestamp: expect.any(String)
        }),
        { status: 200 }
      );
    });

    it('should include all required fields in error response', async () => {
      mockSeasonCompletionDetectorService.detectAndMarkCompletedSeasons.mockRejectedValue(
        new Error('Test error')
      );

      const request = new Request('http://localhost/api/cron/season-completion', {
        headers: { 'Authorization': 'Bearer test-secret' }
      });
      
      await GET(request);
      
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          message: expect.any(String),
          duration_ms: expect.any(Number),
          timestamp: expect.any(String)
        }),
        { status: 500 }
      );
    });
  });
}); 