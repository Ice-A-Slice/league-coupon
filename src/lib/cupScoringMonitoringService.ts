// src/lib/cupScoringMonitoringService.ts

import { logger } from '@/utils/logger';

/**
 * Cup scoring operation types
 */
export type CupScoringOperationType = 
  | 'single_round_calculation'
  | 'multiple_rounds_calculation' 
  | 'all_rounds_after_activation'
  | 'cup_standings_calculation'
  | 'late_submission_processing'
  | 'point_correction'
  | 'manual_override'
  | 'conflict_resolution';

/**
 * Cup scoring operation status
 */
export type CupScoringOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Cup scoring error categories
 */
export type CupScoringErrorCategory = 
  | 'database_error'
  | 'validation_error'
  | 'calculation_error'
  | 'storage_error'
  | 'authorization_error'
  | 'timeout_error'
  | 'conflict_error'
  | 'activation_error';

/**
 * Cup scoring operation details
 */
export interface CupScoringOperation {
  id: string;
  type: CupScoringOperationType;
  status: CupScoringOperationStatus;
  seasonId: number | null;
  bettingRoundId: number | null;
  usersProcessed: number;
  roundsProcessed: number;
  totalPointsAwarded: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  initiatedBy: string | null;
  errors: CupScoringError[];
  metadata?: Record<string, unknown>;
}

/**
 * Cup scoring error information
 */
export interface CupScoringError {
  id: string;
  category: CupScoringErrorCategory;
  message: string;
  timestamp: number;
  userId?: string;
  bettingRoundId?: number;
  fixtureId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

/**
 * Performance metrics for cup scoring operations
 */
export interface CupScoringPerformanceMetrics {
  operationId: string;
  totalDuration: number;
  usersPerSecond: number;
  averagePointsPerUser: number;
  averageTimePerUser: number;
  averageTimePerRound: number;
  successRate: number;
  pointsAwardedPerSecond: number;
}

/**
 * System health status for cup scoring
 */
export interface CupScoringSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  current_operations: number;
  recent_errors: number;
  success_rate_24h: number;
  avg_response_time: number;
  total_points_awarded_24h: number;
  total_users_processed_24h: number;
  recommendations: string[];
}

/**
 * Performance insights for different time periods
 */
export interface CupScoringPerformanceInsights {
  timeframe: string;
  total_operations: number;
  total_users_processed: number;
  total_points_awarded: number;
  total_errors: number;
  success_rate: number;
  avg_users_per_operation: number;
  avg_duration_per_operation: number;
  avg_points_per_operation: number;
  most_common_errors: Array<{ category: CupScoringErrorCategory; count: number }>;
  peak_performance_hour?: number;
  slowest_operations: Array<{ id: string; duration: number; type: CupScoringOperationType }>;
}

/**
 * Cup Scoring Monitoring Service for tracking operations and performance
 */
export class CupScoringMonitoringService {
  private operations = new Map<string, CupScoringOperation>();
  private readonly maxOperationsHistory = 1000; // Keep last 1000 operations
  private readonly maxErrorsPerOperation = 50; // Limit errors per operation

  /**
   * Start monitoring a new cup scoring operation
   */
  startOperation(
    type: CupScoringOperationType,
    seasonId: number | null,
    bettingRoundId: number | null,
    initiatedBy: string | null = null,
    metadata?: Record<string, unknown>
  ): string {
    const operationId = this.generateOperationId();
    
    const operation: CupScoringOperation = {
      id: operationId,
      type,
      status: 'pending',
      seasonId,
      bettingRoundId,
      usersProcessed: 0,
      roundsProcessed: 0,
      totalPointsAwarded: 0,
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
      seasonId,
      bettingRoundId,
      initiatedBy,
      metadata
    }, 'Cup scoring operation monitoring started');

    return operationId;
  }

  /**
   * Update operation status
   */
  updateOperationStatus(operationId: string, status: CupScoringOperationStatus): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to update status for non-existent operation');
      return;
    }

    const previousStatus = operation.status;
    operation.status = status;

    if (status === 'in_progress' && previousStatus === 'pending') {
      logger.info({ operationId, type: operation.type }, 'Cup scoring operation started');
    }

    logger.debug({ operationId, previousStatus, newStatus: status }, 'Cup scoring operation status updated');
  }

  /**
   * Update operation progress
   */
  updateOperationProgress(
    operationId: string,
    usersProcessed: number,
    roundsProcessed: number,
    totalPointsAwarded: number
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to update progress for non-existent operation');
      return;
    }

    operation.usersProcessed = usersProcessed;
    operation.roundsProcessed = roundsProcessed;
    operation.totalPointsAwarded = totalPointsAwarded;

    logger.debug({
      operationId,
      usersProcessed,
      roundsProcessed,
      totalPointsAwarded
    }, 'Cup scoring operation progress updated');
  }

  /**
   * Complete an operation
   */
  completeOperation(
    operationId: string,
    status: 'completed' | 'failed' | 'cancelled' = 'completed',
    finalCounts?: {
      usersProcessed?: number;
      roundsProcessed?: number;
      totalPointsAwarded?: number;
    }
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to complete non-existent operation');
      return;
    }

    operation.status = status;
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;

    // Update final counts if provided
    if (finalCounts) {
      if (finalCounts.usersProcessed !== undefined) operation.usersProcessed = finalCounts.usersProcessed;
      if (finalCounts.roundsProcessed !== undefined) operation.roundsProcessed = finalCounts.roundsProcessed;
      if (finalCounts.totalPointsAwarded !== undefined) operation.totalPointsAwarded = finalCounts.totalPointsAwarded;
    }

    const logData = {
      operationId,
      type: operation.type,
      status,
      duration: operation.duration,
      usersProcessed: operation.usersProcessed,
      roundsProcessed: operation.roundsProcessed,
      totalPointsAwarded: operation.totalPointsAwarded,
      errorCount: operation.errors.length,
      seasonId: operation.seasonId,
      bettingRoundId: operation.bettingRoundId
    };

    if (status === 'completed') {
      logger.info(logData, 'Cup scoring operation completed successfully');
    } else {
      logger.error(logData, `Cup scoring operation ${status}`);
    }
  }

  /**
   * Add an error to an operation
   */
  addError(
    operationId: string,
    category: CupScoringErrorCategory,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: {
      userId?: string;
      bettingRoundId?: number;
      fixtureId?: number;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn({ operationId }, 'Attempted to add error to non-existent operation');
      return;
    }

    // Limit the number of errors per operation
    if (operation.errors.length >= this.maxErrorsPerOperation) {
      logger.warn({ operationId }, 'Maximum errors per operation reached, discarding oldest errors');
      operation.errors.shift(); // Remove oldest error
    }

    const error: CupScoringError = {
      id: this.generateErrorId(),
      category,
      message,
      timestamp: Date.now(),
      severity,
      userId: context?.userId,
      bettingRoundId: context?.bettingRoundId,
      fixtureId: context?.fixtureId,
      context: context?.metadata
    };

    operation.errors.push(error);

    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    logger[logLevel]({
      operationId,
      errorId: error.id,
      category,
      severity,
      message,
      userId: context?.userId,
      bettingRoundId: context?.bettingRoundId,
      fixtureId: context?.fixtureId,
      context: context?.metadata
    }, 'Cup scoring operation error recorded');
  }

  /**
   * Get operation details
   */
  getOperation(operationId: string): CupScoringOperation | null {
    return this.operations.get(operationId) || null;
  }

  /**
   * Get all operations
   */
  getAllOperations(): CupScoringOperation[] {
    return Array.from(this.operations.values()).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: CupScoringOperationStatus): CupScoringOperation[] {
    return this.getAllOperations().filter(op => op.status === status);
  }

  /**
   * Get performance metrics for a specific operation
   */
  getOperationMetrics(operationId: string): CupScoringPerformanceMetrics | null {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.endTime) {
      return null;
    }

    const totalDuration = operation.duration!;
    const totalUsers = operation.usersProcessed;
    const usersPerSecond = totalUsers > 0 ? totalUsers / (totalDuration / 1000) : 0;
    const averagePointsPerUser = totalUsers > 0 ? operation.totalPointsAwarded / totalUsers : 0;
    const averageTimePerUser = totalUsers > 0 ? totalDuration / totalUsers : 0;
    const averageTimePerRound = operation.roundsProcessed > 0 ? totalDuration / operation.roundsProcessed : 0;
    const successRate = operation.errors.length === 0 ? 100 : 
      Math.max(0, 100 - (operation.errors.filter(e => e.severity === 'high' || e.severity === 'critical').length * 10));
    const pointsAwardedPerSecond = operation.totalPointsAwarded > 0 ? operation.totalPointsAwarded / (totalDuration / 1000) : 0;

    return {
      operationId,
      totalDuration,
      usersPerSecond,
      averagePointsPerUser,
      averageTimePerUser,
      averageTimePerRound,
      successRate,
      pointsAwardedPerSecond
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): CupScoringSystemHealth {
    const allOperations = this.getAllOperations();
    const currentOperations = allOperations.filter(op => 
      op.status === 'pending' || op.status === 'in_progress'
    ).length;

    // Get operations from last 24 hours
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recent24hOps = allOperations.filter(op => op.startTime >= last24Hours);
    
    const recentErrors = recent24hOps.reduce((sum, op) => sum + op.errors.length, 0);
    const totalRecentOps = recent24hOps.length;
    const successfulRecentOps = recent24hOps.filter(op => op.status === 'completed' && op.errors.length === 0).length;
    
    const successRate24h = totalRecentOps > 0 
      ? (successfulRecentOps / totalRecentOps) * 100 
      : 100;

    const completedRecent = recent24hOps.filter(op => op.endTime);
    const avgResponseTime = completedRecent.length > 0
      ? completedRecent.reduce((sum, op) => sum + (op.duration || 0), 0) / completedRecent.length
      : 0;

    const totalPointsAwarded24h = recent24hOps.reduce((sum, op) => sum + op.totalPointsAwarded, 0);
    const totalUsersProcessed24h = recent24hOps.reduce((sum, op) => sum + op.usersProcessed, 0);

    // Determine system status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    if (successRate24h < 95) {
      status = 'degraded';
      recommendations.push('Success rate below 95% - investigate cup scoring issues');
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

    return {
      status,
      current_operations: currentOperations,
      recent_errors: recentErrors,
      success_rate_24h: Math.round(successRate24h * 100) / 100,
      avg_response_time: Math.round(avgResponseTime),
      total_points_awarded_24h: totalPointsAwarded24h,
      total_users_processed_24h: totalUsersProcessed24h,
      recommendations
    };
  }

  /**
   * Get performance insights for a specific timeframe
   */
  async getPerformanceInsights(timeframe: '1h' | '24h' | '7d' | '30d'): Promise<CupScoringPerformanceInsights> {
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
    const totalUsersProcessed = relevantOps.reduce((sum, op) => sum + op.usersProcessed, 0);
    const totalPointsAwarded = relevantOps.reduce((sum, op) => sum + op.totalPointsAwarded, 0);
    const totalErrors = relevantOps.reduce((sum, op) => sum + op.errors.length, 0);
    
    const successfulOps = relevantOps.filter(op => op.status === 'completed' && op.errors.length === 0).length;
    const successRate = totalOperations > 0 ? (successfulOps / totalOperations) * 100 : 0;
    const avgUsersPerOperation = totalOperations > 0 ? totalUsersProcessed / totalOperations : 0;
    const avgPointsPerOperation = totalOperations > 0 ? totalPointsAwarded / totalOperations : 0;
    
    const completedOps = relevantOps.filter(op => op.duration);
    const avgDurationPerOperation = completedOps.length > 0
      ? completedOps.reduce((sum, op) => sum + (op.duration || 0), 0) / completedOps.length
      : 0;

    // Count errors by category
    const errorCounts = new Map<CupScoringErrorCategory, number>();
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
      total_users_processed: totalUsersProcessed,
      total_points_awarded: totalPointsAwarded,
      total_errors: totalErrors,
      success_rate: Math.round(successRate * 100) / 100,
      avg_users_per_operation: Math.round(avgUsersPerOperation * 100) / 100,
      avg_duration_per_operation: Math.round(avgDurationPerOperation),
      avg_points_per_operation: Math.round(avgPointsPerOperation * 100) / 100,
      most_common_errors: mostCommonErrors,
      slowest_operations: slowestOperations
    };
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `cup_${timestamp}_${random}`;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Clean up old operations to prevent memory leaks
   */
  private cleanupOldOperations(): void {
    const operations = this.getAllOperations();
    if (operations.length > this.maxOperationsHistory) {
      const toRemove = operations.slice(this.maxOperationsHistory);
      toRemove.forEach(op => this.operations.delete(op.id));
      
      logger.debug({ 
        removed: toRemove.length, 
        remaining: this.operations.size 
      }, 'Cleaned up old cup scoring operations');
    }
  }
}

// Export singleton instance
export const cupScoringMonitoringService = new CupScoringMonitoringService(); 