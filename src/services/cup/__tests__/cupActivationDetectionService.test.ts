import {
  CupActivationDetectionService,
  detectAndActivateCup,
  shouldActivateCup,
  checkActivationConditions
} from '../cupActivationDetectionService';
import { fixtureDataService } from '../fixtureDataService';
import { activationConditionCalculator } from '../activationConditionCalculator';
import { cupActivationStatusChecker } from '../cupActivationStatusChecker';
import { idempotentActivationService } from '../idempotentActivationService';
import { cupActivationLogger } from '../cupActivationLogger';
import type { FixtureDataResult } from '../fixtureDataService';
import type { ActivationConditionResult } from '../activationConditionCalculator';
import type { CupActivationStatus } from '../cupActivationStatusChecker';
import type { ActivationAttemptResult } from '../idempotentActivationService';

// Mock all the services
jest.mock('../fixtureDataService');
jest.mock('../activationConditionCalculator');
jest.mock('../cupActivationStatusChecker');
jest.mock('../idempotentActivationService');
jest.mock('../cupActivationLogger');

const mockFixtureDataService = fixtureDataService as jest.Mocked<typeof fixtureDataService>;
const mockActivationConditionCalculator = activationConditionCalculator as jest.Mocked<typeof activationConditionCalculator>;
const mockCupActivationStatusChecker = cupActivationStatusChecker as jest.Mocked<typeof cupActivationStatusChecker>;
const mockIdempotentActivationService = idempotentActivationService as jest.Mocked<typeof idempotentActivationService>;
const mockCupActivationLogger = cupActivationLogger as jest.Mocked<typeof cupActivationLogger>;

describe('CupActivationDetectionService', () => {
  let service: CupActivationDetectionService;

  beforeEach(() => {
    service = new CupActivationDetectionService();
    jest.clearAllMocks();

    // Setup default mock returns for logger
    mockCupActivationLogger.startOperation.mockReturnValue({
      sessionId: 'test-session-123',
      endOperation: jest.fn()
    });
    mockCupActivationLogger.info.mockImplementation(() => {});
    mockCupActivationLogger.debug.mockImplementation(() => {});
    mockCupActivationLogger.error.mockImplementation(() => {});
    mockCupActivationLogger.logFixtureDataAnalysis.mockImplementation(() => {});
    mockCupActivationLogger.logActivationConditionResult.mockImplementation(() => {});
    mockCupActivationLogger.logStatusCheck.mockImplementation(() => {});
    mockCupActivationLogger.logActivationDecision.mockImplementation(() => {});
    mockCupActivationLogger.createAuditLog.mockImplementation(() => ({
      timestamp: new Date().toISOString(),
      sessionId: 'test-session-123',
      seasonId: 1,
      seasonName: 'Test Season',
      fixtureDataResult: {} as FixtureDataResult,
      activationConditionResult: {} as ActivationConditionResult,
      statusCheck: {} as CupActivationStatus,
      finalDecision: {} as ActivationAttemptResult,
      duration: 1000
    }));
  });

  describe('detectAndActivateCup', () => {
    test('should successfully activate cup when conditions are met', async () => {
      // Setup mocks for successful activation
      const mockFixtureData = {
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 3 },
          { teamId: 2, teamName: 'Team B', remainingGames: 4 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 2,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 2,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met for activation'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const mockActivationResult = {
        success: true,
        wasAlreadyActivated: false,
        activatedAt: '2024-01-15T10:30:00Z',
        seasonId: 1,
        seasonName: 'Test Season',
        error: null,
        attemptedAt: '2024-01-15T10:30:00Z'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockResolvedValue(mockActivationResult);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(true);
      expect(result.actionTaken).toBe('Cup successfully activated');
      expect(result.success).toBe(true);
      expect(result.fixtureData).toEqual(mockFixtureData);
      expect(result.activationCondition).toEqual(mockActivationCondition);
      expect(result.statusCheck).toEqual(mockStatusCheck);
      expect(result.activationResult).toEqual(mockActivationResult);
      expect(result.errors).toHaveLength(0);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.reasoning).toContain('successfully activated');
    });

    test('should skip activation when cup is already activated', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met for activation'
      };

      const mockStatusCheck = {
        isActivated: true,
        activatedAt: '2024-01-10T10:30:00Z',
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.actionTaken).toBe('No action taken - Cup already activated');
      expect(result.success).toBe(true);
      expect(result.activationResult).toBeUndefined();
      expect(result.reasoning).toContain('already activated');
      expect(mockIdempotentActivationService.activateCurrentSeasonCup).not.toHaveBeenCalled();
    });

    test('should skip activation when conditions are not met', async () => {
      const mockFixtureData = {
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 3 },
          { teamId: 2, teamName: 'Team B', remainingGames: 8 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50,
        threshold: 60,
        reasoning: 'Only 50% of teams meet the condition, below 60% threshold'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.actionTaken).toBe('No action taken - Activation conditions not met');
      expect(result.success).toBe(true);
      expect(result.activationResult).toBeUndefined();
      expect(result.reasoning).toContain('Only 50% of teams meet the condition');
      expect(mockIdempotentActivationService.activateCurrentSeasonCup).not.toHaveBeenCalled();
    });

    test('should handle fixture data service failure', async () => {
      const error = new Error('Database connection failed');
      mockFixtureDataService.getTeamRemainingGames.mockRejectedValue(error);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Fixture data query failed');
      expect(result.error).toContain('Database connection failed');
      expect(result.actionTaken).toBe('Error occurred during processing');
    });

    test('should handle activation condition calculator failure', async () => {
      const mockFixtureData = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const error = new Error('Calculation failed');
      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockRejectedValue(error);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Activation condition calculation failed');
    });

    test('should handle status checker failure', async () => {
      const mockFixtureData = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'No teams'
      };

      const error = new Error('Status check failed');
      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockRejectedValue(error);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Activation status check failed');
    });

    test('should handle activation service failure', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const error = new Error('Activation failed');
      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockRejectedValue(error);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Cup activation failed');
    });

    test('should handle successful activation but service returns failure', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const mockActivationResult = {
        success: false,
        wasAlreadyActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season',
        error: 'Database constraint violation',
        attemptedAt: '2024-01-15T10:30:00Z'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockResolvedValue(mockActivationResult);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(true);
      expect(result.actionTaken).toBe('Activation failed: Database constraint violation');
      expect(result.success).toBe(true); // No errors in the process, just activation failed
      expect(result.activationResult).toEqual(mockActivationResult);
      expect(result.reasoning).toContain('activation failed');
    });

    test('should handle race condition (was already activated during process)', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const mockActivationResult = {
        success: true,
        wasAlreadyActivated: true,
        activatedAt: '2024-01-15T10:30:00Z',
        seasonId: 1,
        seasonName: 'Test Season',
        error: null,
        attemptedAt: '2024-01-15T10:30:00Z'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockResolvedValue(mockActivationResult);

      const result = await service.detectAndActivateCup();

      expect(result.shouldActivate).toBe(true);
      expect(result.actionTaken).toBe('No action taken - Cup was already activated by another process');
      expect(result.success).toBe(true);
      expect(result.reasoning).toContain('already activated by another process');
    });

    test('should include proper metadata in result', async () => {
      const mockFixtureData = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'No teams'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const startTime = Date.now();
      // Add a small delay to ensure duration is not 0
      await new Promise(resolve => setTimeout(resolve, 5));
      const result = await service.detectAndActivateCup();
      const endTime = Date.now();

      expect(result.sessionId).toBe('test-session-123');
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(endTime - startTime + 100); // Allow some tolerance
      expect(result.seasonId).toBe(1);
      expect(result.seasonName).toBe('Test Season');
      expect(result.summary).toContain('Test Season');
      expect(result.summary).toContain('0 teams');
    });
  });

  describe('shouldActivateCup', () => {
    test('should return true when conditions are met', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const mockActivationResult = {
        success: true,
        wasAlreadyActivated: false,
        activatedAt: '2024-01-15T10:30:00Z',
        seasonId: 1,
        seasonName: 'Test Season',
        error: null,
        attemptedAt: '2024-01-15T10:30:00Z'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockResolvedValue(mockActivationResult);

      const result = await service.shouldActivateCup();

      expect(result).toBe(true);
    });

    test('should return false when conditions are not met', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 8 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'No teams meet condition'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result = await service.shouldActivateCup();

      expect(result).toBe(false);
    });
  });

  describe('checkActivationConditions', () => {
    test('should return conditions without attempting activation', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result = await service.checkActivationConditions();

      expect(result.shouldActivate).toBe(true);
      expect(result.activationResult).toBeUndefined();
      expect(result.success).toBe(true);
      expect(mockIdempotentActivationService.activateCurrentSeasonCup).not.toHaveBeenCalled();
    });

    test('should handle errors in check-only mode', async () => {
      const error = new Error('Database error');
      mockFixtureDataService.getTeamRemainingGames.mockRejectedValue(error);

      const result = await service.checkActivationConditions();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.shouldActivate).toBe(false);
    });
  });

  describe('Custom threshold', () => {
    test('should use custom threshold when provided', async () => {
      const customService = new CupActivationDetectionService(80);
      
      const mockFixtureData = {
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 3 },
          { teamId: 2, teamName: 'Team B', remainingGames: 8 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50,
        threshold: 80,
        reasoning: 'Only 50% meets condition, below 80% threshold'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result = await customService.detectAndActivateCup();

      expect(result.shouldActivate).toBe(false);
      expect(result.activationCondition.threshold).toBe(80);
      expect(mockActivationConditionCalculator.calculateActivationCondition).toHaveBeenCalledWith(mockFixtureData, 80);
    });
  });

  describe('Convenience Functions', () => {
    test('should use singleton service for convenience functions', async () => {
      const mockFixtureData = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const mockActivationCondition = {
        conditionMet: false,
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'No teams'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);

      const result1 = await detectAndActivateCup();
      const result2 = await shouldActivateCup();
      const result3 = await checkActivationConditions();

      expect(result1).toBeDefined();
      expect(result2).toBe(false);
      expect(result3).toBeDefined();
    });
  });

  describe('Logging Integration', () => {
    test('should call all logging methods during successful flow', async () => {
      const mockFixtureData = {
        teams: [{ teamId: 1, teamName: 'Team A', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      const mockActivationCondition = {
        conditionMet: true,
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100,
        threshold: 60,
        reasoning: 'Conditions met'
      };

      const mockStatusCheck = {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: 'Test Season'
      };

      const mockActivationResult = {
        success: true,
        wasAlreadyActivated: false,
        activatedAt: '2024-01-15T10:30:00Z',
        seasonId: 1,
        seasonName: 'Test Season',
        error: null,
        attemptedAt: '2024-01-15T10:30:00Z'
      };

      mockFixtureDataService.getTeamRemainingGames.mockResolvedValue(mockFixtureData);
      mockActivationConditionCalculator.calculateActivationCondition.mockResolvedValue(mockActivationCondition);
      mockCupActivationStatusChecker.checkCurrentSeasonActivationStatus.mockResolvedValue(mockStatusCheck);
      mockIdempotentActivationService.activateCurrentSeasonCup.mockResolvedValue(mockActivationResult);

      await service.detectAndActivateCup();

      expect(mockCupActivationLogger.startOperation).toHaveBeenCalledWith(
        'detectAndActivateCup',
        expect.objectContaining({ threshold: 60 })
      );
      expect(mockCupActivationLogger.logFixtureDataAnalysis).toHaveBeenCalledWith(
        mockFixtureData,
        expect.objectContaining({ sessionId: 'test-session-123' })
      );
      expect(mockCupActivationLogger.logActivationConditionResult).toHaveBeenCalledWith(
        mockActivationCondition,
        expect.objectContaining({ sessionId: 'test-session-123' })
      );
      expect(mockCupActivationLogger.logStatusCheck).toHaveBeenCalledWith(
        false,
        null,
        expect.objectContaining({ sessionId: 'test-session-123' })
      );
      expect(mockCupActivationLogger.logActivationDecision).toHaveBeenCalledWith(
        true,
        expect.stringContaining('successfully activated'),
        'Cup successfully activated',
        expect.objectContaining({ sessionId: 'test-session-123' })
      );
      expect(mockCupActivationLogger.createAuditLog).toHaveBeenCalled();
    });

    test('should log errors appropriately', async () => {
      const error = new Error('Test error');
      mockFixtureDataService.getTeamRemainingGames.mockRejectedValue(error);

      await service.detectAndActivateCup();

      expect(mockCupActivationLogger.error).toHaveBeenCalledWith(
        'Cup activation detection process failed',
        expect.objectContaining({ sessionId: 'test-session-123' }),
        expect.objectContaining({ error: 'Test error' }),
        error
      );
    });
  });
}); 