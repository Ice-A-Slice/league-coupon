import { sendEmail, type EmailOptions } from '@/lib/resend';
import { emailDataService, type SummaryEmailProps } from '@/lib/emailDataService';
import { SummaryEmail } from '@/components/emails/SummaryEmail';
import * as React from 'react';
import { render } from '@react-email/render';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';

/**
 * Configuration for summary email sending
 */
export interface SummaryEmailConfig {
  from: string;
  replyTo?: string;
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Result of sending summary emails
 */
export interface SummaryEmailResult {
  success: boolean;
  totalRequested: number;
  totalSent: number;
  totalFailed: number;
  batchResults: BatchResult[];
  errors: string[];
  duration: number;
}

/**
 * Result of a single batch
 */
export interface BatchResult {
  batchIndex: number;
  userIds: string[];
  successCount: number;
  failureCount: number;
  errors: Array<{ userId: string; error: string }>;
  duration: number;
}

/**
 * Individual email send result
 */
export interface IndividualEmailResult {
  userId: string;
  email: string;
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Service for sending summary emails using Resend
 */
export class SummaryEmailSender {
  private config: SummaryEmailConfig;
  private supabase = getSupabaseServiceRoleClient();

  constructor(config?: Partial<SummaryEmailConfig>) {
    this.config = {
      from: process.env.EMAIL_FROM || 'noreply@tippslottet.com',
      replyTo: process.env.EMAIL_REPLY_TO || 'support@tippslottet.com',
      batchSize: 10, // Process 10 emails at a time
      delayBetweenBatches: 1000, // 1 second between batches
      ...config
    };
  }

  /**
   * Send summary emails to multiple users
   */
  async sendSummaryEmails(
    userIds: string[],
    roundId?: number
  ): Promise<SummaryEmailResult> {
    const startTime = Date.now();
    
    logger.info({
      action: 'summary_email_send_start',
      userCount: userIds.length,
      roundId,
      batchSize: this.config.batchSize
    }, 'Starting summary email send process');

    const result: SummaryEmailResult = {
      success: false,
      totalRequested: userIds.length,
      totalSent: 0,
      totalFailed: 0,
      batchResults: [],
      errors: [],
      duration: 0
    };

    try {
      // 1. Get user email addresses
      const usersWithEmails = await this.getUserEmailAddresses(userIds);
      
      if (usersWithEmails.length === 0) {
        result.errors.push('No valid user email addresses found');
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. Generate email props for all users (batch processing)
      logger.info({ userCount: usersWithEmails.length }, 'Generating email content for users');
      const emailPropsMap = await emailDataService.getBatchSummaryEmailProps(
        usersWithEmails.map(u => u.userId),
        roundId
      );

      // 3. Process emails in batches
      const batches = this.createBatches(usersWithEmails, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        logger.info({ 
          batchIndex: i + 1, 
          totalBatches: batches.length, 
          batchSize: batch.length 
        }, 'Processing email batch');

        const batchResult = await this.processBatch(batch, emailPropsMap, i);
        result.batchResults.push(batchResult);
        result.totalSent += batchResult.successCount;
        result.totalFailed += batchResult.failureCount;

        // Add batch errors to overall errors
        batchResult.errors.forEach(err => {
          result.errors.push(`Batch ${i + 1} - User ${err.userId}: ${err.error}`);
        });

        // Delay between batches (except for the last one)
        if (i < batches.length - 1 && this.config.delayBetweenBatches > 0) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      result.success = result.totalSent > 0;
      result.duration = Date.now() - startTime;

      logger.info({
        action: 'summary_email_send_complete',
        totalRequested: result.totalRequested,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        successRate: ((result.totalSent / result.totalRequested) * 100).toFixed(1) + '%',
        duration: result.duration
      }, 'Summary email send process completed');

      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      
      logger.error({
        action: 'summary_email_send_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length,
        duration: result.duration
      }, 'Summary email send process failed');

      return result;
    }
  }

  /**
   * Send summary email to a single user
   */
  async sendSummaryEmailToUser(
    userId: string,
    roundId?: number
  ): Promise<IndividualEmailResult> {
    try {
      // 1. Get user email
      const userWithEmail = await this.getUserEmailAddress(userId);
      if (!userWithEmail) {
        return {
          userId,
          email: 'unknown',
          success: false,
          error: 'User email address not found'
        };
      }

      // 2. Generate email props
      const emailProps = await emailDataService.getSummaryEmailProps(userId, roundId);
      
      // 3. Render email template
      const emailHtml = await render(React.createElement(SummaryEmail, emailProps));
      
      // 4. Send email
      const subject = `🏆 Round ${emailProps.roundNumber} Summary - Your League Performance`;
      
      const emailOptions: EmailOptions = {
        to: userWithEmail.email,
        from: this.config.from,
        replyTo: this.config.replyTo,
        subject,
        html: emailHtml,
        tags: [
          { name: 'email_type', value: 'summary' },
          { name: 'round_number', value: emailProps.roundNumber.toString() },
          { name: 'user_id', value: userId },
          ...(this.config.tags || [])
        ]
      };

      const emailResult = await sendEmail(emailOptions);
      
      if (emailResult.success) {
        logger.info({
          action: 'summary_email_sent',
          userId,
          email: userWithEmail.email,
          emailId: emailResult.id,
          roundNumber: emailProps.roundNumber
        }, 'Summary email sent successfully');
      } else {
        logger.error({
          action: 'summary_email_failed',
          userId,
          email: userWithEmail.email,
          error: emailResult.error,
          roundNumber: emailProps.roundNumber
        }, 'Failed to send summary email');
      }

      return {
        userId,
        email: userWithEmail.email,
        success: emailResult.success,
        emailId: emailResult.id,
        error: emailResult.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        action: 'summary_email_error',
        userId,
        error: errorMessage
      }, 'Error sending summary email to user');

      return {
        userId,
        email: 'unknown',
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get user email addresses from the database
   */
  private async getUserEmailAddresses(userIds: string[]): Promise<Array<{ userId: string; email: string; name: string | null }>> {
    try {
      const { data: users, error } = await this.supabase.auth.admin.listUsers();
      
      if (error || !users) {
        logger.error({ error }, 'Failed to fetch users from auth');
        return [];
      }

      // Filter to requested users and extract email addresses
      const usersWithEmails = users.users
        .filter(user => userIds.includes(user.id))
        .filter(user => user.email && user.email.trim() !== '')
        .map(user => ({
          userId: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || null
        }));

      logger.info({
        requested: userIds.length,
        found: usersWithEmails.length
      }, 'Retrieved user email addresses');

      return usersWithEmails;
      
    } catch (error) {
      logger.error({ error }, 'Error fetching user email addresses');
      return [];
    }
  }

  /**
   * Get single user email address
   */
  private async getUserEmailAddress(userId: string): Promise<{ userId: string; email: string; name: string | null } | null> {
    const users = await this.getUserEmailAddresses([userId]);
    return users[0] || null;
  }

  /**
   * Create batches from array of users
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single batch of emails
   */
  private async processBatch(
    batch: Array<{ userId: string; email: string; name: string | null }>,
    emailPropsMap: Map<string, SummaryEmailProps>,
    batchIndex: number
  ): Promise<BatchResult> {
    const batchStartTime = Date.now();
    const result: BatchResult = {
      batchIndex,
      userIds: batch.map(u => u.userId),
      successCount: 0,
      failureCount: 0,
      errors: [],
      duration: 0
    };

    // Process all emails in the batch concurrently
    const emailPromises = batch.map(async (user) => {
      try {
        const emailProps = emailPropsMap.get(user.userId);
        if (!emailProps) {
          result.errors.push({ userId: user.userId, error: 'Email props not found' });
          return { success: false };
        }

        const emailHtml = await render(React.createElement(SummaryEmail, emailProps));
        const subject = `🏆 Round ${emailProps.roundNumber} Summary - Your League Performance`;
        
        const emailOptions: EmailOptions = {
          to: user.email,
          from: this.config.from,
          replyTo: this.config.replyTo,
          subject,
          html: emailHtml,
          tags: [
            { name: 'email_type', value: 'summary' },
            { name: 'round_number', value: emailProps.roundNumber.toString() },
            { name: 'user_id', value: user.userId },
            { name: 'batch_index', value: batchIndex.toString() },
            ...(this.config.tags || [])
          ]
        };

        const emailResult = await sendEmail(emailOptions);
        
        if (!emailResult.success) {
          result.errors.push({ 
            userId: user.userId, 
            error: emailResult.error || 'Unknown email error' 
          });
        }

        return emailResult;
        
      } catch (error) {
        result.errors.push({ 
          userId: user.userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return { success: false };
      }
    });

    const results = await Promise.all(emailPromises);
    
    // Count successes and failures
    results.forEach(emailResult => {
      if (emailResult.success) {
        result.successCount++;
      } else {
        result.failureCount++;
      }
    });

    result.duration = Date.now() - batchStartTime;
    
    logger.info({
      batchIndex,
      successCount: result.successCount,
      failureCount: result.failureCount,
      duration: result.duration
    }, 'Batch processing completed');

    return result;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get email sending statistics for monitoring
   */
  async getEmailStats(roundId?: number): Promise<{
    roundId: number | null;
    totalUsers: number;
    usersWithEmail: number;
    estimatedEmailCount: number;
  }> {
    try {
      // Get all users
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id');
      
      const totalUsers = profiles?.length || 0;
      
      // Get users with email addresses
      const usersWithEmails = await this.getUserEmailAddresses(
        profiles?.map(p => p.id) || []
      );
      
      return {
        roundId: roundId || null,
        totalUsers,
        usersWithEmail: usersWithEmails.length,
        estimatedEmailCount: usersWithEmails.length
      };
      
    } catch (error) {
      logger.error({ error }, 'Error getting email stats');
      return {
        roundId: roundId || null,
        totalUsers: 0,
        usersWithEmail: 0,
        estimatedEmailCount: 0
      };
    }
  }
}

// Export singleton instance
export const summaryEmailSender = new SummaryEmailSender(); 