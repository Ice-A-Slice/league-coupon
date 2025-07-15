/**
 * Cron Job Alerting and Notification System
 * 
 * This module provides alerting capabilities for cron job monitoring,
 * including failure detection, performance monitoring, and critical
 * event notifications.
 */

import { logger } from '@/utils/logger';

export interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
  consecutiveFailureThreshold: number;
  performanceThresholdMs: number;
  retryAttempts: number;
  cooldownPeriodMs: number;
}

export interface CronJobExecution {
  jobName: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failure' | 'timeout';
  duration?: number;
  error?: string;
  metrics?: Record<string, number>;
}

export interface AlertEvent {
  id: string;
  type: 'failure' | 'performance' | 'recovery' | 'health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  jobName: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

export interface CronJobHealthSummary {
  totalExecutions: number;
  recentExecutions: number;
  recentFailures: number;
  consecutiveFailures: number;
  successRate: number;
  averageDuration: number;
  lastExecution: string | null;
  status: 'healthy' | 'degraded' | 'failing';
}

/**
 * In-memory storage for execution history and alert state
 * In production, this should be replaced with persistent storage
 */
class AlertingService {
  private config: AlertConfig;
  private executionHistory: Map<string, CronJobExecution[]> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(config?: Partial<AlertConfig>) {
    this.config = {
      enabled: process.env.CRON_ALERTS_ENABLED === 'true',
      webhookUrl: process.env.CRON_WEBHOOK_URL,
      emailRecipients: process.env.CRON_ALERT_EMAILS?.split(',') || [],
      slackChannel: process.env.CRON_SLACK_CHANNEL,
      consecutiveFailureThreshold: parseInt(process.env.CRON_FAILURE_THRESHOLD || '3'),
      performanceThresholdMs: parseInt(process.env.CRON_PERFORMANCE_THRESHOLD_MS || '300000'), // 5 minutes
      retryAttempts: parseInt(process.env.CRON_ALERT_RETRIES || '3'),
      cooldownPeriodMs: parseInt(process.env.CRON_ALERT_COOLDOWN_MS || '3600000'), // 1 hour
      ...config
    };
  }

  /**
   * Record the start of a cron job execution
   */
  startExecution(jobName: string): string {
    const executionId = `${jobName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution: CronJobExecution = {
      jobName,
      executionId,
      startTime: new Date(),
      status: 'running'
    };

    if (!this.executionHistory.has(jobName)) {
      this.executionHistory.set(jobName, []);
    }

    const history = this.executionHistory.get(jobName)!;
    history.push(execution);

    // Keep only last 100 executions per job
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    logger.info('Cron execution started', {
      jobName,
      executionId,
      timestamp: execution.startTime.toISOString()
    });

    return executionId;
  }

  /**
   * Record the completion of a cron job execution
   */
  completeExecution(
    executionId: string, 
    status: 'success' | 'failure' | 'timeout',
    error?: string,
    metrics?: Record<string, number>
  ): void {
    const execution = this.findExecution(executionId);
    if (!execution) {
      logger.warn('Execution not found for completion', { executionId });
      return;
    }

    execution.endTime = new Date();
    execution.status = status;
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.error = error;
    execution.metrics = metrics;

    logger.info('Cron execution completed', {
      jobName: execution.jobName,
      executionId,
      status,
      duration: execution.duration,
      timestamp: execution.endTime.toISOString()
    });

    // Process alerts based on execution result
    this.processExecutionAlerts(execution);
  }

  /**
   * Get execution history for a specific job
   */
  getExecutionHistory(jobName: string, limit = 10): CronJobExecution[] {
    const history = this.executionHistory.get(jobName) || [];
    return history
      .slice(-limit)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get health summary for all monitored jobs
   */
  getHealthSummary(): Record<string, CronJobHealthSummary> {
    const summary: Record<string, CronJobHealthSummary> = {};

    for (const [jobName, history] of this.executionHistory.entries()) {
      const recent = history.slice(-10);
      const failures = recent.filter(e => e.status === 'failure').length;
      const executionsWithDuration = recent.filter(e => e.duration);
      const avgDuration = executionsWithDuration.length > 0
        ? executionsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / executionsWithDuration.length
        : 0;

      summary[jobName] = {
        totalExecutions: history.length,
        recentExecutions: recent.length,
        recentFailures: failures,
        consecutiveFailures: this.consecutiveFailures.get(jobName) || 0,
        successRate: recent.length > 0 ? ((recent.length - failures) / recent.length) * 100 : 0,
        averageDuration: Math.round(avgDuration) || 0,
        lastExecution: recent[recent.length - 1]?.startTime?.toISOString() || null,
        status: this.getJobStatus(jobName)
      };
    }

    return summary;
  }

  /**
   * Manually trigger an alert
   */
  async triggerAlert(event: Omit<AlertEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Alerting disabled, skipping alert', { event });
      return;
    }

    const alertEvent: AlertEvent = {
      ...event,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // Check cooldown period
    const lastAlert = this.lastAlertTime.get(event.jobName);
    if (lastAlert && (alertEvent.timestamp.getTime() - lastAlert.getTime()) < this.config.cooldownPeriodMs) {
      logger.debug('Alert in cooldown period, skipping', { 
        jobName: event.jobName,
        lastAlert: lastAlert.toISOString(),
        cooldownMs: this.config.cooldownPeriodMs
      });
      return;
    }

    logger.warn('Triggering cron job alert', {
      alertId: alertEvent.id,
      type: alertEvent.type,
      severity: alertEvent.severity,
      jobName: alertEvent.jobName,
      message: alertEvent.message
    });

    // Send notifications
    await this.sendNotifications(alertEvent);

    // Update last alert time
    this.lastAlertTime.set(event.jobName, alertEvent.timestamp);
  }

  /**
   * Process alerts based on execution results
   */
  private processExecutionAlerts(execution: CronJobExecution): void {
    const jobName = execution.jobName;

    if (execution.status === 'success') {
      // Reset consecutive failures on success
      const previousFailures = this.consecutiveFailures.get(jobName) || 0;
      this.consecutiveFailures.set(jobName, 0);

      // Send recovery alert if we had failures before
      if (previousFailures >= this.config.consecutiveFailureThreshold) {
        this.triggerAlert({
          type: 'recovery',
          severity: 'medium',
          jobName,
          message: `Cron job ${jobName} has recovered after ${previousFailures} consecutive failures`,
          details: {
            executionId: execution.executionId,
            duration: execution.duration,
            previousFailures
          }
        });
      }

      // Check for performance issues
      if (execution.duration && execution.duration > this.config.performanceThresholdMs) {
        this.triggerAlert({
          type: 'performance',
          severity: 'medium',
          jobName,
          message: `Cron job ${jobName} execution exceeded performance threshold`,
          details: {
            executionId: execution.executionId,
            duration: execution.duration,
            threshold: this.config.performanceThresholdMs
          }
        });
      }

    } else if (execution.status === 'failure' || execution.status === 'timeout') {
      // Increment consecutive failures
      const failures = (this.consecutiveFailures.get(jobName) || 0) + 1;
      this.consecutiveFailures.set(jobName, failures);

      // Send failure alert if threshold reached
      if (failures >= this.config.consecutiveFailureThreshold) {
        const severity = failures >= this.config.consecutiveFailureThreshold * 2 ? 'critical' : 'high';
        
        this.triggerAlert({
          type: 'failure',
          severity,
          jobName,
          message: `Cron job ${jobName} has failed ${failures} consecutive times`,
          details: {
            executionId: execution.executionId,
            error: execution.error,
            duration: execution.duration,
            consecutiveFailures: failures
          }
        });
      }
    }
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(event: AlertEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // Webhook notification
    if (this.config.webhookUrl) {
      promises.push(this.sendWebhookNotification(event));
    }

    // Email notification
    if (this.config.emailRecipients && this.config.emailRecipients.length > 0) {
      promises.push(this.sendEmailNotification(event));
    }

    // Slack notification
    if (this.config.slackChannel) {
      promises.push(this.sendSlackNotification(event));
    }

    // Execute all notifications
    await Promise.allSettled(promises);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(event: AlertEvent): Promise<void> {
    try {
      const response = await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: event,
          timestamp: event.timestamp.toISOString(),
          environment: process.env.NODE_ENV || 'development'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      logger.info('Webhook notification sent', { alertId: event.id });
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        alertId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(event: AlertEvent): Promise<void> {
    try {
      // This is a placeholder - implement with your email service
      logger.info('Email notification would be sent', {
        alertId: event.id,
        recipients: this.config.emailRecipients || [],
        subject: `[${event.severity.toUpperCase()}] Cron Job Alert: ${event.jobName}`
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        alertId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(event: AlertEvent): Promise<void> {
    try {
      // This is a placeholder - implement with Slack API
      logger.info('Slack notification would be sent', {
        alertId: event.id,
        channel: this.config.slackChannel,
        message: event.message
      });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        alertId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Find execution by ID
   */
  private findExecution(executionId: string): CronJobExecution | undefined {
    for (const history of this.executionHistory.values()) {
      const execution = history.find(e => e.executionId === executionId);
      if (execution) return execution;
    }
    return undefined;
  }

  /**
   * Get current job status
   */
  private getJobStatus(jobName: string): 'healthy' | 'degraded' | 'failing' {
    const failures = this.consecutiveFailures.get(jobName) || 0;
    if (failures >= this.config.consecutiveFailureThreshold) {
      return 'failing';
    } else if (failures > 0) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Reset all internal state - for testing purposes only
   */
  reset(): void {
    this.executionHistory.clear();
    this.lastAlertTime.clear();
    this.consecutiveFailures.clear();
    
    // Reload configuration from environment variables
    this.reloadConfig();
  }

  /**
   * Reload configuration from environment variables - for testing purposes
   */
  private reloadConfig(): void {
    this.config = {
      enabled: process.env.CRON_ALERTS_ENABLED === 'true',
      webhookUrl: process.env.CRON_WEBHOOK_URL,
      emailRecipients: process.env.CRON_ALERT_EMAILS?.split(',') || [],
      slackChannel: process.env.CRON_SLACK_CHANNEL,
      consecutiveFailureThreshold: parseInt(process.env.CRON_FAILURE_THRESHOLD || '3'),
      performanceThresholdMs: parseInt(process.env.CRON_PERFORMANCE_THRESHOLD_MS || '300000'), // 5 minutes
      retryAttempts: parseInt(process.env.CRON_ALERT_RETRIES || '3'),
      cooldownPeriodMs: parseInt(process.env.CRON_ALERT_COOLDOWN_MS || '3600000'), // 1 hour
    };
  }
}

// Export singleton instance
export const alertingService = new AlertingService();

// Helper functions for easy use in cron jobs
export function startCronExecution(jobName: string): string {
  return alertingService.startExecution(jobName);
}

export function completeCronExecution(
  executionId: string, 
  status: 'success' | 'failure' | 'timeout',
  error?: string,
  metrics?: Record<string, number>
): void {
  alertingService.completeExecution(executionId, status, error, metrics);
}

export function getCronHealthSummary(): Record<string, CronJobHealthSummary> {
  return alertingService.getHealthSummary();
}

export async function triggerCronAlert(event: Omit<AlertEvent, 'id' | 'timestamp'>): Promise<void> {
  return alertingService.triggerAlert(event);
}

/**
 * Reset alerting service state - for testing purposes only
 * @internal
 */
export function resetAlertingState(): void {
  alertingService.reset();
} 