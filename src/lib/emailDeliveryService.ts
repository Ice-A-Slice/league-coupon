import 'server-only';

import { logger } from '@/utils/logger';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

export type EmailType = 'reminder' | 'transparency' | 'admin_summary';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'retrying';

export interface EmailDelivery {
  id: string;
  user_id: string;
  betting_round_id: number | null;
  email_type: string;
  status: string;
  sent_at: string | null;
  message_id: string | null;
  recipient_email: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export interface EmailDeliveryCreate {
  user_id: string;
  betting_round_id: number;
  email_type: EmailType;
  recipient_email: string;
  max_retries?: number;
}

export interface EmailDeliveryUpdate {
  status: DeliveryStatus;
  sent_at?: string;
  message_id?: string;
  error_message?: string;
  retry_count?: number;
}

export interface PendingEmailsQuery {
  email_type: EmailType;
  betting_round_id?: number;
  max_retry_count?: number;
}

/**
 * Email Delivery Service
 * 
 * Manages individual user email delivery status to prevent duplicates 
 * and ensure no users are missed due to rate limiting or other failures.
 */
export class EmailDeliveryService {
  private readonly supabase = createSupabaseServiceRoleClient();

  /**
   * Create or update email delivery records for users
   * This should be called before attempting to send emails
   */
  async createDeliveryRecords(records: EmailDeliveryCreate[]): Promise<EmailDelivery[]> {
    try {
      logger.info(`EmailDelivery: Creating ${records.length} delivery records`);

      const { data, error } = await this.supabase
        .from('email_deliveries')
        .upsert(
          records.map(record => ({
            user_id: record.user_id,
            betting_round_id: record.betting_round_id,
            email_type: record.email_type,
            recipient_email: record.recipient_email,
            max_retries: record.max_retries || 3,
            status: 'pending' as DeliveryStatus,
            retry_count: 0
          })),
          { 
            onConflict: 'user_id,betting_round_id,email_type',
            ignoreDuplicates: false // Update existing records
          }
        )
        .select();

      if (error) {
        logger.error('EmailDelivery: Failed to create delivery records', { error });
        throw new Error(`Failed to create delivery records: ${error.message}`);
      }

      logger.info(`EmailDelivery: Created ${data.length} delivery records`);
      return data;

    } catch (error) {
      logger.error('EmailDelivery: Error creating delivery records', { error });
      throw error;
    }
  }

  /**
   * Get pending email deliveries that need to be sent
   * This replaces the old round-level "already sent" checks
   */
  async getPendingDeliveries(query: PendingEmailsQuery): Promise<EmailDelivery[]> {
    try {
      let queryBuilder = this.supabase
        .from('email_deliveries')
        .select('*')
        .eq('email_type', query.email_type)
        .in('status', ['pending', 'retrying']);

      if (query.betting_round_id) {
        queryBuilder = queryBuilder.eq('betting_round_id', query.betting_round_id);
      }

      if (query.max_retry_count !== undefined) {
        queryBuilder = queryBuilder.lte('retry_count', query.max_retry_count);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: true });

      if (error) {
        logger.error('EmailDelivery: Failed to get pending deliveries', { error, query });
        throw new Error(`Failed to get pending deliveries: ${error.message}`);
      }

      logger.debug(`EmailDelivery: Found ${data.length} pending deliveries`, { query });
      return data;

    } catch (error) {
      logger.error('EmailDelivery: Error getting pending deliveries', { error, query });
      throw error;
    }
  }

  /**
   * Mark an email delivery as successful
   */
  async markAsSent(
    user_id: string, 
    betting_round_id: number, 
    email_type: EmailType, 
    message_id: string,
    recipient_email: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_deliveries')
        .update({
          status: 'sent' as DeliveryStatus,
          sent_at: new Date().toISOString(),
          message_id,
          recipient_email
        })
        .eq('user_id', user_id)
        .eq('betting_round_id', betting_round_id)
        .eq('email_type', email_type);

      if (error) {
        logger.error('EmailDelivery: Failed to mark as sent', { 
          error, user_id, betting_round_id, email_type 
        });
        throw new Error(`Failed to mark as sent: ${error.message}`);
      }

      logger.debug('EmailDelivery: Marked as sent', { 
        user_id, betting_round_id, email_type, message_id 
      });

    } catch (error) {
      logger.error('EmailDelivery: Error marking as sent', { 
        error, user_id, betting_round_id, email_type 
      });
      throw error;
    }
  }

  /**
   * Mark an email delivery as failed and increment retry count
   */
  async markAsFailed(
    user_id: string, 
    betting_round_id: number, 
    email_type: EmailType, 
    error_message: string,
    should_retry: boolean = true
  ): Promise<void> {
    try {
      // First get current retry count
      const { data: current, error: selectError } = await this.supabase
        .from('email_deliveries')
        .select('retry_count, max_retries')
        .eq('user_id', user_id)
        .eq('betting_round_id', betting_round_id)
        .eq('email_type', email_type)
        .single();

      if (selectError) {
        logger.error('EmailDelivery: Failed to get current retry count', { 
          selectError, user_id, betting_round_id, email_type 
        });
        throw new Error(`Failed to get current retry count: ${selectError.message}`);
      }

      const newRetryCount = current.retry_count + 1;
      const shouldRetry = should_retry && newRetryCount <= current.max_retries;
      const newStatus: DeliveryStatus = shouldRetry ? 'retrying' : 'failed';

      const { error } = await this.supabase
        .from('email_deliveries')
        .update({
          status: newStatus,
          error_message,
          retry_count: newRetryCount
        })
        .eq('user_id', user_id)
        .eq('betting_round_id', betting_round_id)
        .eq('email_type', email_type);

      if (error) {
        logger.error('EmailDelivery: Failed to mark as failed', { 
          error, user_id, betting_round_id, email_type 
        });
        throw new Error(`Failed to mark as failed: ${error.message}`);
      }

      logger.warn('EmailDelivery: Marked as failed/retrying', { 
        user_id, betting_round_id, email_type, error_message, 
        retry_count: newRetryCount, status: newStatus 
      });

    } catch (error) {
      logger.error('EmailDelivery: Error marking as failed', { 
        error, user_id, betting_round_id, email_type 
      });
      throw error;
    }
  }

  /**
   * Get delivery statistics for a round and email type
   */
  async getDeliveryStats(betting_round_id: number, email_type: EmailType): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    retrying: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('email_deliveries')
        .select('status')
        .eq('betting_round_id', betting_round_id)
        .eq('email_type', email_type);

      if (error) {
        logger.error('EmailDelivery: Failed to get delivery stats', { 
          error, betting_round_id, email_type 
        });
        throw new Error(`Failed to get delivery stats: ${error.message}`);
      }

      const stats = {
        total: data.length,
        sent: 0,
        failed: 0,
        pending: 0,
        retrying: 0
      };

      data.forEach(record => {
        switch (record.status) {
          case 'sent':
            stats.sent++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'pending':
            stats.pending++;
            break;
          case 'retrying':
            stats.retrying++;
            break;
        }
      });

      return stats;

    } catch (error) {
      logger.error('EmailDelivery: Error getting delivery stats', { 
        error, betting_round_id, email_type 
      });
      throw error;
    }
  }

  /**
   * Clean up old delivery records (optional maintenance function)
   */
  async cleanupOldRecords(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await this.supabase
        .from('email_deliveries')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        logger.error('EmailDelivery: Failed to cleanup old records', { error, olderThanDays });
        throw new Error(`Failed to cleanup old records: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      logger.info(`EmailDelivery: Cleaned up ${deletedCount} old records older than ${olderThanDays} days`);
      
      return deletedCount;

    } catch (error) {
      logger.error('EmailDelivery: Error during cleanup', { error, olderThanDays });
      throw error;
    }
  }
}

// Export singleton instance
export const emailDeliveryService = new EmailDeliveryService();