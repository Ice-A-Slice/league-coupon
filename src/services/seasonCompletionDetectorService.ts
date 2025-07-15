import 'server-only';
import { logger } from '@/utils/logger';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

type DatabaseClient = SupabaseClient<Database>;

interface SeasonCompletionResult {
  completedSeasonIds: number[];
  errors: Error[];
  processedCount: number;
  skippedCount: number;
}

interface SeasonFixtureStats {
  seasonId: number;
  seasonName: string;
  totalFixtures: number;
  finishedFixtures: number;
  completionPercentage: number;
}

/**
 * Service responsible for detecting when football seasons are complete
 * and updating the database accordingly.
 * 
 * A season is considered complete when all fixtures in all rounds
 * of that season have a final status (FT, AET, PEN, AWD, WO).
 */
export class SeasonCompletionDetectorService {
  private supabase: DatabaseClient;

  constructor(supabaseClient?: DatabaseClient) {
    this.supabase = supabaseClient || getSupabaseServiceRoleClient();
  }

  /**
   * Main method to detect and mark completed seasons
   */
  async detectAndMarkCompletedSeasons(): Promise<SeasonCompletionResult> {
    const startTime = Date.now();
    logger.info('SeasonCompletionDetector: Starting season completion detection...');

    const result: SeasonCompletionResult = {
      completedSeasonIds: [],
      errors: [],
      processedCount: 0,
      skippedCount: 0
    };

    try {
      // Get active seasons that haven't been marked as completed
      const activeSeasons = await this.getActiveSeasonsToCheck();
      
      if (activeSeasons.length === 0) {
        logger.info('SeasonCompletionDetector: No active seasons found to check');
        return result;
      }

      logger.info(`SeasonCompletionDetector: Found ${activeSeasons.length} active seasons to check`);

      // Check each season for completion
      for (const season of activeSeasons) {
        try {
          const stats = await this.getSeasonFixtureStats(season.id);
          
          if (this.isSeasonComplete(stats)) {
            logger.info(`SeasonCompletionDetector: Season ${season.id} (${season.name}) is complete - ${stats.finishedFixtures}/${stats.totalFixtures} fixtures finished`);
            
            const success = await this.markSeasonAsCompleted(season.id);
            if (success) {
              result.completedSeasonIds.push(season.id);
              result.processedCount++;
            } else {
              result.errors.push(new Error(`Failed to mark season ${season.id} as completed`));
            }
          } else {
            logger.debug(`SeasonCompletionDetector: Season ${season.id} (${season.name}) still in progress - ${stats.finishedFixtures}/${stats.totalFixtures} fixtures finished (${stats.completionPercentage.toFixed(1)}%)`);
            result.skippedCount++;
          }
        } catch (error) {
          const errorMessage = `Failed to process season ${season.id}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMessage, { seasonId: season.id, error });
          result.errors.push(new Error(errorMessage));
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`SeasonCompletionDetector: Completed detection in ${duration}ms`, {
        completedSeasonIds: result.completedSeasonIds,
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
        duration
      });

      return result;

    } catch (error) {
      const errorMessage = `Critical error in season completion detection: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, { error });
      result.errors.push(new Error(errorMessage));
      return result;
    }
  }

  /**
   * Get all active seasons that need to be checked for completion
   */
  private async getActiveSeasonsToCheck() {
    const { data: seasons, error } = await this.supabase
      .from('seasons')
      .select('id, name, api_season_year, competition_id')
      .eq('is_current', true)
      .is('completed_at', null)
      .order('id');

    if (error) {
      throw new Error(`Failed to fetch active seasons: ${error.message}`);
    }

    return seasons || [];
  }

  /**
   * Get fixture statistics for a specific season
   */
  private async getSeasonFixtureStats(seasonId: number): Promise<SeasonFixtureStats> {
    const { data, error } = await this.supabase
      .from('fixtures')
      .select(`
        id,
        status_short,
        rounds!inner (
          id,
          season_id,
          seasons!inner (
            id,
            name
          )
        )
      `)
      .eq('rounds.season_id', seasonId);

    if (error) {
      throw new Error(`Failed to fetch fixture stats for season ${seasonId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`No fixtures found for season ${seasonId}`);
    }

    // Final statuses that indicate a fixture is complete
    const finalStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
    
    const totalFixtures = data.length;
    const finishedFixtures = data.filter(fixture => 
      finalStatuses.includes(fixture.status_short)
    ).length;

    const completionPercentage = totalFixtures > 0 ? (finishedFixtures / totalFixtures) * 100 : 0;

    // Get season name from the first fixture (they all have the same season)
    const seasonName = data[0]?.rounds?.seasons?.name || `Season ${seasonId}`;

    return {
      seasonId,
      seasonName,
      totalFixtures,
      finishedFixtures,
      completionPercentage
    };
  }

  /**
   * Check if a season is complete based on fixture statistics
   */
  private isSeasonComplete(stats: SeasonFixtureStats): boolean {
    return stats.totalFixtures > 0 && stats.finishedFixtures === stats.totalFixtures;
  }

  /**
   * Mark a season as completed in the database
   */
  private async markSeasonAsCompleted(seasonId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('seasons')
      .update({
        completed_at: new Date().toISOString()
      })
      .eq('id', seasonId);

    if (error) {
      logger.error(`Failed to mark season ${seasonId} as completed: ${error.message}`, { seasonId, error });
      return false;
    }

    logger.info(`Successfully marked season ${seasonId} as completed`);
    return true;
  }

  /**
   * Get completion statistics for all active seasons (useful for monitoring)
   */
  async getSeasonCompletionStats(): Promise<SeasonFixtureStats[]> {
    const activeSeasons = await this.getActiveSeasonsToCheck();
    const stats: SeasonFixtureStats[] = [];

    for (const season of activeSeasons) {
      try {
        const seasonStats = await this.getSeasonFixtureStats(season.id);
        stats.push(seasonStats);
      } catch (error) {
        logger.error(`Failed to get stats for season ${season.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return stats;
  }
} 