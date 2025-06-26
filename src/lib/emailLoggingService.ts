import { logger as baseLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

/**
 * Email operation context for structured logging
 */
export interface EmailLogContext {
  operationId?: string;
  correlationId?: string;
  userId?: string;
  roundId?: number;
  emailType?: 'summary' | 'reminder' | 'transparency';
  recipientEmail?: string;
  templateName?: string;
  emailProvider?: string;
  batchId?: string;
  retryAttempt?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Email operation stages for detailed tracking
 */
export type EmailOperationStage = 
  | 'validation'
  | 'data_fetch'
  | 'template_render'
  | 'email_send'
  | 'webhook_process'
  | 'retry'
  | 'complete';

/**
 * Enhanced email logging service with structured logging
 */
export class EmailLoggingService {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || this.generateCorrelationId();
  }

  /**
   * Create a child logger with email context
   */
  createChildLogger(context: EmailLogContext) {
    const sanitizedContext = this.sanitizeContext({
      ...context,
      correlationId: context.correlationId || this.correlationId
    });

    return baseLogger.child(sanitizedContext);
  }

  /**
   * Log email operation start
   */
  logOperationStart(
    stage: EmailOperationStage,
    context: EmailLogContext,
    message?: string
  ) {
    const childLogger = this.createChildLogger(context);
    
    childLogger.info({
      stage,
      action: 'start',
      timestamp: new Date().toISOString(),
      message: message || `Email operation ${stage} started`
    });
  }

  /**
   * Log email operation completion
   */
  logOperationComplete(
    stage: EmailOperationStage,
    context: EmailLogContext,
    success: boolean,
    duration?: number,
    message?: string
  ) {
    const childLogger = this.createChildLogger(context);
    
    childLogger.info({
      stage,
      action: 'complete',
      success,
      duration,
      timestamp: new Date().toISOString(),
      message: message || `Email operation ${stage} ${success ? 'completed' : 'failed'}`
    });
  }

  /**
   * Log email operation error
   */
  logOperationError(
    stage: EmailOperationStage,
    context: EmailLogContext,
    error: Error | string,
    retryable: boolean = false
  ) {
    const childLogger = this.createChildLogger(context);
    
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    childLogger.error({
      stage,
      action: 'error',
      error: errorMessage,
      stack: errorStack,
      retryable,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log email validation details
   */
  logEmailValidation(
    context: EmailLogContext,
    validationResult: {
      isValid: boolean;
      errors?: string[];
      emailCount?: number;
    }
  ) {
    const childLogger = this.createChildLogger(context);
    
    if (validationResult.isValid) {
      childLogger.info({
        stage: 'validation',
        action: 'success',
        emailCount: validationResult.emailCount,
        message: 'Email validation passed'
      });
    } else {
      childLogger.warn({
        stage: 'validation',
        action: 'failure',
        errors: validationResult.errors,
        message: 'Email validation failed'
      });
    }
  }

  /**
   * Log template rendering performance
   */
  logTemplateRendering(
    context: EmailLogContext,
    renderingStats: {
      templateName: string;
      renderTime: number;
      templateSize: number;
      success: boolean;
      error?: string;
    }
  ) {
    const childLogger = this.createChildLogger({
      ...context,
      templateName: renderingStats.templateName
    });

    if (renderingStats.success) {
      childLogger.info({
        stage: 'template_render',
        action: 'success',
        renderTime: renderingStats.renderTime,
        templateSize: renderingStats.templateSize,
        message: `Template ${renderingStats.templateName} rendered successfully`
      });
    } else {
      childLogger.error({
        stage: 'template_render',
        action: 'failure',
        renderTime: renderingStats.renderTime,
        error: renderingStats.error,
        message: `Template ${renderingStats.templateName} rendering failed`
      });
    }
  }

  /**
   * Log email sending details
   */
  logEmailSending(
    context: EmailLogContext,
    sendingResult: {
      success: boolean;
      messageId?: string;
      provider?: string;
      sendTime: number;
      error?: string;
      statusCode?: number;
    }
  ) {
    const childLogger = this.createChildLogger({
      ...context,
      emailProvider: sendingResult.provider
    });

    if (sendingResult.success) {
      childLogger.info({
        stage: 'email_send',
        action: 'success',
        messageId: sendingResult.messageId,
        sendTime: sendingResult.sendTime,
        statusCode: sendingResult.statusCode,
        message: 'Email sent successfully'
      });
    } else {
      childLogger.error({
        stage: 'email_send',
        action: 'failure',
        sendTime: sendingResult.sendTime,
        error: sendingResult.error,
        statusCode: sendingResult.statusCode,
        message: 'Email sending failed'
      });
    }
  }

  /**
   * Log batch operation progress
   */
  logBatchProgress(
    context: EmailLogContext,
    progress: {
      totalEmails: number;
      processed: number;
      successful: number;
      failed: number;
      currentBatch?: number;
      totalBatches?: number;
    }
  ) {
    const childLogger = this.createChildLogger(context);
    
    const completionPercentage = Math.round((progress.processed / progress.totalEmails) * 100);
    
    childLogger.info({
      stage: 'email_send',
      action: 'batch_progress',
      totalEmails: progress.totalEmails,
      processed: progress.processed,
      successful: progress.successful,
      failed: progress.failed,
      completionPercentage,
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
      message: `Batch progress: ${progress.processed}/${progress.totalEmails} emails processed (${completionPercentage}%)`
    });
  }

  /**
   * Log webhook event processing
   */
  logWebhookEvent(
    context: EmailLogContext,
    webhookData: {
      eventType: string;
      messageId?: string;
      status?: string;
      timestamp?: string;
      provider?: string;
      processingTime?: number;
    }
  ) {
    const childLogger = this.createChildLogger({
      ...context,
      emailProvider: webhookData.provider
    });

    childLogger.info({
      stage: 'webhook_process',
      action: 'event_received',
      eventType: webhookData.eventType,
      messageId: webhookData.messageId,
      status: webhookData.status,
      eventTimestamp: webhookData.timestamp,
      processingTime: webhookData.processingTime,
      message: `Webhook event ${webhookData.eventType} processed`
    });
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    context: EmailLogContext,
    retryInfo: {
      attempt: number;
      maxAttempts: number;
      delay: number;
      reason: string;
      nextRetryAt?: Date;
    }
  ) {
    const childLogger = this.createChildLogger({
      ...context,
      retryAttempt: retryInfo.attempt
    });

    childLogger.warn({
      stage: 'retry',
      action: 'attempt',
      attempt: retryInfo.attempt,
      maxAttempts: retryInfo.maxAttempts,
      delay: retryInfo.delay,
      reason: retryInfo.reason,
      nextRetryAt: retryInfo.nextRetryAt?.toISOString(),
      message: `Retry attempt ${retryInfo.attempt}/${retryInfo.maxAttempts} for: ${retryInfo.reason}`
    });
  }

  /**
   * Log system health metrics
   */
  logSystemHealth(
    healthMetrics: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeOperations: number;
      queueSize: number;
      errorRate: number;
      avgResponseTime: number;
      memoryUsage?: number;
      recommendations?: string[];
    }
  ) {
    const level = healthMetrics.status === 'healthy' ? 'info' : 
                 healthMetrics.status === 'degraded' ? 'warn' : 'error';

    baseLogger[level]({
      component: 'email_system_health',
      status: healthMetrics.status,
      activeOperations: healthMetrics.activeOperations,
      queueSize: healthMetrics.queueSize,
      errorRate: healthMetrics.errorRate,
      avgResponseTime: healthMetrics.avgResponseTime,
      memoryUsage: healthMetrics.memoryUsage,
      recommendations: healthMetrics.recommendations,
      timestamp: new Date().toISOString(),
      message: `Email system health: ${healthMetrics.status}`
    });
  }

  /**
   * Generate correlation ID for tracking requests
   */
  private generateCorrelationId(): string {
    return `email-${Date.now()}-${randomUUID().substring(0, 8)}`;
  }

  /**
   * Sanitize context to mask sensitive data
   */
  private sanitizeContext(context: EmailLogContext): EmailLogContext {
    const sanitized = { ...context };

    // Mask email addresses (show first 2 chars and domain)
    if (sanitized.recipientEmail) {
      sanitized.recipientEmail = this.maskEmail(sanitized.recipientEmail);
    }

    // Remove or mask sensitive metadata
    if (sanitized.metadata) {
      const sanitizedMetadata: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(sanitized.metadata)) {
        if (this.isSensitiveField(key)) {
          sanitizedMetadata[key] = '[MASKED]';
        } else {
          sanitizedMetadata[key] = value;
        }
      }
      
      sanitized.metadata = sanitizedMetadata;
    }

    return sanitized;
  }

  /**
   * Mask email address for logging
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '[INVALID_EMAIL]';
    
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
      : localPart;
    
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Check if a field contains sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credential',
      'private'
    ];
    
    return sensitiveFields.some(sensitive => 
      fieldName.toLowerCase().includes(sensitive)
    );
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Create new correlation ID
   */
  newCorrelationId(): string {
    this.correlationId = this.generateCorrelationId();
    return this.correlationId;
  }
}

// Export singleton instance
export const emailLoggingService = new EmailLoggingService();

// Export factory function for creating scoped loggers
export function createEmailLogger(correlationId?: string): EmailLoggingService {
  return new EmailLoggingService(correlationId);
} 