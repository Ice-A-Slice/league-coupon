import { fixtureDataService, FixtureDataResult } from './fixtureDataService';
import { activationConditionCalculator, ActivationConditionResult } from './activationConditionCalculator';
import { cupActivationStatusChecker, CupActivationStatus } from './cupActivationStatusChecker';
import { idempotentActivationService, ActivationAttemptResult } from './idempotentActivationService';
import { cupActivationLogger, CupActivationLogContext } from './cupActivationLogger';

// --- Types ---
export type CupActivationDetectionResult = {
  // Decision Summary
  shouldActivate: boolean;
  actionTaken: string;
  success: boolean;
  
  // Supporting Data
  fixtureData: FixtureDataResult;
  activationCondition: ActivationConditionResult;
  statusCheck: CupActivationStatus;
  activationResult?: ActivationAttemptResult;
  
  // Metadata
  sessionId: string;
  timestamp: string;
  duration: number;
  seasonId: number | null;
  seasonName: string | null;
  
  // Error Information
  error?: string;
  errors: string[];
  
  // Audit Trail
  reasoning: string;
  summary: string;
};

// --- Main Service ---
export class CupActivationDetectionService {
  private readonly logger = cupActivationLogger;
  private readonly threshold: number;

  constructor(threshold: number = 60) {
    this.threshold = threshold;
  }

  /**
   * Main method that orchestrates the complete cup activation detection process.
   * 
   * @param context - Optional logging context (seasonId, userId, etc.)
   * @returns Promise<CupActivationDetectionResult> - Complete activation detection result
   */
  async detectAndActivateCup(context: Partial<CupActivationLogContext> = {}): Promise<CupActivationDetectionResult> {
    const { sessionId, endOperation } = this.logger.startOperation(
      'detectAndActivateCup',
      { ...context, threshold: this.threshold }
    );

    const startTime = Date.now();
    const errors: string[] = [];
    let result: CupActivationDetectionResult;

    try {
      this.logger.info(
        'Starting cup activation detection process',
        { ...context, sessionId, threshold: this.threshold },
        { threshold: this.threshold }
      );

      // Step 1: Query fixture data
      this.logger.debug('Step 1: Querying fixture data', { ...context, sessionId });
      const fixtureData = await this.queryFixtureData(context, sessionId, errors);

      // Step 2: Calculate activation condition
      this.logger.debug('Step 2: Calculating activation condition', { ...context, sessionId });
      const activationCondition = await this.calculateActivationCondition(
        fixtureData, 
        context, 
        sessionId, 
        errors
      );

      // Step 3: Check current activation status
      this.logger.debug('Step 3: Checking current activation status', { ...context, sessionId });
      const statusCheck = await this.checkActivationStatus(context, sessionId, errors);

      // Step 4: Determine if activation should be attempted
      const shouldActivate = this.shouldAttemptActivation(
        activationCondition, 
        statusCheck, 
        context, 
        sessionId
      );

      // Step 5: Attempt activation if conditions are met
      let activationResult: ActivationAttemptResult | undefined;
      if (shouldActivate) {
        this.logger.debug('Step 5: Attempting cup activation', { ...context, sessionId });
        activationResult = await this.attemptActivation(context, sessionId, errors);
      } else {
        this.logger.debug('Step 5: Skipping activation (conditions not met)', { ...context, sessionId });
      }

      // Step 6: Compile final result
      const duration = Date.now() - startTime;
      result = this.compileResult(
        sessionId,
        fixtureData,
        activationCondition,
        statusCheck,
        activationResult,
        shouldActivate,
        duration,
        errors
      );

      // Step 7: Create audit log
      this.createAuditLog(result, context);

      // Step 8: Log final decision
      this.logger.logActivationDecision(
        result.shouldActivate,
        result.reasoning,
        result.actionTaken,
        { ...context, sessionId }
      );

      endOperation('success', { 
        shouldActivate: result.shouldActivate,
        actionTaken: result.actionTaken,
        hasErrors: errors.length > 0
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Only add to errors array if it's not already there
      if (!errors.some(e => e.includes(errorMessage))) {
        errors.push(errorMessage);
      }

      this.logger.error(
        'Cup activation detection process failed',
        { ...context, sessionId },
        { error: errorMessage, duration },
        error instanceof Error ? error : undefined
      );

      // Create error result
      result = this.createErrorResult(sessionId, duration, errors, errorMessage);

      endOperation('error', { error: errorMessage, duration });

      return result;
    }
  }

  /**
   * Simplified method that returns only the activation decision.
   * 
   * @param context - Optional logging context
   * @returns Promise<boolean> - True if cup should be activated, false otherwise
   */
  async shouldActivateCup(context: Partial<CupActivationLogContext> = {}): Promise<boolean> {
    const result = await this.detectAndActivateCup(context);
    return result.shouldActivate;
  }

  /**
   * Method to check activation status without attempting activation.
   * 
   * @param context - Optional logging context
   * @returns Promise<CupActivationDetectionResult> - Detection result without activation attempt
   */
  async checkActivationConditions(context: Partial<CupActivationLogContext> = {}): Promise<CupActivationDetectionResult> {
    const { sessionId, endOperation } = this.logger.startOperation(
      'checkActivationConditions',
      { ...context, threshold: this.threshold }
    );

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Query fixture data
      const fixtureData = await this.queryFixtureData(context, sessionId, errors);

      // Calculate activation condition
      const activationCondition = await this.calculateActivationCondition(
        fixtureData, 
        context, 
        sessionId, 
        errors
      );

      // Check current activation status
      const statusCheck = await this.checkActivationStatus(context, sessionId, errors);

      // Determine if activation should be attempted (but don't actually activate)
      const shouldActivate = this.shouldAttemptActivation(
        activationCondition, 
        statusCheck, 
        context, 
        sessionId
      );

      const duration = Date.now() - startTime;
      const result = this.compileResult(
        sessionId,
        fixtureData,
        activationCondition,
        statusCheck,
        undefined, // No activation result
        shouldActivate,
        duration,
        errors
      );

      endOperation('success', { 
        shouldActivate: result.shouldActivate,
        checkOnly: true
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Only add to errors array if it's not already there
      if (!errors.some(e => e.includes(errorMessage))) {
        errors.push(errorMessage);
      }

      this.logger.error(
        'Cup activation condition check failed',
        { ...context, sessionId },
        { error: errorMessage, duration },
        error instanceof Error ? error : undefined
      );

      const result = this.createErrorResult(sessionId, duration, errors, errorMessage);
      endOperation('error', { error: errorMessage, duration });

      return result;
    }
  }

  /**
   * PRIVATE: Query fixture data using FixtureDataService.
   */
  private async queryFixtureData(
    context: Partial<CupActivationLogContext>, 
    sessionId: string, 
    errors: string[]
  ): Promise<FixtureDataResult> {
    try {
      const fixtureData = await fixtureDataService.getTeamRemainingGames();
      
      this.logger.logFixtureDataAnalysis(fixtureData, { ...context, sessionId });
      
      return fixtureData;
    } catch (error) {
      const errorMessage = `Fixture data query failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      throw error; // Re-throw the original error
    }
  }

  /**
   * PRIVATE: Calculate activation condition using ActivationConditionCalculator.
   */
  private async calculateActivationCondition(
    fixtureData: FixtureDataResult,
    context: Partial<CupActivationLogContext>,
    sessionId: string,
    errors: string[]
  ): Promise<ActivationConditionResult> {
    try {
      const conditionResult = await activationConditionCalculator.calculateActivationCondition(
        fixtureData,
        this.threshold
      );

      this.logger.logActivationConditionResult(conditionResult, { ...context, sessionId });

      return conditionResult;
    } catch (error) {
      const errorMessage = `Activation condition calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      throw error; // Re-throw the original error
    }
  }

  /**
   * PRIVATE: Check current activation status using CupActivationStatusChecker.
   */
  private async checkActivationStatus(
    context: Partial<CupActivationLogContext>,
    sessionId: string,
    errors: string[]
  ): Promise<CupActivationStatus> {
    try {
      const statusResult = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();

      this.logger.logStatusCheck(
        statusResult.isActivated,
        statusResult.activatedAt,
        { ...context, sessionId }
      );

      return statusResult;
    } catch (error) {
      const errorMessage = `Activation status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      throw error; // Re-throw the original error
    }
  }

  /**
   * PRIVATE: Determine if activation should be attempted based on conditions and status.
   */
  private shouldAttemptActivation(
    activationCondition: ActivationConditionResult,
    statusCheck: CupActivationStatus,
    context: Partial<CupActivationLogContext>,
    sessionId: string
  ): boolean {
    // Don't activate if already activated
    if (statusCheck.isActivated) {
      this.logger.debug(
        'Activation skipped: Cup already activated',
        { ...context, sessionId },
        { 
          activatedAt: statusCheck.activatedAt,
          seasonId: statusCheck.seasonId 
        }
      );
      return false;
    }

    // Don't activate if conditions not met
    if (!activationCondition.conditionMet) {
      this.logger.debug(
        'Activation skipped: Conditions not met',
        { ...context, sessionId },
        { 
          percentage: activationCondition.percentageWithFiveOrFewerGames,
          threshold: activationCondition.threshold,
          reasoning: activationCondition.reasoning
        }
      );
      return false;
    }

    // Activate if conditions are met and not already activated
    this.logger.info(
      'Activation conditions met - proceeding with activation',
      { ...context, sessionId },
      {
        percentage: activationCondition.percentageWithFiveOrFewerGames,
        threshold: activationCondition.threshold,
        reasoning: activationCondition.reasoning
      }
    );

    return true;
  }

  /**
   * PRIVATE: Attempt activation using IdempotentActivationService.
   */
  private async attemptActivation(
    context: Partial<CupActivationLogContext>,
    sessionId: string,
    errors: string[]
  ): Promise<ActivationAttemptResult> {
    try {
      const activationResult = await idempotentActivationService.activateCurrentSeasonCup();

      this.logger.info(
        'Activation attempt completed',
        { ...context, sessionId },
        {
          success: activationResult.success,
          wasAlreadyActivated: activationResult.wasAlreadyActivated,
          activatedAt: activationResult.activatedAt,
          seasonId: activationResult.seasonId
        }
      );

      return activationResult;
    } catch (error) {
      const errorMessage = `Cup activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      throw error; // Re-throw the original error
    }
  }

  /**
   * PRIVATE: Compile the final result object.
   */
  private compileResult(
    sessionId: string,
    fixtureData: FixtureDataResult,
    activationCondition: ActivationConditionResult,
    statusCheck: CupActivationStatus,
    activationResult: ActivationAttemptResult | undefined,
    shouldActivate: boolean,
    duration: number,
    errors: string[]
  ): CupActivationDetectionResult {
    const actionTaken = this.determineActionTaken(
      shouldActivate,
      statusCheck.isActivated,
      activationCondition.conditionMet,
      activationResult
    );

    const reasoning = this.generateReasoning(
      activationCondition,
      statusCheck,
      shouldActivate,
      activationResult
    );

    const summary = this.generateSummary(
      fixtureData,
      activationCondition,
      statusCheck,
      activationResult,
      shouldActivate
    );

    return {
      // Decision Summary
      shouldActivate,
      actionTaken,
      success: errors.length === 0,
      
      // Supporting Data
      fixtureData,
      activationCondition,
      statusCheck,
      activationResult,
      
      // Metadata
      sessionId,
      timestamp: new Date().toISOString(),
      duration,
      seasonId: statusCheck.seasonId,
      seasonName: statusCheck.seasonName,
      
      // Error Information
      errors,
      
      // Audit Trail
      reasoning,
      summary
    };
  }

  /**
   * PRIVATE: Create error result for failed operations.
   */
  private createErrorResult(
    sessionId: string,
    duration: number,
    errors: string[],
    errorMessage: string
  ): CupActivationDetectionResult {
    return {
      // Decision Summary
      shouldActivate: false,
      actionTaken: 'Error occurred during processing',
      success: false,
      
      // Supporting Data (empty/default values)
      fixtureData: {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      },
      activationCondition: {
        conditionMet: false,
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: this.threshold,
        reasoning: 'Error occurred during processing'
      },
      statusCheck: {
        isActivated: false,
        activatedAt: null,
        seasonId: null,
        seasonName: null
      },
      
      // Metadata
      sessionId,
      timestamp: new Date().toISOString(),
      duration,
      seasonId: null,
      seasonName: null,
      
      // Error Information
      error: errorMessage,
      errors,
      
      // Audit Trail
      reasoning: `Process failed: ${errorMessage}`,
      summary: `Cup activation detection failed due to error: ${errorMessage}`
    };
  }

  /**
   * PRIVATE: Determine the action that was taken.
   */
  private determineActionTaken(
    shouldActivate: boolean,
    wasAlreadyActivated: boolean,
    conditionMet: boolean,
    activationResult?: ActivationAttemptResult
  ): string {
    if (wasAlreadyActivated) {
      return 'No action taken - Cup already activated';
    }

    if (!conditionMet) {
      return 'No action taken - Activation conditions not met';
    }

    if (shouldActivate && activationResult) {
      if (activationResult.success) {
        return activationResult.wasAlreadyActivated 
          ? 'No action taken - Cup was already activated by another process'
          : 'Cup successfully activated';
      } else {
        return `Activation failed: ${activationResult.error || 'Unknown error'}`;
      }
    }

    return 'No action taken';
  }

  /**
   * PRIVATE: Generate human-readable reasoning for the decision.
   */
  private generateReasoning(
    activationCondition: ActivationConditionResult,
    statusCheck: CupActivationStatus,
    shouldActivate: boolean,
    activationResult?: ActivationAttemptResult
  ): string {
    if (statusCheck.isActivated) {
      return `Cup was already activated on ${statusCheck.activatedAt} for ${statusCheck.seasonName}`;
    }

    if (!activationCondition.conditionMet) {
      return activationCondition.reasoning;
    }

    if (shouldActivate && activationResult) {
      if (activationResult.success) {
        return activationResult.wasAlreadyActivated
          ? 'Conditions were met, but cup was already activated by another process'
          : `Conditions were met and cup was successfully activated on ${activationResult.activatedAt}`;
      } else {
        return `Conditions were met but activation failed: ${activationResult.error}`;
      }
    }

    return 'Conditions were met but activation was not attempted';
  }

  /**
   * PRIVATE: Generate a summary of the entire process.
   */
  private generateSummary(
    fixtureData: FixtureDataResult,
    activationCondition: ActivationConditionResult,
    statusCheck: CupActivationStatus,
    activationResult: ActivationAttemptResult | undefined,
    shouldActivate: boolean
  ): string {
    const parts = [
      `Analyzed ${fixtureData.totalTeams} teams in ${statusCheck.seasonName || 'current season'}`,
      `Found ${fixtureData.teamsWithFiveOrFewerGames} teams (${fixtureData.percentageWithFiveOrFewerGames.toFixed(1)}%) with ≤5 games remaining`,
      `Activation threshold: ${activationCondition.threshold}%`,
      `Condition met: ${activationCondition.conditionMet ? 'Yes' : 'No'}`,
      `Was already activated: ${statusCheck.isActivated ? 'Yes' : 'No'}`
    ];

    if (shouldActivate && activationResult) {
      parts.push(`Activation attempted: ${activationResult.success ? 'Success' : 'Failed'}`);
    }

    return parts.join(' | ');
  }

  /**
   * PRIVATE: Create comprehensive audit log.
   */
  private createAuditLog(
    result: CupActivationDetectionResult,
    _context: Partial<CupActivationLogContext>
  ): void {
    this.logger.createAuditLog(
      result.sessionId,
      result.seasonId || 0,
      result.seasonName || 'Unknown Season',
      result.fixtureData,
      result.activationCondition,
      {
        wasAlreadyActivated: result.statusCheck.isActivated,
        activationDate: result.statusCheck.activatedAt || undefined
      },
      {
        shouldActivate: result.shouldActivate,
        reason: result.reasoning,
        actionTaken: result.actionTaken
      },
      result.duration,
      result.errors
    );
  }
}

// --- Singleton Instance ---
export const cupActivationDetectionService = new CupActivationDetectionService();

// --- Convenience Functions ---
export const detectAndActivateCup = (context?: Partial<CupActivationLogContext>) => {
  return cupActivationDetectionService.detectAndActivateCup(context);
};

export const shouldActivateCup = (context?: Partial<CupActivationLogContext>) => {
  return cupActivationDetectionService.shouldActivateCup(context);
};

export const checkActivationConditions = (context?: Partial<CupActivationLogContext>) => {
  return cupActivationDetectionService.checkActivationConditions(context);
};