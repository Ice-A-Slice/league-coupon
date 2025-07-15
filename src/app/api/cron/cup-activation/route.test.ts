// Mock dependencies first before any imports
jest.mock('@/services/cup/cupActivationDetectionService');
jest.mock('@/utils/logger');
jest.mock('@/utils/cron/alerts');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// Mock next/server
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => {
      mockNextResponseJson(body, init);
      return { 
        status: init?.status ?? 200, 
        body,
        json: async () => body
      }; 
    }),
  },
}));

import { GET } from './route';
import { detectAndActivateCup } from '@/services/cup/cupActivationDetectionService';
import { logger } from '@/utils/logger';
import { startCronExecution, completeCronExecution } from '@/utils/cron/alerts';
import { revalidatePath } from 'next/cache';

const mockDetectAndActivateCup = detectAndActivateCup as jest.MockedFunction<typeof detectAndActivateCup>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockStartCronExecution = startCronExecution as jest.MockedFunction<typeof startCronExecution>;
const mockCompleteCronExecution = completeCronExecution as jest.MockedFunction<typeof completeCronExecution>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

describe('/api/cron/cup-activation', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default environment
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret-123'
    };
    
    // Default mock implementations
    mockStartCronExecution.mockReturnValue('test-execution-id');
    mockCompleteCronExecution.mockImplementation(() => {});
    mockRevalidatePath.mockImplementation(() => {});
    
    // Mock successful detection result by default
    mockDetectAndActivateCup.mockResolvedValue({
      shouldActivate: false,
      actionTaken: 'No activation needed - conditions not met',
      success: true,
      
      fixtureData: {
        teams: [
          { teamId: 1, teamName: 'Team A', remainingGames: 8 },
          { teamId: 2, teamName: 'Team B', remainingGames: 7 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      },
      
      activationCondition: {
        conditionMet: false,
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0,
        threshold: 60,
        reasoning: 'Only 0.0% of teams meet the condition (threshold: 60%)'
      },
      
      statusCheck: {
        isActivated: false,
        activatedAt: null,
        seasonId: 1,
        seasonName: '2024/25'
      },
      
      sessionId: 'test-session-123',
      timestamp: '2025-01-15T10:30:00Z',
      duration: 1500,
      seasonId: 1,
      seasonName: '2024/25',
      errors: [],
      reasoning: 'Conditions not met for cup activation',
      summary: 'Cup activation not needed - only 0% of teams have ≤5 games remaining'
    });
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('Authentication', () => {
    it('should reject requests without CRON_SECRET environment variable', async () => {
      delete process.env.CRON_SECRET;
      
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer some-secret' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Server configuration error');
      expect(mockLogger.error).toHaveBeenCalledWith('CRON_SECRET environment variable not configured');
      expect(mockCompleteCronExecution).toHaveBeenCalledWith('test-execution-id', 'failure', 'CRON_SECRET not configured');
    });
    
    it('should reject requests without authorization', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized cup activation cron access attempt',
        expect.objectContaining({
          authHeader: 'missing',
          cronSecretHeader: 'missing'
        })
      );
      expect(mockCompleteCronExecution).toHaveBeenCalledWith('test-execution-id', 'failure', 'Unauthorized access');
    });
    
    it('should reject requests with invalid authorization header', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer wrong-secret' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });
    
    it('should accept requests with valid authorization header', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });
    
    it('should accept requests with valid x-cron-secret header', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'x-cron-secret': 'test-secret-123' }
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Successful execution', () => {
    it('should handle successful detection with no activation needed', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Cup activation detection completed successfully');
      expect(data.data.shouldActivate).toBe(false);
      expect(data.data.actionTaken).toBe('No activation needed - conditions not met');
      expect(data.data.metrics.teams_total).toBe(2);
      expect(data.data.metrics.activation_percentage).toBe(0);
      expect(data.data.metrics.threshold_met).toBe(0);
      expect(data.data.metrics.cup_activated).toBe(0);
      
      expect(mockDetectAndActivateCup).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'CupActivationCronJob',
          operation: 'daily-activation-check',
          executionId: 'test-execution-id'
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cup activation detection completed successfully',
        expect.objectContaining({
          executionId: 'test-execution-id',
          shouldActivate: false,
          actionTaken: 'No activation needed - conditions not met'
        })
      );
      
      expect(mockCompleteCronExecution).toHaveBeenCalledWith(
        'test-execution-id',
        'success',
        undefined,
        expect.objectContaining({
          teams_total: 2,
          activation_percentage: 0,
          threshold_met: 0,
          cup_activated: 0
        })
      );
      
      // Cache should not be revalidated when no activation occurs
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
    
    it('should handle successful detection with cup activation', async () => {
      mockDetectAndActivateCup.mockResolvedValue({
        shouldActivate: true,
        actionTaken: 'Cup successfully activated for season 2024/25',
        success: true,
        
        fixtureData: {
          teams: [
            { teamId: 1, teamName: 'Team A', remainingGames: 3 },
            { teamId: 2, teamName: 'Team B', remainingGames: 4 },
            { teamId: 3, teamName: 'Team C', remainingGames: 8 }
          ],
          totalTeams: 3,
          teamsWithFiveOrFewerGames: 2,
          percentageWithFiveOrFewerGames: 66.7
        },
        
        activationCondition: {
          conditionMet: true,
          totalTeams: 3,
          teamsWithFiveOrFewerGames: 2,
          percentageWithFiveOrFewerGames: 66.7,
          threshold: 60,
          reasoning: '66.7% of teams meet the condition (threshold: 60%)'
        },
        
        statusCheck: {
          isActivated: false,
          activatedAt: null,
          seasonId: 1,
          seasonName: '2024/25'
        },
        
        activationResult: {
          success: true,
          wasAlreadyActivated: false,
          activatedAt: '2025-01-15T10:30:00Z',
          seasonId: 1,
          seasonName: '2024/25',
          error: null,
          attemptedAt: '2025-01-15T10:30:00Z'
        },
        
        sessionId: 'test-session-123',
        timestamp: '2025-01-15T10:30:00Z',
        duration: 2000,
        seasonId: 1,
        seasonName: '2024/25',
        errors: [],
        reasoning: 'Conditions met - cup activated successfully',
        summary: 'Cup activated for season 2024/25 - 66.7% of teams have ≤5 games remaining'
      });
      
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.shouldActivate).toBe(true);
      expect(data.data.actionTaken).toContain('successfully activated');
      expect(data.data.metrics.teams_total).toBe(3);
      expect(data.data.metrics.activation_percentage).toBe(66.7);
      expect(data.data.metrics.threshold_met).toBe(1);
      expect(data.data.metrics.cup_activated).toBe(1);
      
      // Cache should be revalidated when activation occurs
      expect(mockRevalidatePath).toHaveBeenCalledWith('/standings');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/api/standings');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cache revalidation triggered for standings after cup activation'
      );
    });
    
    it('should handle cache revalidation errors gracefully', async () => {
      mockDetectAndActivateCup.mockResolvedValue({
        shouldActivate: true,
        actionTaken: 'Cup successfully activated for season 2024/25',
        success: true,
        
        fixtureData: { teams: [], totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0 },
        activationCondition: { conditionMet: true, totalTeams: 0, teamsWithFiveOrFewerGames: 0, percentageWithFiveOrFewerGames: 0, threshold: 60, reasoning: '' },
        statusCheck: { isActivated: false, activatedAt: null, seasonId: 1, seasonName: '2024/25' },
        
        sessionId: 'test-session-123',
        timestamp: '2025-01-15T10:30:00Z',
        duration: 1500,
        seasonId: 1,
        seasonName: '2024/25',
        errors: [],
        reasoning: 'Test',
        summary: 'Test'
      });
      
      mockRevalidatePath.mockImplementation(() => {
        throw new Error('Cache revalidation failed');
      });
      
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during cache revalidation after cup activation',
        expect.objectContaining({
          error: 'Cache revalidation failed',
          executionId: 'test-execution-id'
        })
      );
    });
  });
  
  describe('Error handling', () => {
    it('should handle detection service failures', async () => {
      mockDetectAndActivateCup.mockResolvedValue({
        shouldActivate: false,
        actionTaken: 'Detection failed',
        success: false,
        error: 'Database connection failed',
        errors: ['Database connection failed', 'Retry attempts exhausted'],
        
        sessionId: 'test-session-123',
        timestamp: '2025-01-15T10:30:00Z',
        duration: 500,
        seasonId: null,
        seasonName: null,
        reasoning: 'Detection failed due to database error',
        summary: 'Cup activation detection could not be completed'
      });
      
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Cup activation detection failed');
      expect(data.error).toBe('Database connection failed');
      expect(data.details.errors).toEqual(['Database connection failed', 'Retry attempts exhausted']);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cup activation detection failed',
        expect.objectContaining({
          executionId: 'test-execution-id',
          error: 'Database connection failed',
          errors: ['Database connection failed', 'Retry attempts exhausted']
        })
      );
      
      expect(mockCompleteCronExecution).toHaveBeenCalledWith(
        'test-execution-id',
        'failure',
        'Database connection failed',
        expect.any(Object)
      );
    });
    
    it('should handle critical exceptions', async () => {
      const testError = new Error('Critical system failure');
      mockDetectAndActivateCup.mockRejectedValue(testError);
      
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Critical error in cup activation cron job');
      expect(data.error).toBe('Critical system failure');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical error in cup activation cron job',
        expect.objectContaining({
          executionId: 'test-execution-id',
          error: 'Critical system failure',
          stack: expect.stringContaining('Critical system failure')
        })
      );
      
      expect(mockCompleteCronExecution).toHaveBeenCalledWith(
        'test-execution-id',
        'failure',
        'Critical error: Critical system failure',
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });
  });
  
  describe('Performance and monitoring', () => {
    it('should track performance metrics', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.duration).toBeGreaterThanOrEqual(0);
      expect(data.executionId).toBe('test-execution-id');
      expect(data.timestamp).toBeDefined();
      expect(data.data.metrics).toEqual(
        expect.objectContaining({
          duration: expect.any(Number),
          teams_total: expect.any(Number),
          teams_with_five_or_fewer: expect.any(Number),
          activation_percentage: expect.any(Number),
          threshold_met: expect.any(Number),
          cup_activated: expect.any(Number),
          was_already_activated: expect.any(Number)
        })
      );
    });
    
    it('should start and complete cron execution tracking', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      await GET(request);
      
      expect(mockStartCronExecution).toHaveBeenCalledWith('cup-activation');
      expect(mockCompleteCronExecution).toHaveBeenCalledWith(
        'test-execution-id',
        'success',
        undefined,
        expect.any(Object)
      );
    });
    
    it('should log comprehensive execution details', async () => {
      const request = new Request('http://localhost:3000/api/cron/cup-activation', {
        headers: { 'authorization': 'Bearer test-secret-123' }
      });
      
      await GET(request);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting cup activation detection cron job',
        expect.objectContaining({
          executionId: 'test-execution-id',
          timestamp: expect.any(String),
          jobName: 'cup-activation'
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cup activation detection completed successfully',
        expect.objectContaining({
          executionId: 'test-execution-id',
          duration: expect.any(Number),
          shouldActivate: false,
          actionTaken: 'No activation needed - conditions not met',
          summary: expect.any(String),
          metrics: expect.any(Object)
        })
      );
    });
  });
}); 