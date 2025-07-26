import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { Tables } from '@/types/supabase';
import { logger } from '@/utils/logger';

// --- Types ---
export type CupActivationStatus = {
  isActivated: boolean;
  activatedAt: string | null;
  seasonId: number | null;
  seasonName: string | null;
};

// --- Utilities ---
const log = (...args: unknown[]) => console.log('[CupActivationStatusChecker]', ...args);

const error = (...args: unknown[]) => {
  const serviceContext = { service: 'CupActivationStatusChecker' };
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    logger.error({ ...serviceContext, err: args[0] as Record<string, unknown> }, (args[0] as Error)?.message ?? 'Error object logged');
  } else {
    logger.error(serviceContext, args[0] as string, ...args.slice(1));
  }
};

class CupActivationStatusCheckerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CupActivationStatusCheckerError';
  }
}

// --- Service Definition ---
export const cupActivationStatusChecker = {
  /**
   * Checks if the Last Round Special cup is already activated for the current season.
   * 
   * @returns Promise<CupActivationStatus> - Object containing activation status and details
   * @throws {CupActivationStatusCheckerError} If unable to check activation status
   */
  async checkCurrentSeasonActivationStatus(): Promise<CupActivationStatus> {
    log('Checking cup activation status for current season...');
    const supabase = createSupabaseServiceRoleClient();

    try {
      // Get the current season with activation status
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id, name, last_round_special_activated, last_round_special_activated_at')
        .eq('is_current', true)
        .maybeSingle();

      if (seasonError) {
        error('Failed to fetch current season:', seasonError);
        throw new CupActivationStatusCheckerError('Unable to fetch current season data');
      }

      if (!currentSeason) {
        log('No current season found');
        return {
          isActivated: false,
          activatedAt: null,
          seasonId: null,
          seasonName: null
        };
      }

      const isActivated = currentSeason.last_round_special_activated || false;
      const activatedAt = currentSeason.last_round_special_activated_at;

      log(`Current season: ${currentSeason.name} (ID: ${currentSeason.id})`);
      log(`Cup activation status: ${isActivated ? 'ACTIVATED' : 'NOT ACTIVATED'}`);
      
      if (isActivated && activatedAt) {
        log(`Cup activated at: ${activatedAt}`);
      }

      return {
        isActivated,
        activatedAt,
        seasonId: currentSeason.id,
        seasonName: currentSeason.name
      };

    } catch (err) {
      if (err instanceof CupActivationStatusCheckerError) throw err;
      error('Unexpected error in checkCurrentSeasonActivationStatus:', err);
      throw new CupActivationStatusCheckerError('Unexpected error while checking activation status');
    }
  },

  /**
   * Checks if the cup is activated for a specific season.
   * 
   * @param seasonId - The ID of the season to check
   * @returns Promise<CupActivationStatus> - Object containing activation status and details
   * @throws {CupActivationStatusCheckerError} If unable to check activation status
   */
  async checkSeasonActivationStatus(seasonId: number): Promise<CupActivationStatus> {
    log(`Checking cup activation status for season ID: ${seasonId}...`);
    const supabase = createSupabaseServiceRoleClient();

    try {
      // Validate input
      if (!seasonId || seasonId <= 0) {
        throw new CupActivationStatusCheckerError('Valid season ID is required');
      }

      // Get the specific season with activation status
      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .select('id, name, last_round_special_activated, last_round_special_activated_at')
        .eq('id', seasonId)
        .maybeSingle();

      if (seasonError) {
        error(`Failed to fetch season ${seasonId}:`, seasonError);
        throw new CupActivationStatusCheckerError(`Unable to fetch season ${seasonId} data`);
      }

      if (!season) {
        log(`Season ${seasonId} not found`);
        return {
          isActivated: false,
          activatedAt: null,
          seasonId,
          seasonName: null
        };
      }

      const isActivated = season.last_round_special_activated || false;
      const activatedAt = season.last_round_special_activated_at;

      log(`Season: ${season.name} (ID: ${season.id})`);
      log(`Cup activation status: ${isActivated ? 'ACTIVATED' : 'NOT ACTIVATED'}`);
      
      if (isActivated && activatedAt) {
        log(`Cup activated at: ${activatedAt}`);
      }

      return {
        isActivated,
        activatedAt,
        seasonId: season.id,
        seasonName: season.name
      };

    } catch (err) {
      if (err instanceof CupActivationStatusCheckerError) throw err;
      error('Unexpected error in checkSeasonActivationStatus:', err);
      throw new CupActivationStatusCheckerError('Unexpected error while checking activation status');
    }
  },

  /**
   * Simple boolean check if the current season's cup is activated.
   * Convenience method for quick activation checks.
   * 
   * @returns Promise<boolean> - True if cup is activated for current season, false otherwise
   */
  async isCurrentSeasonCupActivated(): Promise<boolean> {
    const status = await this.checkCurrentSeasonActivationStatus();
    return status.isActivated;
  },

  /**
   * Simple boolean check if a specific season's cup is activated.
   * Convenience method for quick activation checks.
   * 
   * @param seasonId - The ID of the season to check
   * @returns Promise<boolean> - True if cup is activated for the season, false otherwise
   */
  async isSeasonCupActivated(seasonId: number): Promise<boolean> {
    const status = await this.checkSeasonActivationStatus(seasonId);
    return status.isActivated;
  }
};

// --- Type Exports ---
export type Season = Tables<'seasons'>; 