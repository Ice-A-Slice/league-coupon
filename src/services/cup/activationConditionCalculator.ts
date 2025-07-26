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
  // New field for display-only mode
  shouldMaintainDisplay?: boolean;
  displayReason?: string;
};

// --- Constants ---
const DEFAULT_ACTIVATION_THRESHOLD = 60; // 60% threshold

// --- Utilities ---
const log = (...args: unknown[]) => console.log('[ActivationConditionCalculator]', ...args);
const error = (...args: unknown[]) => {
  console.error('[ActivationConditionCalculator] ERROR:', ...args);
  logger.error('[ActivationConditionCalculator]', {}, { args });
};

// --- Error Classes ---
export class ActivationConditionCalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivationConditionCalculatorError';
  }
}

// --- Service Definition ---
export const activationConditionCalculator = {
  /**
   * Calculates whether the activation condition is met based on team remaining games data.
   * Now supports maintaining display for completed seasons.
   * 
   * @param fixtureData - The result from FixtureDataService containing team remaining games
   * @param threshold - The percentage threshold (default: 60%)
   * @param isAlreadyActivated - Whether the cup is already activated (for display maintenance logic)
   * @returns Promise<ActivationConditionResult> - Object containing the condition result and supporting data
   * @throws {ActivationConditionCalculatorError} If unable to calculate condition
   */
  async calculateActivationCondition(
    fixtureData: FixtureDataResult,
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD,
    isAlreadyActivated: boolean = false
  ): Promise<ActivationConditionResult> {
    log(`Calculating activation condition with ${threshold}% threshold (already activated: ${isAlreadyActivated})...`);

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

      // Calculate if condition is met for initial activation
      const conditionMet = percentageWithFiveOrFewerGames >= threshold;

      // Check if all teams have finished (0 games remaining)
      const allTeamsFinished = fixtureData.teams.every(team => team.remainingGames === 0);

      // Determine if we should maintain display for already activated cups
      let shouldMaintainDisplay = false;
      let displayReason = '';

      if (isAlreadyActivated && allTeamsFinished) {
        // If already activated and season is complete, maintain display for viewing final standings
        shouldMaintainDisplay = true;
        displayReason = 'Maintaining display for completed season to view final Last Round Special standings';
        log('Season completed but maintaining cup display for final standings viewing');
      }

      // Generate reasoning
      const reasoning = this._generateReasoning(
        conditionMet,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames,
        threshold,
        allTeamsFinished,
        isAlreadyActivated,
        shouldMaintainDisplay
      );

      log(`Condition result: ${conditionMet ? 'MET' : 'NOT MET'} - ${reasoning}`);
      if (shouldMaintainDisplay) {
        log(`Display maintenance: ACTIVE - ${displayReason}`);
      }

      return {
        conditionMet,
        totalTeams,
        teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames,
        threshold,
        reasoning,
        shouldMaintainDisplay,
        displayReason
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
   * @param isAlreadyActivated - Whether the cup is already activated
   * @returns Promise<ActivationConditionResult> - Object containing the condition result and supporting data
   */
  async calculateActivationConditionFromTeams(
    teams: TeamRemainingGames[],
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD,
    isAlreadyActivated: boolean = false
  ): Promise<ActivationConditionResult> {
    try {
      // Validate input
      if (!Array.isArray(teams)) {
        throw new ActivationConditionCalculatorError('Teams data must be an array');
      }

      log(`Calculating activation condition from ${teams.length} teams with ${threshold}% threshold (already activated: ${isAlreadyActivated})...`);

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

      return await this.calculateActivationCondition(fixtureData, threshold, isAlreadyActivated);

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
   * @param isAlreadyActivated - Whether the cup is already activated
   * @returns Promise<boolean> - True if condition is met OR should maintain display, false otherwise
   */
  async isActivationConditionMet(
    fixtureData: FixtureDataResult,
    threshold: number = DEFAULT_ACTIVATION_THRESHOLD,
    isAlreadyActivated: boolean = false
  ): Promise<boolean> {
    const result = await this.calculateActivationCondition(fixtureData, threshold, isAlreadyActivated);
    return result.conditionMet || result.shouldMaintainDisplay || false;
  },

  /**
   * PRIVATE HELPER: Generates human-readable reasoning for the activation condition decision.
   * 
   * @param conditionMet - Whether the condition was met
   * @param totalTeams - Total number of teams
   * @param teamsWithFiveOrFewerGames - Number of teams with ≤5 games
   * @param percentageWithFiveOrFewerGames - Percentage of teams with ≤5 games
   * @param threshold - The threshold percentage
   * @param allTeamsFinished - Whether all teams have completed their season
   * @param isAlreadyActivated - Whether cup is already activated
   * @param shouldMaintainDisplay - Whether to maintain display for completed season
   * @returns string - Human-readable reasoning
   */
  _generateReasoning(
    conditionMet: boolean,
    totalTeams: number,
    teamsWithFiveOrFewerGames: number,
    percentageWithFiveOrFewerGames: number,
    threshold: number,
    allTeamsFinished: boolean = false,
    isAlreadyActivated: boolean = false,
    shouldMaintainDisplay: boolean = false
  ): string {
    const baseInfo = `${teamsWithFiveOrFewerGames}/${totalTeams} teams (${percentageWithFiveOrFewerGames.toFixed(1)}%) have ≤5 games remaining`;
    
    if (shouldMaintainDisplay && allTeamsFinished && isAlreadyActivated) {
      return `Season complete (all teams finished), but maintaining Last Round Special display for final standings viewing`;
    } else if (conditionMet) {
      return `${baseInfo}, which meets the ${threshold}% threshold for cup activation`;
    } else if (allTeamsFinished) {
      return `${baseInfo}. Season complete - all teams have finished their fixtures`;
    } else {
      return `${baseInfo}, which does not meet the ${threshold}% threshold for cup activation`;
    }
  }
};

// Export the activation threshold constant for use in other modules
export const ACTIVATION_THRESHOLD = DEFAULT_ACTIVATION_THRESHOLD; 