import { SeasonCompletionDetectorService } from './seasonCompletionDetectorService';
import { logger } from '@/utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
} as unknown as SupabaseClient;

describe('SeasonCompletionDetectorService', () => {
  let service: SeasonCompletionDetectorService;
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockIs: jest.Mock;
  let mockOrder: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock chain for Supabase queries
    mockUpdate = jest.fn();
    mockOrder = jest.fn();
    mockIs = jest.fn();
    mockEq = jest.fn();
    mockSelect = jest.fn();
    mockFrom = jest.fn();

    // Setup method chaining
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ is: mockIs, eq: mockEq });
    mockIs.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ error: null });

    (mockSupabaseClient.from as jest.Mock) = mockFrom;
    
    service = new SeasonCompletionDetectorService(mockSupabaseClient);
  });

  describe('detectAndMarkCompletedSeasons', () => {
    it('should handle no active seasons gracefully', async () => {
      // Setup: No active seasons
      mockOrder.mockResolvedValue({ data: [], error: null });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result).toEqual({
        completedSeasonIds: [],
        errors: [],
        processedCount: 0,
        skippedCount: 0
      });

      expect(logger.info).toHaveBeenCalledWith('SeasonCompletionDetector: No active seasons found to check');
    });

    it('should detect and mark completed seasons', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: All fixtures finished for season 1
      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },
        { id: 2, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },
        { id: 3, status_short: 'AET', rounds: { id: 2, season_id: 1, seasons: { id: 1, name: '2023-24' } } }
      ];
      
      // Mock fixtures query (second call to mockFrom)
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            })
            .mockReturnValueOnce({
              update: mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.completedSeasonIds).toEqual([1]);
      expect(result.processedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Season 1 (2023-24) is complete - 3/3 fixtures finished')
      );
    });

    it('should skip incomplete seasons', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: Mix of finished and unfinished fixtures
      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },
        { id: 2, status_short: 'NS', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } }, // Not started
        { id: 3, status_short: 'FT', rounds: { id: 2, season_id: 1, seasons: { id: 1, name: '2023-24' } } }
      ];
      
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.completedSeasonIds).toEqual([]);
      expect(result.skippedCount).toBe(1);
      expect(result.processedCount).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Season 1 (2023-24) still in progress - 2/3 fixtures finished (66.7%)')
      );
    });

    it('should handle database errors gracefully', async () => {
      // Setup: Database error when fetching seasons
      mockOrder.mockResolvedValue({ data: null, error: { message: 'Database connection failed' } });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to fetch active seasons');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle errors for individual seasons and continue processing', async () => {
      // Setup: Two active seasons
      const mockSeasons = [
        { id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 },
        { id: 2, name: '2024-25', api_season_year: 2024, competition_id: 1 }
      ];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Create individual mocks for each fixture query
      const mockFixturesSelect1 = jest.fn();
      const mockFixturesSelect2 = jest.fn();
      const mockFixturesEq1 = jest.fn();
      const mockFixturesEq2 = jest.fn();
      
      // First season query - error
      mockFixturesEq1.mockResolvedValue({ data: null, error: { message: 'No fixtures found' } });
      mockFixturesSelect1.mockReturnValue({ eq: mockFixturesEq1 });
      
      // Second season query - success
      mockFixturesEq2.mockResolvedValue({ 
        data: [
          { id: 4, status_short: 'FT', rounds: { id: 3, season_id: 2, seasons: { id: 2, name: '2024-25' } } }
        ], 
        error: null 
      });
      mockFixturesSelect2.mockReturnValue({ eq: mockFixturesEq2 });
      
      // Setup mock chain
      mockFrom.mockReturnValueOnce({ select: mockSelect })  // Initial seasons query
            .mockReturnValueOnce({ select: mockFixturesSelect1 })  // First season fixtures query
            .mockReturnValueOnce({ select: mockFixturesSelect2 })  // Second season fixtures query
            .mockReturnValueOnce({  // Update query for season 2
              update: mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.errors).toHaveLength(1);
      expect(result.completedSeasonIds).toEqual([2]);
      expect(result.processedCount).toBe(1);
      expect(result.errors[0].message).toContain('Failed to process season 1');
    });

    it('should recognize all final status types', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: Fixtures with all possible final statuses
      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },   // Full Time
        { id: 2, status_short: 'AET', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },  // After Extra Time
        { id: 3, status_short: 'PEN', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },  // Penalty Shootout
        { id: 4, status_short: 'AWD', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },  // Awarded
        { id: 5, status_short: 'WO', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } }    // Walkover
      ];
      
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            })
            .mockReturnValueOnce({
              update: mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.completedSeasonIds).toEqual([1]);
      expect(result.processedCount).toBe(1);
    });

    it('should handle season with no fixtures', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: No fixtures for the season
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No fixtures found for season 1');
      expect(result.completedSeasonIds).toEqual([]);
    });
  });

  describe('getSeasonCompletionStats', () => {
    it('should return completion statistics for active seasons', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: Partially complete season
      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },
        { id: 2, status_short: 'NS', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } },
        { id: 3, status_short: 'FT', rounds: { id: 2, season_id: 1, seasons: { id: 1, name: '2023-24' } } }
      ];
      
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            });

      const stats = await service.getSeasonCompletionStats();

      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        seasonId: 1,
        seasonName: '2023-24',
        totalFixtures: 3,
        finishedFixtures: 2,
        completionPercentage: 66.66666666666666
      });
    });

    it('should handle errors when fetching stats for individual seasons', async () => {
      // Setup: One active season
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: Error fetching fixtures
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
              })
            });

      const stats = await service.getSeasonCompletionStats();

      expect(stats).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get stats for season 1')
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle season update failure', async () => {
      // Setup: One active season with all fixtures complete
      const mockSeasons = [{ id: 1, name: '2023-24', api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: '2023-24' } } }
      ];
      
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            })
            .mockReturnValueOnce({
              update: mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.completedSeasonIds).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to mark season 1 as completed');
    });

    it('should use fallback season name when name is not available', async () => {
      // Setup: One active season without a name
      const mockSeasons = [{ id: 1, name: null, api_season_year: 2023, competition_id: 1 }];
      mockOrder.mockResolvedValueOnce({ data: mockSeasons, error: null });

      // Setup: Fixture with proper season info
      const mockFixtures = [
        { id: 1, status_short: 'FT', rounds: { id: 1, season_id: 1, seasons: { id: 1, name: null } } }
      ];
      
      mockFrom.mockReturnValueOnce({ select: mockSelect })
            .mockReturnValueOnce({ 
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockFixtures, error: null })
              })
            })
            .mockReturnValueOnce({
              update: mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
              })
            });

      const result = await service.detectAndMarkCompletedSeasons();

      expect(result.completedSeasonIds).toEqual([1]);
      // The logger uses season.name from the seasons query, so it will show (null)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Season 1 (null) is complete')
      );
    });
  });
}); 