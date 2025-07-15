import { logger } from '@/utils/logger';
import { FixtureDataResult } from './fixtureDataService';
import { ActivationConditionResult } from './activationConditionCalculator';

// --- Types ---
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type CupActivationLogContext = {
  service: string;
  operation: string;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  seasonId?: number;
  seasonName?: string;
  duration?: number;
  [key: string]: unknown;
};

export type CupActivationEvent = {
  event: string;
  context: CupActivationLogContext;
  details: Record<string, unknown>;
  level: LogLevel;
  message: string;
};

export type ActivationDecisionAuditLog = {
  timestamp: string;
  sessionId: string;
  seasonId: number;
  seasonName: string;
  fixtureDataResult: FixtureDataResult;
  activationConditionResult: ActivationConditionResult;
  statusCheck: {
    wasAlreadyActivated: boolean;
    activationDate?: string;
  };
  finalDecision: {
    shouldActivate: boolean;
    reason: string;
    actionTaken: string;
  };
  duration: number;
  errors?: string[];
};

// --- Constants ---
const SERVICE_NAME = 'CupActivationService';
const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m'   // Reset
};

// --- Utilities ---
const generateSessionId = (): string => {
  return `cup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const formatDuration = (startTime: number): number => {
  return Date.now() - startTime;
};

const createBaseContext = (
  service: string,
  operation: string,
  additionalContext: Partial<CupActivationLogContext> = {}
): CupActivationLogContext => ({
  service,
  operation,
  timestamp: new Date().toISOString(),
  sessionId: generateSessionId(),
  ...additionalContext
});

// --- Cup Activation Logger Service ---
export class CupActivationLogger {
  private auditLogs: ActivationDecisionAuditLog[] = [];
  private events: CupActivationEvent[] = [];

  /**
   * Logs a structured message with context and metadata.
   */
  log(
    level: LogLevel,
    message: string,
    context: Partial<CupActivationLogContext>,
    details: Record<string, unknown> = {}
  ): void {
    const fullContext = createBaseContext(
      context.service || SERVICE_NAME,
      context.operation || 'unknown',
      context
    );

    const event: CupActivationEvent = {
      event: `${level.toUpperCase()}_LOG`,
      context: fullContext,
      details,
      level,
      message
    };

    this.events.push(event);

    // Console logging with color coding
    if (process.env.NODE_ENV === 'development') {
      const color = LOG_COLORS[level] || LOG_COLORS.reset;
      console.log(
        `${color}[${fullContext.service}:${fullContext.operation}]${LOG_COLORS.reset} ${message}`,
        details
      );
    }

    // Structured logging with Pino
    const logData = {
      service: fullContext.service,
      operation: fullContext.operation,
      sessionId: fullContext.sessionId,
      timestamp: fullContext.timestamp,
      details,
      ...context
    };

    switch (level) {
      case 'debug':
        logger.debug(logData, message);
        break;
      case 'info':
        logger.info(logData, message);
        break;
      case 'warn':
        logger.warn(logData, message);
        break;
      case 'error':
        logger.error(logData, message);
        break;
    }
  }

  /**
   * Logs debug information.
   */
  debug(
    message: string,
    context: Partial<CupActivationLogContext> = {},
    details: Record<string, unknown> = {}
  ): void {
    this.log('debug', message, context, details);
  }

  /**
   * Logs general information.
   */
  info(
    message: string,
    context: Partial<CupActivationLogContext> = {},
    details: Record<string, unknown> = {}
  ): void {
    this.log('info', message, context, details);
  }

  /**
   * Logs warning information.
   */
  warn(
    message: string,
    context: Partial<CupActivationLogContext> = {},
    details: Record<string, unknown> = {}
  ): void {
    this.log('warn', message, context, details);
  }

  /**
   * Logs error information.
   */
  error(
    message: string,
    context: Partial<CupActivationLogContext> = {},
    details: Record<string, unknown> = {},
    error?: Error
  ): void {
    const errorDetails = error ? {
      ...details,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : details;

    this.log('error', message, context, errorDetails);
  }

  /**
   * Logs the start of an operation and returns a timer function.
   */
  startOperation(
    operation: string,
    context: Partial<CupActivationLogContext> = {}
  ): { sessionId: string; endOperation: (result?: string, details?: Record<string, unknown>) => void } {
    const startTime = Date.now();
    const sessionId = generateSessionId();
    const operationContext = { ...context, sessionId, operation };

    this.info(
      `Starting operation: ${operation}`,
      operationContext,
      { startTime }
    );

    const endOperation = (result?: string, details: Record<string, unknown> = {}) => {
      const duration = formatDuration(startTime);
      this.info(
        `Completed operation: ${operation}`,
        { ...operationContext, duration },
        { 
          duration, 
          result, 
          ...details 
        }
      );
    };

    return { sessionId, endOperation };
  }

  /**
   * Logs fixture data analysis results.
   */
  logFixtureDataAnalysis(
    fixtureData: FixtureDataResult,
    context: Partial<CupActivationLogContext> = {}
  ): void {
    const analysisContext = {
      ...context,
      service: 'FixtureDataService',
      operation: 'getTeamRemainingGames'
    };

    this.info(
      'Fixture data analysis completed',
      analysisContext,
      {
        totalTeams: fixtureData.totalTeams,
        teamsWithFiveOrFewerGames: fixtureData.teamsWithFiveOrFewerGames,
        percentageWithFiveOrFewerGames: fixtureData.percentageWithFiveOrFewerGames,
        teamsSummary: fixtureData.teams.map(team => ({
          name: team.teamName,
          remainingGames: team.remainingGames
        }))
      }
    );
  }

  /**
   * Logs activation condition calculation results.
   */
  logActivationConditionResult(
    conditionResult: ActivationConditionResult,
    context: Partial<CupActivationLogContext> = {}
  ): void {
    const calculationContext = {
      ...context,
      service: 'ActivationConditionCalculator',
      operation: 'calculateActivationCondition'
    };

    const level: LogLevel = conditionResult.conditionMet ? 'info' : 'debug';
    
    this.log(
      level,
      `Activation condition ${conditionResult.conditionMet ? 'MET' : 'NOT MET'}`,
      calculationContext,
      {
        conditionMet: conditionResult.conditionMet,
        threshold: conditionResult.threshold,
        percentage: conditionResult.percentageWithFiveOrFewerGames,
        reasoning: conditionResult.reasoning
      }
    );
  }

  /**
   * Logs cup activation status check results.
   */
  logStatusCheck(
    isActivated: boolean,
    activationDate: string | null,
    context: Partial<CupActivationLogContext> = {}
  ): void {
    const statusContext = {
      ...context,
      service: 'CupActivationStatusChecker',
      operation: 'checkActivationStatus'
    };

    this.info(
      `Cup activation status: ${isActivated ? 'ALREADY ACTIVATED' : 'NOT ACTIVATED'}`,
      statusContext,
      {
        isActivated,
        activationDate,
        message: isActivated 
          ? `Cup was already activated on ${activationDate}` 
          : 'Cup has not been activated yet'
      }
    );
  }

  /**
   * Logs the final activation decision and action taken.
   */
  logActivationDecision(
    shouldActivate: boolean,
    reason: string,
    actionTaken: string,
    context: Partial<CupActivationLogContext> = {}
  ): void {
    const decisionContext = {
      ...context,
      service: 'IdempotentActivationService',
      operation: 'activateCup'
    };

    const level: LogLevel = shouldActivate ? 'info' : 'debug';
    
    this.log(
      level,
      `Activation decision: ${shouldActivate ? 'ACTIVATE' : 'NO ACTION'}`,
      decisionContext,
      {
        shouldActivate,
        reason,
        actionTaken
      }
    );
  }

  /**
   * Creates a comprehensive audit log for a complete activation decision cycle.
   */
  createAuditLog(
    sessionId: string,
    seasonId: number,
    seasonName: string,
    fixtureDataResult: FixtureDataResult,
    activationConditionResult: ActivationConditionResult,
    statusCheck: { wasAlreadyActivated: boolean; activationDate?: string },
    finalDecision: { shouldActivate: boolean; reason: string; actionTaken: string },
    duration: number,
    errors: string[] = []
  ): ActivationDecisionAuditLog {
    const auditLog: ActivationDecisionAuditLog = {
      timestamp: new Date().toISOString(),
      sessionId,
      seasonId,
      seasonName,
      fixtureDataResult,
      activationConditionResult,
      statusCheck,
      finalDecision,
      duration,
      errors: errors.length > 0 ? errors : undefined
    };

    this.auditLogs.push(auditLog);

    this.info(
      'Audit log created for activation decision cycle',
      {
        service: SERVICE_NAME,
        operation: 'createAuditLog',
        sessionId,
        seasonId,
        seasonName
      },
      {
        auditLogId: auditLog.timestamp,
        duration,
        finalDecision: finalDecision.shouldActivate,
        hasErrors: errors.length > 0
      }
    );

    return auditLog;
  }

  /**
   * Retrieves all audit logs.
   */
  getAuditLogs(): ActivationDecisionAuditLog[] {
    return [...this.auditLogs];
  }

  /**
   * Retrieves all events.
   */
  getEvents(): CupActivationEvent[] {
    return [...this.events];
  }

  /**
   * Retrieves audit logs for a specific session.
   */
  getAuditLogsBySession(sessionId: string): ActivationDecisionAuditLog[] {
    return this.auditLogs.filter(log => log.sessionId === sessionId);
  }

  /**
   * Retrieves audit logs for a specific season.
   */
  getAuditLogsBySeason(seasonId: number): ActivationDecisionAuditLog[] {
    return this.auditLogs.filter(log => log.seasonId === seasonId);
  }

  /**
   * Clears all logs and audit trails (useful for testing).
   */
  clearLogs(): void {
    this.auditLogs = [];
    this.events = [];
  }

  /**
   * Exports logs in a JSON format suitable for external analysis.
   */
  exportLogs(): {
    auditLogs: ActivationDecisionAuditLog[];
    events: CupActivationEvent[];
    exportTimestamp: string;
  } {
    return {
      auditLogs: this.getAuditLogs(),
      events: this.getEvents(),
      exportTimestamp: new Date().toISOString()
    };
  }
}

// --- Singleton Instance ---
export const cupActivationLogger = new CupActivationLogger();

// --- Convenience Functions ---
export const logDebug = (message: string, context?: Partial<CupActivationLogContext>, details?: Record<string, unknown>) => {
  cupActivationLogger.debug(message, context, details);
};

export const logInfo = (message: string, context?: Partial<CupActivationLogContext>, details?: Record<string, unknown>) => {
  cupActivationLogger.info(message, context, details);
};

export const logWarn = (message: string, context?: Partial<CupActivationLogContext>, details?: Record<string, unknown>) => {
  cupActivationLogger.warn(message, context, details);
};

export const logError = (message: string, context?: Partial<CupActivationLogContext>, details?: Record<string, unknown>, error?: Error) => {
  cupActivationLogger.error(message, context, details, error);
};

export const startOperation = (operation: string, context?: Partial<CupActivationLogContext>) => {
  return cupActivationLogger.startOperation(operation, context);
};

export const logFixtureDataAnalysis = (fixtureData: FixtureDataResult, context?: Partial<CupActivationLogContext>) => {
  cupActivationLogger.logFixtureDataAnalysis(fixtureData, context);
};

export const logActivationConditionResult = (conditionResult: ActivationConditionResult, context?: Partial<CupActivationLogContext>) => {
  cupActivationLogger.logActivationConditionResult(conditionResult, context);
};

export const logCupStatusCheck = (isActivated: boolean, activationDate: string | null, context?: Partial<CupActivationLogContext>) => {
  cupActivationLogger.logStatusCheck(isActivated, activationDate, context);
};

export const logActivationDecision = (shouldActivate: boolean, reason: string, actionTaken: string, context?: Partial<CupActivationLogContext>) => {
  cupActivationLogger.logActivationDecision(shouldActivate, reason, actionTaken, context);
};

export const logActivationResult = (result: Record<string, unknown>, context?: Partial<CupActivationLogContext>) => {
  cupActivationLogger.info('Activation result logged', context, { result });
}; 