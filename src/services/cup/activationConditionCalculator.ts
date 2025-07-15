import { logger } from '@/utils/logger';
import { FixtureDataResult, TeamRemainingGames } from './fixtureDataService';

// --- Types ---
export type ActivationConditionResult = {
  conditionMet: boolean;
  totalTeams: number;
  teamsWithFiveOrFewerGames: number;
  percentageWithFiveOrFewerGames: number;
  threshold: number;
  reasoning: string;
};

// --- Constants ---
const DEFAULT_ACTIVATION_THRESHOLD = 60; // 60% threshold

// --- Utilities ---
const log = (...args: unknown[]) => console.log('[ActivationConditionCalculator]', ...args);

const error = (...args: unknown[]) => {
  const serviceContext = { service: 'ActivationConditionCalculator' };
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    logger.error({ ...serviceContext, err: args[0] as Record<string, unknown> }, (args[0] as Error)?.message ?? 'Error object logged');
  } else {
    logger.error(serviceContext, args[0] as string, ...args.slice(1));
  }
};

class ActivationConditionCalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivationConditionCalculatorError';
  }
}

// --- Service Definition ---
export const activationConditionCalculator = {
  /**
   * Calculates whether the activation condition is met based on team remaining games data.
   * 
   * @param fixtureData - The result from FixtureDataService containing team remaining games
   * @param threshold - The percentage threshold (default: 60%)
   * @returns Promise<ActivationConditionResult> - Object containing the condition result and supporting data
   * @throws {ActivationConditionCalculatorError} If unable to calculate condition
   */
  async calculateActivationCondition(
    fixtureData: FixtureDataResult,
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD
  ): Promise<ActivationConditionResult> {
    log(`Calculating activation condition with ${threshold}% threshold...`);

    try {
      // Validate input data
      if (!fixtureData) {
        throw new ActivationConditionCalculatorError('Fixture data is required');
      }

      if (threshold < 0 || threshold > 100) {
        throw new ActivationConditionCalculatorError('Threshold must be between 0 and 100');
      }

      const {
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames
      } = fixtureData;

      // Calculate if condition is met
      const conditionMet = percentageWithFiveOrFewerGames >= threshold;

      // Generate reasoning
      const reasoning = this._generateReasoning(
        conditionMet,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames,
        threshold
      );

      log(`Condition result: ${conditionMet ? 'MET' : 'NOT MET'} - ${reasoning}`);

      return {
        conditionMet,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames,
        threshold,
        reasoning
      };

    } catch (err) {
      if (err instanceof ActivationConditionCalculatorError) throw err;
      error('Unexpected error in calculateActivationCondition:', err);
      throw new ActivationConditionCalculatorError('Unexpected error while calculating activation condition');
    }
  },

  /**
   * Alternative method that takes raw team data instead of FixtureDataResult.
   * Useful for testing or when working with different data sources.
   * 
   * @param teams - Array of team remaining games data
   * @param threshold - The percentage threshold (default: 60%)
   * @returns Promise<ActivationConditionResult> - Object containing the condition result and supporting data
   */
  async calculateActivationConditionFromTeams(
    teams: TeamRemainingGames[],
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD
  ): Promise<ActivationConditionResult> {
    try {
      // Validate input
      if (!Array.isArray(teams)) {
        throw new ActivationConditionCalculatorError('Teams data must be an array');
      }

      log(`Calculating activation condition from ${teams.length} teams with ${threshold}% threshold...`);

      if (teams.length === 0) {
        log('No teams provided - condition cannot be met');
        return {
          conditionMet: false,
          totalTeams: 0,
          teamsWithFiveOrFewerGames: 0,
          percentageWithFiveOrFewerGames: 0,
          threshold,
          reasoning: 'No teams found in the season'
        };
      }

      // Calculate statistics
      const totalTeams = teams.length;
      const teamsWithFiveOrFewerGames = teams.filter(team => team.remainingGames <= 5).length;
      const percentageWithFiveOrFewerGames = (teamsWithFiveOrFewerGames / totalTeams) * 100;

      // Create fixture data result format
      const fixtureData: FixtureDataResult = {
        teams,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames
      };

      return await this.calculateActivationCondition(fixtureData, threshold);

    } catch (err) {
      if (err instanceof ActivationConditionCalculatorError) throw err;
      error('Unexpected error in calculateActivationConditionFromTeams:', err);
      throw new ActivationConditionCalculatorError('Unexpected error while calculating activation condition from teams');
    }
  },

  /**
   * Checks if the activation condition is met with a simple boolean return.
   * Convenience method for quick checks.
   * 
   * @param fixtureData - The result from FixtureDataService containing team remaining games
   * @param threshold - The percentage threshold (default: 60%)
   * @returns Promise<boolean> - True if condition is met, false otherwise
   */
  async isActivationConditionMet(
    fixtureData: FixtureDataResult,
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD
  ): Promise<boolean> {
    const result = await this.calculateActivationCondition(fixtureData, threshold);
    return result.conditionMet;
  },

  /**
   * PRIVATE HELPER: Generates human-readable reasoning for the activation condition decision.
   * 
   * @param conditionMet - Whether the condition was met
   * @param totalTeams - Total number of teams
   * @param teamsWithFiveOrFewerGames - Number of teams with ≤5 games
   * @param percentageWithFiveOrFewerGames - Percentage of teams with ≤5 games
   * @param threshold - The threshold percentage
   * @returns string - Human-readable reasoning
   */
  _generateReasoning(
    conditionMet: boolean,
    totalTeams: number,
    teamsWithFiveOrFewerGames: number,
    percentageWithFiveOrFewerGames: number,
    threshold: number
  ): string {
    const baseInfo = `${teamsWithFiveOrFewerGames}/${totalTeams} teams (${percentageWithFiveOrFewerGames.toFixed(1)}%) have ≤5 games remaining`;
    
    if (conditionMet) {
      return `${baseInfo}, which meets the ${threshold}% threshold for cup activation`;
    } else {
      return `${baseInfo}, which does not meet the ${threshold}% threshold for cup activation`;
    }
  }
};

// --- Constants Export ---
export const ACTIVATION_THRESHOLD = DEFAULT_ACTIVATION_THRESHOLD; 