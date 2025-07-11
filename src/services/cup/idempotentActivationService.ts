import { createClient } from '@/utils/supabase/client';
import { Tables } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { cupActivationStatusChecker } from './cupActivationStatusChecker';

// --- Types ---
export type ActivationAttemptResult = {
  success: boolean;
  wasAlreadyActivated: boolean;
  activatedAt: string | null;
  seasonId: number | null;
  seasonName: string | null;
  error: string | null;
  attemptedAt: string;
};

export type ActivationDetails = {
  seasonId?: number;
  activatedBy?: string;
  reason?: string;
};

// --- Utilities ---
const log = (...args: unknown[]) => console.log('[IdempotentActivationService]', ...args);

const error = (...args: unknown[]) => {
  const serviceContext = { service: 'IdempotentActivationService' };
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    logger.error({ ...serviceContext, err: args[0] as Record<string, unknown> }, (args[0] as Error)?.message ?? 'Error object logged');
  } else {
    logger.error(serviceContext, args[0] as string, ...args.slice(1));
  }
};

class IdempotentActivationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotentActivationServiceError';
  }
}

// --- Service Definition ---
export const idempotentActivationService = {
  /**
   * Attempts to activate the Last Round Special cup for the current season.
   * Uses database transactions to ensure atomicity and prevent race conditions.
   * 
   * @param details - Optional activation details (activatedBy, reason)
   * @returns Promise<ActivationAttemptResult> - Result of the activation attempt
   * @throws {IdempotentActivationServiceError} If activation fails unexpectedly
   */
  async activateCurrentSeasonCup(details: ActivationDetails = {}): Promise<ActivationAttemptResult> {
    const attemptedAt = new Date().toISOString();
    log('Starting cup activation attempt for current season...');
    
    const supabase = createClient();
    let statusCheck: any = null;

    try {
      // First, check if already activated (quick check to avoid unnecessary transaction)
      statusCheck = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();
      
      if (statusCheck.isActivated) {
        log(`Cup already activated for season ${statusCheck.seasonName} (ID: ${statusCheck.seasonId}) at ${statusCheck.activatedAt}`);
        return {
          success: true,
          wasAlreadyActivated: true,
          activatedAt: statusCheck.activatedAt,
          seasonId: statusCheck.seasonId,
          seasonName: statusCheck.seasonName,
          error: null,
          attemptedAt
        };
      }

      if (!statusCheck.seasonId) {
        log('No current season found - cannot activate cup');
        return {
          success: false,
          wasAlreadyActivated: false,
          activatedAt: null,
          seasonId: null,
          seasonName: null,
          error: 'No current season found',
          attemptedAt
        };
      }

      // Perform the activation within a transaction
      const activationResult = await this._performActivationTransaction(
        statusCheck.seasonId,
        statusCheck.seasonName!,
        details
      );

      return {
        ...activationResult,
        attemptedAt
      };

    } catch (err) {
      if (err instanceof IdempotentActivationServiceError) {
        error('Activation service error:', err.message);
        return {
          success: false,
          wasAlreadyActivated: false,
          activatedAt: null,
          seasonId: statusCheck?.seasonId || null,
          seasonName: statusCheck?.seasonName || null,
          error: err.message,
          attemptedAt
        };
      }

      error('Unexpected error during cup activation:', err);
      return {
        success: false,
        wasAlreadyActivated: false,
        activatedAt: null,
        seasonId: statusCheck?.seasonId || null,
        seasonName: statusCheck?.seasonName || null,
        error: 'Unexpected error during activation',
        attemptedAt
      };
    }
  },

  /**
   * Attempts to activate the Last Round Special cup for a specific season.
   * Uses database transactions to ensure atomicity and prevent race conditions.
   * 
   * @param seasonId - The ID of the season to activate
   * @param details - Optional activation details (activatedBy, reason)
   * @returns Promise<ActivationAttemptResult> - Result of the activation attempt
   * @throws {IdempotentActivationServiceError} If activation fails unexpectedly
   */
    async activateSeasonCup(seasonId: number, details: ActivationDetails = {}): Promise<ActivationAttemptResult> {
    const attemptedAt = new Date().toISOString();
    log(`Starting cup activation attempt for season ID: ${seasonId}...`);

    let statusCheck: any = null;

    try {
      // Validate input
      if (!seasonId || seasonId <= 0) {
        throw new IdempotentActivationServiceError('Valid season ID is required');
      }

      // First, check if already activated (quick check to avoid unnecessary transaction)
      statusCheck = await cupActivationStatusChecker.checkSeasonActivationStatus(seasonId);
      
      if (statusCheck.isActivated) {
        log(`Cup already activated for season ${statusCheck.seasonName} (ID: ${statusCheck.seasonId}) at ${statusCheck.activatedAt}`);
        return {
          success: true,
          wasAlreadyActivated: true,
          activatedAt: statusCheck.activatedAt,
          seasonId: statusCheck.seasonId,
          seasonName: statusCheck.seasonName,
          error: null,
          attemptedAt
        };
      }

      if (!statusCheck.seasonName) {
        log(`Season ${seasonId} not found - cannot activate cup`);
        return {
          success: false,
          wasAlreadyActivated: false,
          activatedAt: null,
          seasonId: seasonId,
          seasonName: null,
          error: `Season ${seasonId} not found`,
          attemptedAt
        };
      }

      // Perform the activation within a transaction
      const activationResult = await this._performActivationTransaction(
        seasonId,
        statusCheck.seasonName,
        details
      );

      return {
        ...activationResult,
        attemptedAt
      };

     } catch (err) {
      if (err instanceof IdempotentActivationServiceError) {
        error('Activation service error:', err.message);
        return {
          success: false,
          wasAlreadyActivated: false,
          activatedAt: null,
          seasonId: seasonId,
          seasonName: statusCheck?.seasonName || null,
          error: err.message,
          attemptedAt
        };
      }

      error('Unexpected error during cup activation:', err);
      return {
        success: false,
        wasAlreadyActivated: false,
        activatedAt: null,
        seasonId: seasonId,
        seasonName: statusCheck?.seasonName || null,
        error: 'Unexpected error during activation',
        attemptedAt
      };
    }
  },

  /**
   * Internal method to perform the actual activation within a database transaction.
   * This ensures atomicity and prevents race conditions.
   * 
   * @private
   * @param seasonId - The season ID to activate
   * @param seasonName - The season name for logging
   * @param details - Additional activation details
   * @returns Promise<Omit<ActivationAttemptResult, 'attemptedAt'>>
   */
  async _performActivationTransaction(
    seasonId: number,
    seasonName: string,
    details: ActivationDetails
  ): Promise<Omit<ActivationAttemptResult, 'attemptedAt'>> {
    const supabase = createClient();
    const activationTimestamp = new Date().toISOString();

    log(`Executing activation transaction for season ${seasonName} (ID: ${seasonId})...`);

    try {
      // Use Supabase RPC for atomic operation with optimistic locking
      const { data, error: rpcError } = await supabase.rpc('activate_last_round_special', {
        p_season_id: seasonId,
        p_activation_timestamp: activationTimestamp
      });

      if (rpcError) {
        error('RPC activation failed:', rpcError);
        throw new IdempotentActivationServiceError(`Failed to activate cup: ${rpcError.message}`);
      }

      // Check the result from the RPC function
      if (data?.success === false) {
        if (data?.already_activated === true) {
          log(`Cup was already activated in parallel transaction for season ${seasonName}`);
          return {
            success: true,
            wasAlreadyActivated: true,
            activatedAt: data.activated_at,
            seasonId: seasonId,
            seasonName: seasonName,
            error: null
          };
        } else {
          log(`Activation failed: ${data?.error || 'Unknown error'}`);
          return {
            success: false,
            wasAlreadyActivated: false,
            activatedAt: null,
            seasonId: seasonId,
            seasonName: seasonName,
            error: data?.error || 'Activation failed'
          };
        }
      }

      // Success case
      log(`Cup successfully activated for season ${seasonName} (ID: ${seasonId}) at ${activationTimestamp}`);
      if (details.activatedBy) {
        log(`Activated by: ${details.activatedBy}`);
      }
      if (details.reason) {
        log(`Reason: ${details.reason}`);
      }

      return {
        success: true,
        wasAlreadyActivated: false,
        activatedAt: activationTimestamp,
        seasonId: seasonId,
        seasonName: seasonName,
        error: null
      };

    } catch (err) {
      if (err instanceof IdempotentActivationServiceError) throw err;
      error('Transaction error:', err);
      throw new IdempotentActivationServiceError('Database transaction failed');
    }
  },

  /**
   * Simple boolean check to attempt activation and return only success status.
   * Convenience method for cases where detailed result is not needed.
   * 
   * @param seasonId - Optional season ID (defaults to current season)
   * @param details - Optional activation details
   * @returns Promise<boolean> - True if activation succeeded, false otherwise
   */
  async attemptActivation(seasonId?: number, details: ActivationDetails = {}): Promise<boolean> {
    const result = seasonId 
      ? await this.activateSeasonCup(seasonId, details)
      : await this.activateCurrentSeasonCup(details);
    
    return result.success;
  }
};

// --- Type Exports ---
export type Season = Tables<'seasons'>; 