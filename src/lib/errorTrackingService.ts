import { logger } from '@/utils/logger';
import { randomUUID } from 'crypto';

/**
 * Error severity levels for classification and alerting
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for better organization and handling
 */
export type ErrorCategory = 
  | 'email_delivery'
  | 'email_template'
  | 'data_fetch'
  | 'api_request'
  | 'database'
  | 'authentication'
  | 'validation'
  | 'external_service'
  | 'system'
  | 'unknown';

/**
 * Structured error information for tracking and analysis
 */
export interface TrackedError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context: {
    operationId?: string;
    userId?: string;
    roundId?: number;
    emailType?: string;
    endpoint?: string;
    userAgent?: string;
    ip?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  };
  tags: string[];
  fingerprint: string; // For error grouping/deduplication
  resolved: boolean;
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
}

/**
 * Error alert configuration
 */
export interface ErrorAlert {
  severity: ErrorSeverity;
  category?: ErrorCategory;
  threshold: number; // Number of occurrences before alerting
  timeWindow: number; // Time window in minutes
  enabled: boolean;
  channels: ('log' | 'email' | 'webhook')[];
  lastTriggered?: string;
}

/**
 * Error tracking service for comprehensive error handling and alerting
 */
class ErrorTrackingService {
  private errors: Map<string, TrackedError> = new Map();
  private alerts: ErrorAlert[] = [];
  private readonly MAX_STORED_ERRORS = 1000;
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.initializeDefaultAlerts();
    this.startCleanupTimer();
  }

  /**
   * Initialize default alert configurations
   */
  private initializeDefaultAlerts(): void {
    this.alerts = [
      {
        severity: 'critical',
        threshold: 1,
        timeWindow: 5,
        enabled: true,
        channels: ['log', 'email']
      },
      {
        severity: 'high',
        threshold: 3,
        timeWindow: 15,
        enabled: true,
        channels: ['log']
      },
      {
        severity: 'medium',
        category: 'email_delivery',
        threshold: 5,
        timeWindow: 30,
        enabled: true,
        channels: ['log']
      },
      {
        severity: 'low',
        threshold: 10,
        timeWindow: 60,
        enabled: false,
        channels: ['log']
      }
    ];
  }

  /**
   * Track an error with structured information
   */
  trackError(
    error: Error | string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context: TrackedError['context'] = {},
    tags: string[] = []
  ): string {
    const errorId = randomUUID();
    const timestamp = new Date().toISOString();
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    
    // Create fingerprint for error grouping
    const fingerprint = this.createFingerprint(message, category, context);
    
    // Check if we've seen this error before
    const existingError = Array.from(this.errors.values())
      .find(e => e.fingerprint === fingerprint);

    if (existingError) {
      // Update existing error
      existingError.occurrenceCount++;
      existingError.lastSeen = timestamp;
      existingError.context = { ...existingError.context, ...context };
      
      logger.warn('Error reoccurred', {
        errorId: existingError.id,
        fingerprint,
        occurrenceCount: existingError.occurrenceCount,
        severity,
        category,
        message,
        context
      });
      
      this.checkAlerts(existingError);
      return existingError.id;
    }

    // Create new tracked error
    const trackedError: TrackedError = {
      id: errorId,
      timestamp,
      severity,
      category,
      message,
      stack,
      context,
      tags,
      fingerprint,
      resolved: false,
      occurrenceCount: 1,
      firstSeen: timestamp,
      lastSeen: timestamp
    };

    this.errors.set(errorId, trackedError);
    
    // Log the error with structured data
    const logLevel = this.getLogLevel(severity);
    logger[logLevel]('Error tracked', {
      errorId,
      fingerprint,
      severity,
      category,
      message,
      context,
      tags,
      stack
    });

    // Check if alerts should be triggered
    this.checkAlerts(trackedError);

    // Cleanup old errors if we're at capacity
    this.cleanupOldErrors();

    return errorId;
  }

  /**
   * Track email-specific errors with enhanced context
   */
  trackEmailError(
    error: Error | string,
    severity: ErrorSeverity,
    emailContext: {
      operationId?: string;
      emailType?: 'summary' | 'reminder' | 'transparency';
      roundId?: number;
      userId?: string;
      recipientEmail?: string;
      stage?: 'validation' | 'data_fetch' | 'template_render' | 'email_send';
    },
    tags: string[] = []
  ): string {
    const category: ErrorCategory = this.determineEmailErrorCategory(emailContext.stage);
    
    return this.trackError(error, severity, category, emailContext, [
      'email',
      emailContext.emailType || 'unknown',
      emailContext.stage || 'unknown',
      ...tags
    ]);
  }

  /**
   * Get errors by various filters
   */
  getErrors(filters: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    resolved?: boolean;
    since?: string;
    limit?: number;
  } = {}): TrackedError[] {
    let errors = Array.from(this.errors.values());

    if (filters.severity) {
      errors = errors.filter(e => e.severity === filters.severity);
    }

    if (filters.category) {
      errors = errors.filter(e => e.category === filters.category);
    }

    if (filters.resolved !== undefined) {
      errors = errors.filter(e => e.resolved === filters.resolved);
    }

    if (filters.since) {
      const sinceDate = new Date(filters.since);
      errors = errors.filter(e => new Date(e.timestamp) >= sinceDate);
    }

    // Sort by timestamp (newest first)
    errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters.limit) {
      errors = errors.slice(0, filters.limit);
    }

    return errors;
  }

  /**
   * Mark an error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      logger.info('Error marked as resolved', { errorId, fingerprint: error.fingerprint });
      return true;
    }
    return false;
  }

  /**
   * Get error statistics for monitoring dashboard
   */
  getErrorStats(timeWindow: number = 24): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    resolved: number;
    unresolved: number;
    topErrors: { fingerprint: string; count: number; message: string }[];
  } {
    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000).toISOString();
    const recentErrors = this.getErrors({ since });

    const stats = {
      total: recentErrors.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      resolved: 0,
      unresolved: 0,
      topErrors: [] as { fingerprint: string; count: number; message: string }[]
    };

    const fingerprintCounts = new Map<string, { count: number; message: string }>();

    for (const error of recentErrors) {
      stats.bySeverity[error.severity]++;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      if (error.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }

      // Track fingerprint counts for top errors
      const existing = fingerprintCounts.get(error.fingerprint);
      if (existing) {
        existing.count += error.occurrenceCount;
      } else {
        fingerprintCounts.set(error.fingerprint, {
          count: error.occurrenceCount,
          message: error.message
        });
      }
    }

    // Get top 10 most frequent errors
    stats.topErrors = Array.from(fingerprintCounts.entries())
      .map(([fingerprint, data]) => ({ fingerprint, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Create a fingerprint for error grouping
   */
  private createFingerprint(
    message: string, 
    category: ErrorCategory, 
    context: TrackedError['context']
  ): string {
    // Normalize message by removing dynamic parts
    const normalizedMessage = message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9-]{36}/g, 'UUID') // Replace UUIDs
      .replace(/\b\w+@\w+\.\w+/g, 'EMAIL') // Replace emails
      .toLowerCase();

    const fingerprintData = {
      message: normalizedMessage,
      category,
      endpoint: context.endpoint,
      emailType: context.emailType
    };

    return Buffer.from(JSON.stringify(fingerprintData)).toString('base64');
  }

  /**
   * Check if any alerts should be triggered
   */
  private checkAlerts(error: TrackedError): void {
    const now = new Date();
    
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;
      
      // Check if alert matches error criteria
      if (alert.severity !== error.severity) continue;
      if (alert.category && alert.category !== error.category) continue;
      
      // Check if we're within the time window since last trigger
      if (alert.lastTriggered) {
        const lastTrigger = new Date(alert.lastTriggered);
        const timeSinceLastTrigger = now.getTime() - lastTrigger.getTime();
        const windowMs = alert.timeWindow * 60 * 1000;
        
        if (timeSinceLastTrigger < windowMs) continue;
      }
      
      // Check if threshold is met
      if (error.occurrenceCount >= alert.threshold) {
        this.triggerAlert(alert, error);
        alert.lastTriggered = now.toISOString();
      }
    }
  }

  /**
   * Trigger an alert through configured channels
   */
  private triggerAlert(alert: ErrorAlert, error: TrackedError): void {
    const alertMessage = `Alert: ${error.severity.toUpperCase()} error in ${error.category}`;
    const alertContext = {
      alertType: 'error_threshold',
      errorId: error.id,
      fingerprint: error.fingerprint,
      occurrenceCount: error.occurrenceCount,
      threshold: alert.threshold,
      timeWindow: alert.timeWindow,
      severity: error.severity,
      category: error.category,
      message: error.message,
      context: error.context
    };

    for (const channel of alert.channels) {
      switch (channel) {
        case 'log':
          logger.error(alertMessage, alertContext);
          break;
        case 'email':
          // In a real implementation, you would send an email here
          logger.error('Email alert would be sent', { alertMessage, ...alertContext });
          break;
        case 'webhook':
          // In a real implementation, you would call a webhook here
          logger.error('Webhook alert would be triggered', { alertMessage, ...alertContext });
          break;
      }
    }
  }

  /**
   * Determine the appropriate error category based on email stage
   */
  private determineEmailErrorCategory(stage?: string): ErrorCategory {
    switch (stage) {
      case 'validation':
        return 'validation';
      case 'data_fetch':
        return 'data_fetch';
      case 'template_render':
        return 'email_template';
      case 'email_send':
        return 'email_delivery';
      default:
        return 'email_delivery';
    }
  }

  /**
   * Get appropriate log level for error severity
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
    }
  }

  /**
   * Clean up old errors to prevent memory leaks
   */
  private cleanupOldErrors(): void {
    if (this.errors.size <= this.MAX_STORED_ERRORS) return;

    const errors = Array.from(this.errors.entries());
    errors.sort((a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime());

    // Remove oldest errors beyond the limit
    const toRemove = errors.slice(0, errors.length - this.MAX_STORED_ERRORS);
    for (const [id] of toRemove) {
      this.errors.delete(id);
    }

    logger.info('Cleaned up old errors', { 
      removed: toRemove.length, 
      remaining: this.errors.size 
    });
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldErrors();
    }, this.CLEANUP_INTERVAL);
  }
}

// Export singleton instance
export const errorTrackingService = new ErrorTrackingService();

/**
 * Convenience function for tracking errors
 */
export const trackError = (
  error: Error | string,
  severity: ErrorSeverity = 'medium',
  category: ErrorCategory = 'unknown',
  context: TrackedError['context'] = {},
  tags: string[] = []
): string => {
  return errorTrackingService.trackError(error, severity, category, context, tags);
};

/**
 * Convenience function for tracking email errors
 */
export const trackEmailError = (
  error: Error | string,
  severity: ErrorSeverity = 'medium',
  emailContext: Parameters<typeof errorTrackingService.trackEmailError>[2],
  tags: string[] = []
): string => {
  return errorTrackingService.trackEmailError(error, severity, emailContext, tags);
}; 