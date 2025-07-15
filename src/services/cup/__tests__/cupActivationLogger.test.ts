import {
  CupActivationLogger,
  cupActivationLogger,
  logFixtureDataAnalysis,
  logActivationConditionResult,
  logCupStatusCheck,
  logActivationDecision,
  startOperation
} from '../cupActivationLogger';
import { FixtureDataResult } from '../fixtureDataService';
import { ActivationConditionResult } from '../activationConditionCalculator';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock console methods
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockConsoleWarn = jest.fn();
const mockConsoleDebug = jest.fn();

global.console = {
  ...console,
  log: mockConsoleLog,
  error: mockConsoleError,
  warn: mockConsoleWarn,
  debug: mockConsoleDebug,
};

describe('CupActivationLogger', () => {
  let logger: CupActivationLogger;
  
  beforeEach(() => {
    logger = new CupActivationLogger();
    jest.clearAllMocks();
    
    // Clear the singleton logger for each test
    cupActivationLogger.clearLogs();
  });

  describe('Basic Logging Methods', () => {
    test('should log debug messages with proper context', () => {
      const context = { service: 'TestService', operation: 'testOperation' };
      const details = { testKey: 'testValue' };
      
      logger.debug('Test debug message', context, details);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('debug');
      expect(events[0].message).toBe('Test debug message');
      expect(events[0].context.service).toBe('TestService');
      expect(events[0].context.operation).toBe('testOperation');
      expect(events[0].details).toEqual(details);
    });

    test('should log info messages with proper context', () => {
      const context = { service: 'TestService', operation: 'testOperation' };
      const details = { testKey: 'testValue' };
      
      logger.info('Test info message', context, details);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('info');
      expect(events[0].message).toBe('Test info message');
      expect(events[0].context.service).toBe('TestService');
      expect(events[0].details).toEqual(details);
    });

    test('should log warning messages with proper context', () => {
      const context = { service: 'TestService', operation: 'testOperation' };
      const details = { testKey: 'testValue' };
      
      logger.warn('Test warning message', context, details);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('warn');
      expect(events[0].message).toBe('Test warning message');
    });

    test('should log error messages with error object', () => {
      const context = { service: 'TestService', operation: 'testOperation' };
      const details = { testKey: 'testValue' };
      const error = new Error('Test error');
      
      logger.error('Test error message', context, details, error);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('error');
      expect(events[0].message).toBe('Test error message');
      expect(events[0].details.error).toEqual({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });

    test('should use default service name when not provided', () => {
      logger.info('Test message');
      
      const events = logger.getEvents();
      expect(events[0].context.service).toBe('CupActivationService');
      expect(events[0].context.operation).toBe('unknown');
    });

    test('should generate unique session IDs', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      
      const events = logger.getEvents();
      expect(events[0].context.sessionId).toBeDefined();
      expect(events[1].context.sessionId).toBeDefined();
      expect(events[0].context.sessionId).not.toBe(events[1].context.sessionId);
    });

    test('should include timestamps in context', () => {
      const beforeTime = new Date();
      logger.info('Test message');
      const afterTime = new Date();
      
      const events = logger.getEvents();
      const eventTime = new Date(events[0].context.timestamp);
      
      expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Operation Tracking', () => {
    test('should track operation start and end', () => {
      const { sessionId, endOperation } = startOperation('testOperation');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^cup-/);
      
      const startEvents = cupActivationLogger.getEvents();
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].message).toBe('Starting operation: testOperation');
      
      endOperation('success', { resultData: 'test' });
      
      const allEvents = cupActivationLogger.getEvents();
      expect(allEvents).toHaveLength(2);
      expect(allEvents[1].message).toBe('Completed operation: testOperation');
      expect(allEvents[1].details.result).toBe('success');
      expect(allEvents[1].details.resultData).toBe('test');
      expect(allEvents[1].details.duration).toBeDefined();
    });

    test('should track operation duration', async () => {
      const { endOperation } = logger.startOperation('testOperation');
      
      // Wait a bit to ensure duration is measured
      await new Promise(resolve => setTimeout(resolve, 10));
      
      endOperation('success');
      
      const events = logger.getEvents();
      const endEvent = events.find(e => e.message.includes('Completed operation'));
      
      expect(endEvent?.details.duration).toBeDefined();
      expect(typeof endEvent?.details.duration).toBe('number');
      expect(endEvent?.details.duration as number).toBeGreaterThan(0);
    });
  });

  describe('Specialized Logging Methods', () => {
    test('should log fixture data analysis', () => {
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 3 },
          { teamId: 2, teamName: 'Team B', remainingGames: 8 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      };
      
      logger.logFixtureDataAnalysis(fixtureData);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].context.service).toBe('FixtureDataService');
      expect(events[0].context.operation).toBe('getTeamRemainingGames');
      expect(events[0].details.totalTeams).toBe(2);
      expect(events[0].details.teamsWithFiveOrFewerGames).toBe(1);
      expect(events[0].details.percentageWithFiveOrFewerGames).toBe(50);
      expect(events[0].details.teamsSummary).toEqual([
        { name: 'Team A', remainingGames: 3 },
        { name: 'Team B', remainingGames: 8 }
      ]);
    });

    test('should log activation condition result - condition met', () => {
      const conditionResult: ActivationConditionResult = {
        conditionMet: true,
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 7,
        percentageWithFiveOrFewerGames: 70,
        threshold: 60,
        reasoning: 'Threshold met'
      };
      
      logger.logActivationConditionResult(conditionResult);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('info');
      expect(events[0].message).toBe('Activation condition MET');
      expect(events[0].context.service).toBe('ActivationConditionCalculator');
      expect(events[0].details.conditionMet).toBe(true);
      expect(events[0].details.threshold).toBe(60);
    });

    test('should log activation condition result - condition not met', () => {
      const conditionResult: ActivationConditionResult = {
        conditionMet: false,
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 3,
        percentageWithFiveOrFewerGames: 30,
        threshold: 60,
        reasoning: 'Threshold not met'
      };
      
      logger.logActivationConditionResult(conditionResult);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('debug');
      expect(events[0].message).toBe('Activation condition NOT MET');
      expect(events[0].details.conditionMet).toBe(false);
    });

    test('should log status check - already activated', () => {
      logger.logStatusCheck(true, '2024-01-15T10:30:00Z');
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Cup activation status: ALREADY ACTIVATED');
      expect(events[0].context.service).toBe('CupActivationStatusChecker');
      expect(events[0].details.isActivated).toBe(true);
      expect(events[0].details.activationDate).toBe('2024-01-15T10:30:00Z');
    });

    test('should log status check - not activated', () => {
      logger.logStatusCheck(false, null);
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Cup activation status: NOT ACTIVATED');
      expect(events[0].details.isActivated).toBe(false);
      expect(events[0].details.activationDate).toBeNull();
    });

    test('should log activation decision - should activate', () => {
      logger.logActivationDecision(true, 'Conditions met', 'Cup activated');
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('info');
      expect(events[0].message).toBe('Activation decision: ACTIVATE');
      expect(events[0].context.service).toBe('IdempotentActivationService');
      expect(events[0].details.shouldActivate).toBe(true);
      expect(events[0].details.reason).toBe('Conditions met');
      expect(events[0].details.actionTaken).toBe('Cup activated');
    });

    test('should log activation decision - no action', () => {
      logger.logActivationDecision(false, 'Already activated', 'No action taken');
      
      const events = logger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('debug');
      expect(events[0].message).toBe('Activation decision: NO ACTION');
      expect(events[0].details.shouldActivate).toBe(false);
    });
  });

  describe('Audit Log Management', () => {
    test('should create comprehensive audit log', () => {
      const fixtureData: FixtureDataResult = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };
      
      const conditionResult: ActivationConditionResult = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Threshold met'
      };
      
      const auditLog = logger.createAuditLog(
        'test-session-123',
        1,
        'Test Season',
        fixtureData,
        conditionResult,
        { wasAlreadyActivated: false },
        { shouldActivate: true, reason: 'Conditions met', actionTaken: 'Cup activated' },
        1000,
        []
      );
      
      expect(auditLog.sessionId).toBe('test-session-123');
      expect(auditLog.seasonId).toBe(1);
      expect(auditLog.seasonName).toBe('Test Season');
      expect(auditLog.duration).toBe(1000);
      expect(auditLog.fixtureDataResult).toEqual(fixtureData);
      expect(auditLog.activationConditionResult).toEqual(conditionResult);
      expect(auditLog.finalDecision.shouldActivate).toBe(true);
      expect(auditLog.errors).toBeUndefined();
      
      const auditLogs = logger.getAuditLogs();
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toEqual(auditLog);
    });

    test('should create audit log with errors', () => {
      const fixtureData: FixtureDataResult = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };
      
      const conditionResult: ActivationConditionResult = {
        conditionMet: false,
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'No teams found'
      };
      
      const errors = ['Database connection failed', 'Season not found'];
      
      const auditLog = logger.createAuditLog(
        'test-session-456',
        2,
        'Test Season 2',
        fixtureData,
        conditionResult,
        { wasAlreadyActivated: false },
        { shouldActivate: false, reason: 'Errors occurred', actionTaken: 'No action taken' },
        2000,
        errors
      );
      
      expect(auditLog.errors).toEqual(errors);
      expect(auditLog.finalDecision.shouldActivate).toBe(false);
      expect(auditLog.finalDecision.reason).toBe('Errors occurred');
    });

    test('should retrieve audit logs by session', () => {
      const mockData = {
        fixtureData: { teams: [], totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0 },
        conditionResult: { conditionMet: false, totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0, threshold: 60, reasoning: 'Test' },
        statusCheck: { wasAlreadyActivated: false },
        finalDecision: { shouldActivate: false, reason: 'Test', actionTaken: 'Test' }
      };
      
      logger.createAuditLog('session-1', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1000);
      logger.createAuditLog('session-2', 2, 'Season 2', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 2000);
      logger.createAuditLog('session-1', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1500);
      
      const session1Logs = logger.getAuditLogsBySession('session-1');
      const session2Logs = logger.getAuditLogsBySession('session-2');
      
      expect(session1Logs).toHaveLength(2);
      expect(session2Logs).toHaveLength(1);
      expect(session1Logs[0].sessionId).toBe('session-1');
      expect(session2Logs[0].sessionId).toBe('session-2');
    });

    test('should retrieve audit logs by season', () => {
      const mockData = {
        fixtureData: { teams: [], totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0 },
        conditionResult: { conditionMet: false, totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0, threshold: 60, reasoning: 'Test' },
        statusCheck: { wasAlreadyActivated: false },
        finalDecision: { shouldActivate: false, reason: 'Test', actionTaken: 'Test' }
      };
      
      logger.createAuditLog('session-1', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1000);
      logger.createAuditLog('session-2', 2, 'Season 2', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 2000);
      logger.createAuditLog('session-3', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1500);
      
      const season1Logs = logger.getAuditLogsBySeason(1);
      const season2Logs = logger.getAuditLogsBySeason(2);
      
      expect(season1Logs).toHaveLength(2);
      expect(season2Logs).toHaveLength(1);
      expect(season1Logs[0].seasonId).toBe(1);
      expect(season2Logs[0].seasonId).toBe(2);
    });
  });

  describe('Log Management', () => {
    test('should clear all logs', () => {
      logger.info('Test message 1');
      logger.info('Test message 2');
      
      const mockData = {
        fixtureData: { teams: [], totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0 },
        conditionResult: { conditionMet: false, totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0, threshold: 60, reasoning: 'Test' },
        statusCheck: { wasAlreadyActivated: false },
        finalDecision: { shouldActivate: false, reason: 'Test', actionTaken: 'Test' }
      };
      
      logger.createAuditLog('session-1', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1000);
      
      expect(logger.getEvents()).toHaveLength(3); // 2 info + 1 audit log creation
      expect(logger.getAuditLogs()).toHaveLength(1);
      
      logger.clearLogs();
      
      expect(logger.getEvents()).toHaveLength(0);
      expect(logger.getAuditLogs()).toHaveLength(0);
    });

    test('should export logs in proper format', () => {
      logger.info('Test message');
      
      const mockData = {
        fixtureData: { teams: [], totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0 },
        conditionResult: { conditionMet: false, totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0, threshold: 60, reasoning: 'Test' },
        statusCheck: { wasAlreadyActivated: false },
        finalDecision: { shouldActivate: false, reason: 'Test', actionTaken: 'Test' }
      };
      
      logger.createAuditLog('session-1', 1, 'Season 1', mockData.fixtureData, mockData.conditionResult, mockData.statusCheck, mockData.finalDecision, 1000);
      
      const exportedLogs = logger.exportLogs();
      
      expect(exportedLogs).toHaveProperty('auditLogs');
      expect(exportedLogs).toHaveProperty('events');
      expect(exportedLogs).toHaveProperty('exportTimestamp');
      expect(exportedLogs.auditLogs).toHaveLength(1);
      expect(exportedLogs.events).toHaveLength(2); // 1 info + 1 audit log creation
      expect(exportedLogs.exportTimestamp).toBeDefined();
    });
  });

  describe('Convenience Functions', () => {
    test('should use convenience functions with singleton logger', () => {
      logFixtureDataAnalysis({
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 3 },
          { teamId: 2, teamName: 'Team B', remainingGames: 8 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      });
      logActivationConditionResult({
        conditionMet: true,
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 7,
        percentageWithFiveOrFewerGames: 70,
        threshold: 60,
        reasoning: 'Threshold met'
      });
      logCupStatusCheck(true, '2024-01-15T10:30:00Z');
      logActivationDecision(true, 'Conditions met', 'Cup activated');
      
      const events = cupActivationLogger.getEvents();
      expect(events).toHaveLength(4);
      expect(events[0].level).toBe('info');
      expect(events[1].level).toBe('info');
      expect(events[2].level).toBe('info');
      expect(events[3].level).toBe('info');
    });

    test('should use startOperation convenience function', () => {
      const { sessionId, endOperation } = startOperation('testOperation');
      
      expect(sessionId).toBeDefined();
      endOperation('success');
      
      const events = cupActivationLogger.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].message).toBe('Starting operation: testOperation');
      expect(events[1].message).toBe('Completed operation: testOperation');
    });
  });
}); 