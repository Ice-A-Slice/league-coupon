import { logger } from '@/utils/logger';

/**
 * Email operation types for monitoring
 */
export type EmailOperationType = 'summary' | 'reminder' | 'notification';

/**
 * Email operation status
 */
export type EmailOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Email error categories for better monitoring
 */
export type EmailErrorCategory = 
  | 'validation' 
  | 'template' 
  | 'sending' 
  | 'rate_limit' 
  | 'authentication' 
  | 'network' 
  | 'unknown';

/**
 * Individual email operation being monitored
 */
export interface EmailOperation {
  id: string;
  type: EmailOperationType;
  status: EmailOperationStatus;
  roundId: number | null;
  totalEmails: number;
  emailsSent: number;
  emailsFailed: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  initiatedBy: string | null;
  errors: EmailOperationError[];
  metadata?: Record<string, unknown>;
}

/**
 * Email operation error details
 */
export interface EmailOperationError {
  timestamp: number;
  category: EmailErrorCategory;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Performance metrics for email operations
 */
export interface EmailPerformanceMetrics {
  operationId: string;
  totalDuration: number;
  emailsPerSecond: number;
  templateGenerationTime: number;
  averageEmailSendTime: number;
  successRate: number;
}

/**
 * System health status
 */
export interface EmailSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  current_operations: number;
  recent_errors: number;
  success_rate_24h: number;
  avg_response_time: number;
  recommendations: string[];
}

/**
 * Performance insights for different time periods
 */
export interface EmailPerformanceInsights {
  timeframe: string;
  total_operations: number;
  total_emails_sent: number;
  total_errors: number;
  success_rate: number;
  avg_emails_per_operation: number;
  avg_duration_per_operation: number;
  most_common_errors: Array<{ category: EmailErrorCategory; count: number }>;
  peak_performance_hour?: number;
  slowest_operations: Array<{ id: string; duration: number; type: EmailOperationType }>;
}

/**
 * Email monitoring service for tracking operations and performance
 */
export class EmailMonitoringService {
  private operations = new Map<string, EmailOperation>();
  private readonly maxOperationsHistory = 1000; // Keep last 1000 operations
  private readonly maxErrorsPerOperation = 50; // Limit errors per operation

  /**
   * Start monitoring a new email operation
   */
  startOperation(
    type: EmailOperationType,
    roundId: number | null,
    totalEmails: number,
    initiatedBy: string | null = null,
    metadata?: Record<string, unknown>
  ): string {
    const operationId = this.generateOperationId();
    
    const operation: EmailOperation = {
      id: operationId,
      type,
      status: 'pending',
      roundId,
      totalEmails,
      emailsSent: 0,
      emailsFailed: 0,
      startTime: Date.now(),
      initiatedBy,
      errors: [],
      metadata
    };

    this.operations.set(operationId, operation);
    
    // Clean up old operations if we exceed the limit
    this.cleanupOldOperations();

    logger.info({
      operationId,
      type,
      roundId,
      totalEmails,
      initiatedBy
    }, 'Email operation monitoring started');

    return operationId;
  }

  /**
   * Update operation status
   */
  updateOperationStatus(operationId: string, status: EmailOperationStatus): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to update status for unknown operation');
      return;
    }

    operation.status = status;
    
    if (status === 'in_progress' && operation.status === 'pending') {
      operation.startTime = Date.now(); // Reset start time when actually starting
    }

    logger.debug({ operationId, status }, 'Email operation status updated');
  }

  /**
   * Record an error for an operation
   */
  recordError(
    operationId: string,
    category: EmailErrorCategory,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to record error for unknown operation');
      return;
    }

    // Limit errors per operation to prevent memory issues
    if (operation.errors.length >= this.maxErrorsPerOperation) {
      operation.errors.shift(); // Remove oldest error
    }

    const error: EmailOperationError = {
      timestamp: Date.now(),
      category,
      message,
      context
    };

    operation.errors.push(error);

    logger.warn({
      operationId,
      category,
      message,
      context
    }, 'Email operation error recorded');
  }

  /**
   * Update email send progress
   */
  updateProgress(operationId: string, emailsSent: number, emailsFailed: number): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to update progress for unknown operation');
      return;
    }

    operation.emailsSent = emailsSent;
    operation.emailsFailed = emailsFailed;

    logger.debug({
      operationId,
      emailsSent,
      emailsFailed,
      totalEmails: operation.totalEmails
    }, 'Email operation progress updated');
  }

  /**
   * Complete an email operation
   */
  completeOperation(operationId: string, result: { 
    success: boolean; 
    totalSent: number; 
    totalFailed: number;
    errors?: string[];
  }): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to complete unknown operation');
      return;
    }

    operation.status = result.success ? 'completed' : 'failed';
    operation.emailsSent = result.totalSent;
    operation.emailsFailed = result.totalFailed;
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;

    // Record any additional errors from the result
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(errorMessage => {
        this.recordError(operationId, 'unknown', errorMessage);
      });
    }

    logger.info({
      operationId,
      status: operation.status,
      duration: operation.duration,
      emailsSent: operation.emailsSent,
      emailsFailed: operation.emailsFailed,
      errorCount: operation.errors.length
    }, 'Email operation completed');
  }

  /**
   * Get operation details
   */
  getOperation(operationId: string): EmailOperation | null {
    return this.operations.get(operationId) || null;
  }

  /**
   * Get all current operations
   */
  getAllOperations(): EmailOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get performance metrics for a specific operation
   */
  getOperationMetrics(operationId: string): EmailPerformanceMetrics | null {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.endTime) {
      return null;
    }

    const totalDuration = operation.duration!;
    const totalEmails = operation.emailsSent + operation.emailsFailed;
    const emailsPerSecond = totalEmails > 0 ? totalEmails / (totalDuration / 1000) : 0;
    const successRate = totalEmails > 0 ? (operation.emailsSent / totalEmails) * 100 : 0;

    return {
      operationId,
      totalDuration,
      emailsPerSecond,
      templateGenerationTime: 0, // TODO: Implement template timing
      averageEmailSendTime: totalEmails > 0 ? totalDuration / totalEmails : 0,
      successRate
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): EmailSystemHealth {
    const allOperations = this.getAllOperations();
    const currentOperations = allOperations.filter(op => 
      op.status === 'pending' || op.status === 'in_progress'
    ).length;

    // Get operations from last 24 hours
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recent24hOps = allOperations.filter(op => op.startTime >= last24Hours);
    
    const recentErrors = recent24hOps.reduce((sum, op) => sum + op.errors.length, 0);
    const totalRecentEmails = recent24hOps.reduce((sum, op) => sum + op.emailsSent + op.emailsFailed, 0);
    const successfulRecentEmails = recent24hOps.reduce((sum, op) => sum + op.emailsSent, 0);
    
    const successRate24h = totalRecentEmails > 0 
      ? (successfulRecentEmails / totalRecentEmails) * 100 
      : 100;

    const completedRecent = recent24hOps.filter(op => op.endTime);
    const avgResponseTime = completedRecent.length > 0
      ? completedRecent.reduce((sum, op) => sum + (op.duration || 0), 0) / completedRecent.length
      : 0;

    // Determine system status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    if (successRate24h < 95) {
      status = 'degraded';
      recommendations.push('Success rate below 95% - investigate email delivery issues');
    }
    
    if (successRate24h < 85) {
      status = 'unhealthy';
      recommendations.push('Critical: Success rate below 85% - immediate attention required');
    }

    if (currentOperations > 5) {
      status = status === 'healthy' ? 'degraded' : status;
      recommendations.push(`${currentOperations} operations currently running - monitor for bottlenecks`);
    }

    if (recentErrors > 50) {
      status = 'degraded';
      recommendations.push('High error count in last 24h - review error logs');
    }

    if (avgResponseTime > 30000) { // 30 seconds
      status = status === 'healthy' ? 'degraded' : status;
      recommendations.push('Average response time above 30s - optimize email processing');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating normally');
    }

    return {
      status,
      current_operations: currentOperations,
      recent_errors: recentErrors,
      success_rate_24h: Math.round(successRate24h * 100) / 100,
      avg_response_time: Math.round(avgResponseTime),
      recommendations
    };
  }

  /**
   * Get performance insights for a specific timeframe
   */
  async getPerformanceInsights(timeframe: '1h' | '24h' | '7d' | '30d'): Promise<EmailPerformanceInsights> {
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const timeframeDuration = timeframes[timeframe];
    const cutoffTime = Date.now() - timeframeDuration;
    
    const relevantOps = this.getAllOperations().filter(op => op.startTime >= cutoffTime);
    
    const totalOperations = relevantOps.length;
    const totalEmailsSent = relevantOps.reduce((sum, op) => sum + op.emailsSent, 0);
    const totalErrors = relevantOps.reduce((sum, op) => sum + op.errors.length, 0);
    const totalEmails = relevantOps.reduce((sum, op) => sum + op.emailsSent + op.emailsFailed, 0);
    
    const successRate = totalEmails > 0 ? (totalEmailsSent / totalEmails) * 100 : 0;
    const avgEmailsPerOperation = totalOperations > 0 ? totalEmails / totalOperations : 0;
    
    const completedOps = relevantOps.filter(op => op.duration);
    const avgDurationPerOperation = completedOps.length > 0
      ? completedOps.reduce((sum, op) => sum + (op.duration || 0), 0) / completedOps.length
      : 0;

    // Count errors by category
    const errorCounts = new Map<EmailErrorCategory, number>();
    relevantOps.forEach(op => {
      op.errors.forEach(error => {
        errorCounts.set(error.category, (errorCounts.get(error.category) || 0) + 1);
      });
    });

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Find slowest operations
    const slowestOperations = completedOps
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5)
      .map(op => ({
        id: op.id,
        duration: op.duration || 0,
        type: op.type
      }));

    return {
      timeframe,
      total_operations: totalOperations,
      total_emails_sent: totalEmailsSent,
      total_errors: totalErrors,
      success_rate: Math.round(successRate * 100) / 100,
      avg_emails_per_operation: Math.round(avgEmailsPerOperation * 100) / 100,
      avg_duration_per_operation: Math.round(avgDurationPerOperation),
      most_common_errors: mostCommonErrors,
      slowest_operations: slowestOperations
    };
  }

  /**
   * Clean up old operations to prevent memory leaks
   */
  private cleanupOldOperations(): void {
    const operations = Array.from(this.operations.entries());
    if (operations.length <= this.maxOperationsHistory) {
      return;
    }

    // Sort by start time and remove oldest
    operations.sort((a, b) => a[1].startTime - b[1].startTime);
    const toRemove = operations.slice(0, operations.length - this.maxOperationsHistory);
    
    toRemove.forEach(([id]) => {
      this.operations.delete(id);
    });

    logger.debug({ 
      removed: toRemove.length, 
      remaining: this.operations.size 
    }, 'Cleaned up old email operations');
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `email_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const emailMonitoringService = new EmailMonitoringService(); 