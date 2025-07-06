// Mock logger first
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock fetch for webhook tests
global.fetch = jest.fn();

import {
  alertingService,
  startCronExecution,
  completeCronExecution,
  getCronHealthSummary,
  triggerCronAlert,
  resetAlertingState,
  AlertEvent
} from './alerts';

// Import the mocked logger for test assertions
import { logger } from '@/utils/logger';

// Type for mocking Date constructor in tests
type MockDateConstructor = jest.MockedFunction<DateConstructor> & {
  now: jest.MockedFunction<() => number>;
  parse: typeof Date.parse;
  UTC: typeof Date.UTC;
};

describe('Cron Alerting System', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
    
    // Clear logger mocks
    (logger.info as jest.MockedFunction<typeof logger.info>).mockClear();
    (logger.warn as jest.MockedFunction<typeof logger.warn>).mockClear();
    (logger.error as jest.MockedFunction<typeof logger.error>).mockClear();
    (logger.debug as jest.MockedFunction<typeof logger.debug>).mockClear();
    
    // Reset alerting state for clean tests
    resetAlertingState();
    
    // Clear environment variables that might affect tests
    delete process.env.CRON_ALERTS_ENABLED;
    delete process.env.CRON_FAILURE_THRESHOLD;
    delete process.env.CRON_PERFORMANCE_THRESHOLD_MS;
    delete process.env.CRON_ALERT_COOLDOWN_MS;
    delete process.env.CRON_WEBHOOK_URL;
  });

  describe('Execution Tracking', () => {
    it('should start and complete a successful execution', () => {
      const executionId = startCronExecution('test-job');
      
      expect(executionId).toBeDefined();
      expect(executionId).toContain('test-job');
      expect(logger.info).toHaveBeenCalledWith(
        'Cron execution started',
        expect.objectContaining({
          jobName: 'test-job',
          executionId
        })
      );

      completeCronExecution(executionId, 'success', undefined, {
        processedItems: 5,
        duration: 1000
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Cron execution completed',
        expect.objectContaining({
          jobName: 'test-job',
          executionId,
          status: 'success',
          duration: expect.any(Number)
        })
      );
    });

    it('should track failed execution', () => {
      const executionId = startCronExecution('test-job');
      
      completeCronExecution(executionId, 'failure', 'Database connection failed', {
        duration: 500
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Cron execution completed',
        expect.objectContaining({
          jobName: 'test-job',
          status: 'failure'
        })
      );
    });

    it('should track timeout execution', () => {
      const executionId = startCronExecution('long-running-job');
      
      completeCronExecution(executionId, 'timeout', 'Execution exceeded 5 minute limit');

      expect(logger.info).toHaveBeenCalledWith(
        'Cron execution completed',
        expect.objectContaining({
          status: 'timeout'
        })
      );
    });

    it('should handle completion of non-existent execution gracefully', () => {
      completeCronExecution('non-existent-id', 'success');

      expect(logger.warn).toHaveBeenCalledWith(
        'Execution not found for completion',
        { executionId: 'non-existent-id' }
      );
    });
  });

  describe('Health Summary', () => {
    it('should return empty summary for no executions', () => {
      const summary = getCronHealthSummary();
      expect(summary).toEqual({});
    });

    it('should calculate health metrics correctly', () => {
      // Execute multiple jobs with different outcomes
      const successId = startCronExecution('successful-job');
      completeCronExecution(successId, 'success', undefined, { duration: 1000 });
      
      const failId1 = startCronExecution('failing-job');
      completeCronExecution(failId1, 'failure', 'Error 1');
      
      const failId2 = startCronExecution('failing-job');
      completeCronExecution(failId2, 'failure', 'Error 2');

      const summary = getCronHealthSummary();

      expect(summary['successful-job']).toEqual(
        expect.objectContaining({
          totalExecutions: 1,
          recentExecutions: 1,
          recentFailures: 0,
          consecutiveFailures: 0,
          successRate: 100,
          status: 'healthy'
        })
      );

      expect(summary['failing-job']).toEqual(
        expect.objectContaining({
          totalExecutions: 2,
          recentExecutions: 2,
          recentFailures: 2,
          consecutiveFailures: 2,
          successRate: 0,
          status: 'degraded' // Should be degraded before reaching threshold
        })
      );
    });

    it('should calculate average duration correctly', () => {
      const jobName = 'duration-test-job';
      
      // Mock Date.now() and Date constructor to control timing
      const originalDateNow = Date.now;
      const originalDate = Date;
      let mockTime = 1000000; // Start at a fixed time
      
      Date.now = jest.fn(() => mockTime);
      
      // Create a proper Date mock that preserves static methods
      const MockDate = jest.fn((time?: number) => {
        const actualTime = time || mockTime;
        return {
          getTime: () => actualTime,
          toISOString: () => new originalDate(actualTime).toISOString()
        };
      }) as MockDateConstructor;
      
      // Copy static methods from original Date
      MockDate.now = jest.fn(() => mockTime);
      MockDate.parse = originalDate.parse;
      MockDate.UTC = originalDate.UTC;
      
      global.Date = MockDate;
      
      try {
        const id1 = startCronExecution(jobName);
        mockTime += 1000; // Simulate 1 second passing
        completeCronExecution(id1, 'success');
        
        const id2 = startCronExecution(jobName);
        mockTime += 2000; // Simulate 2 seconds passing
        completeCronExecution(id2, 'success');

        const summary = getCronHealthSummary();
        expect(summary[jobName].averageDuration).toBe(1500);
      } finally {
        // Restore original Date and Date.now
        Date.now = originalDateNow;
        global.Date = originalDate;
      }
    });
  });

  describe('Alert Generation', () => {
    beforeEach(() => {
      // Enable alerting for tests
      process.env.CRON_ALERTS_ENABLED = 'true';
      process.env.CRON_FAILURE_THRESHOLD = '2';
      process.env.CRON_PERFORMANCE_THRESHOLD_MS = '5000';
      resetAlertingState(); // Reload config with new environment variables
    });

    it('should trigger alert after consecutive failures reach threshold', async () => {
      const jobName = 'alert-test-job';
      
      // First failure - should not trigger alert
      const id1 = startCronExecution(jobName);
      completeCronExecution(id1, 'failure', 'First error');
      
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Triggering cron job alert')
      );

      // Second failure - should trigger alert
      const id2 = startCronExecution(jobName);
      completeCronExecution(id2, 'failure', 'Second error');

      expect(logger.warn).toHaveBeenCalledWith(
        'Triggering cron job alert',
        expect.objectContaining({
          type: 'failure',
          severity: 'high',
          jobName
        })
      );
    });

    it('should trigger recovery alert after failures are resolved', async () => {
      const jobName = 'recovery-test-job';
      
      // Generate failures to reach threshold
      const id1 = startCronExecution(jobName);
      completeCronExecution(id1, 'failure', 'Error 1');
      
      const id2 = startCronExecution(jobName);
      completeCronExecution(id2, 'failure', 'Error 2');

      // Clear mock to check for recovery alert
      jest.clearAllMocks();

      // Successful execution should trigger recovery alert
      const id3 = startCronExecution(jobName);
      completeCronExecution(id3, 'success');

      expect(logger.warn).toHaveBeenCalledWith(
        'Triggering cron job alert',
        expect.objectContaining({
          type: 'recovery',
          severity: 'medium',
          jobName
        })
      );
    });

    it('should trigger performance alert for slow executions', async () => {
      const jobName = 'slow-job';
      
      // Mock Date.now() and Date constructor to simulate slow execution
      const originalDateNow = Date.now;
      const originalDate = Date;
      let mockTime = 1000000;
      
      Date.now = jest.fn(() => mockTime);
      
      // Create a proper Date mock that preserves static methods
      const MockDate = jest.fn((time?: number) => {
        const actualTime = time || mockTime;
        return {
          getTime: () => actualTime,
          toISOString: () => new originalDate(actualTime).toISOString()
        };
      }) as MockDateConstructor;
      
      // Copy static methods from original Date
      MockDate.now = jest.fn(() => mockTime);
      MockDate.parse = originalDate.parse;
      MockDate.UTC = originalDate.UTC;
      
      global.Date = MockDate;
      
      try {
        const id = startCronExecution(jobName);
        // Simulate slow execution (6 seconds, threshold is 5)
        mockTime += 6000;
        completeCronExecution(id, 'success');

        expect(logger.warn).toHaveBeenCalledWith(
          'Triggering cron job alert',
          expect.objectContaining({
            type: 'performance',
            severity: 'medium',
            jobName
          })
        );
      } finally {
        Date.now = originalDateNow;
        global.Date = originalDate;
      }
    });

    it('should respect cooldown period for alerts', async () => {
      process.env.CRON_ALERT_COOLDOWN_MS = '1000'; // 1 second cooldown
      
      const alertEvent: Omit<AlertEvent, 'id' | 'timestamp'> = {
        type: 'failure',
        severity: 'high',
        jobName: 'cooldown-test',
        message: 'Test alert',
        details: {}
      };

      // First alert should go through
      await triggerCronAlert(alertEvent);
      expect(logger.warn).toHaveBeenCalledWith(
        'Triggering cron job alert',
        expect.objectContaining({ jobName: 'cooldown-test' })
      );

      jest.clearAllMocks();

      // Second alert immediately should be skipped due to cooldown
      await triggerCronAlert(alertEvent);
      expect(logger.debug).toHaveBeenCalledWith(
        'Alert in cooldown period, skipping',
        expect.objectContaining({ jobName: 'cooldown-test' })
      );
    });
  });

  describe('Webhook Notifications', () => {
    beforeEach(() => {
      process.env.CRON_ALERTS_ENABLED = 'true';
      process.env.CRON_WEBHOOK_URL = 'https://webhook.example.com/alerts';
      resetAlertingState(); // Reload config with new environment variables
    });

    it('should send webhook notification successfully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const alertEvent: Omit<AlertEvent, 'id' | 'timestamp'> = {
        type: 'failure',
        severity: 'critical',
        jobName: 'webhook-test',
        message: 'Critical failure',
        details: { error: 'Database unreachable' }
      };

      await triggerCronAlert(alertEvent);

      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/alerts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Critical failure')
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Webhook notification sent',
        expect.objectContaining({ alertId: expect.any(String) })
      );
    });

    it('should handle webhook notification failure gracefully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const alertEvent: Omit<AlertEvent, 'id' | 'timestamp'> = {
        type: 'failure',
        severity: 'high',
        jobName: 'webhook-fail-test',
        message: 'Test failure',
        details: {}
      };

      await triggerCronAlert(alertEvent);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send webhook notification',
        expect.objectContaining({
          error: 'Network error'
        })
      );
    });
  });

  describe('Configuration', () => {
    it('should disable alerting when CRON_ALERTS_ENABLED is false', async () => {
      process.env.CRON_ALERTS_ENABLED = 'false';
      resetAlertingState(); // Reload config with disabled alerting

      const alertEvent: Omit<AlertEvent, 'id' | 'timestamp'> = {
        type: 'failure',
        severity: 'high',
        jobName: 'disabled-test',
        message: 'Test alert',
        details: {}
      };

      await triggerCronAlert(alertEvent);

      expect(logger.debug).toHaveBeenCalledWith(
        'Alerting disabled, skipping alert',
        expect.objectContaining({ event: expect.any(Object) })
      );
    });

    it('should use custom configuration from environment variables', () => {
      process.env.CRON_ALERTS_ENABLED = 'true';
      process.env.CRON_FAILURE_THRESHOLD = '5';
      process.env.CRON_PERFORMANCE_THRESHOLD_MS = '30000';
      process.env.CRON_ALERT_COOLDOWN_MS = '7200000'; // 2 hours
      resetAlertingState(); // Reload config with new environment variables

      const jobName = 'config-test-job';
      
      // Generate 4 failures (below custom threshold of 5)
      for (let i = 0; i < 4; i++) {
        const id = startCronExecution(jobName);
        completeCronExecution(id, 'failure', `Error ${i + 1}`);
      }

      // Should not trigger alert yet
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Triggering cron job alert')
      );

      // 5th failure should trigger alert
      const id5 = startCronExecution(jobName);
      completeCronExecution(id5, 'failure', 'Error 5');

      expect(logger.warn).toHaveBeenCalledWith(
        'Triggering cron job alert',
        expect.objectContaining({
          type: 'failure',
          jobName
        })
      );
    });
  });

  describe('Job Status Determination', () => {
    it('should mark job as healthy with no failures', () => {
      const jobName = 'healthy-job';
      const id = startCronExecution(jobName);
      completeCronExecution(id, 'success');

      const summary = getCronHealthSummary();
      expect(summary[jobName].status).toBe('healthy');
    });

    it('should mark job as degraded with some failures', () => {
      const jobName = 'degraded-job';
      const id = startCronExecution(jobName);
      completeCronExecution(id, 'failure', 'Some error');

      const summary = getCronHealthSummary();
      expect(summary[jobName].status).toBe('degraded');
    });

    it('should mark job as failing when threshold is reached', () => {
      process.env.CRON_FAILURE_THRESHOLD = '2';
      resetAlertingState(); // Reload config with new environment variable
      
      const jobName = 'failing-job';
      
      // Generate failures to reach threshold
      const id1 = startCronExecution(jobName);
      completeCronExecution(id1, 'failure', 'Error 1');
      
      const id2 = startCronExecution(jobName);
      completeCronExecution(id2, 'failure', 'Error 2');

      const summary = getCronHealthSummary();
      expect(summary[jobName].status).toBe('failing');
    });
  });

  describe('History Management', () => {
    it('should limit execution history to 100 entries per job', () => {
      const jobName = 'history-test-job';
      
      // Generate 150 executions
      for (let i = 0; i < 150; i++) {
        const id = startCronExecution(jobName);
        completeCronExecution(id, 'success');
      }

      const summary = getCronHealthSummary();
      expect(summary[jobName].totalExecutions).toBe(100); // Should be capped at 100
    });

    it('should return recent executions in descending order', () => {
      const jobName = 'order-test-job';
      
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = startCronExecution(jobName);
        completeCronExecution(id, 'success');
        ids.push(id);
      }

      // Test via internal service method
      const history = alertingService.getExecutionHistory(jobName, 5);
      expect(history).toHaveLength(5);
      
      // Should be in descending order by start time
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].startTime.getTime()).toBeGreaterThanOrEqual(
          history[i].startTime.getTime()
        );
      }
    });
  });
}); 