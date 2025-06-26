import 'server-only';

import { logger } from '@/utils/logger';
import { roundCompletionDetectorService } from '@/services/roundCompletionDetectorService';
import { getSupabaseServiceRoleClient } from '@/utils/supabase/service';
// Removed unused import

/**
 * Interface for round timing information
 */
export interface RoundTiming {
  roundId: number;
  roundName: string;
  status: 'open' | 'scoring' | 'scored';
  earliestKickoff: string;
  latestKickoff: string;
  reminderSendTime: string; // 24 hours before earliest kickoff
  isReminderDue: boolean;
  isSummaryDue: boolean;
  isTransparencyDue: boolean;
}

/**
 * Interface for email scheduling results
 */
export interface SchedulingResult {
  success: boolean;
  message: string;
  roundId?: number;
  emailType?: 'summary' | 'reminder' | 'transparency';
  scheduledTime?: string;
  errors?: string[];
}

/**
 * Interface for email trigger results
 */
export interface EmailTriggerResult {
  success: boolean;
  message: string;
  emailsSent?: number;
  errors?: string[];
}

/**
 * Email Scheduler Service
 * 
 * This service handles the timing and trigger logic for automated emails:
 * - Summary emails: Sent immediately when rounds are completed
 * - Reminder emails: Sent 24 hours before round starts
 */
export class EmailSchedulerService {
  private readonly REMINDER_HOURS_BEFORE = 24;
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  /**
   * Main scheduling function that checks for both summary and reminder email opportunities
   */
  async checkAndScheduleEmails(): Promise<SchedulingResult[]> {
    logger.info('EmailScheduler: Starting email scheduling check...');
    const results: SchedulingResult[] = [];

    try {
      // Check for completed rounds (summary emails)
      const summaryResults = await this.checkForSummaryEmails();
      results.push(...summaryResults);

      // Check for upcoming rounds (reminder emails)
      const reminderResults = await this.checkForReminderEmails();
      results.push(...reminderResults);

      // Check for rounds that just started and need transparency emails
      const transparencyResults = await this.checkForTransparencyEmails();
      results.push(...transparencyResults);

      logger.info(`EmailScheduler: Scheduling check complete. Processed ${results.length} opportunities.`);
      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during scheduling check';
      logger.error('EmailScheduler: Failed during scheduling check', { error: errorMessage });
      
      results.push({
        success: false,
        message: `Scheduling check failed: ${errorMessage}`,
        errors: [errorMessage]
      });
      
      return results;
    }
  }

  /**
   * Check for completed rounds that need summary emails
   */
  async checkForSummaryEmails(): Promise<SchedulingResult[]> {
    logger.info('EmailScheduler: Checking for completed rounds needing summary emails...');
    const results: SchedulingResult[] = [];

    try {
      // Use existing round completion detector to find newly completed rounds
      const detectionResult = await roundCompletionDetectorService.detectAndMarkCompletedRounds();
      
      if (detectionResult.errors.length > 0) {
        logger.warn('EmailScheduler: Errors during round completion detection', {
          errors: detectionResult.errors.map(e => e.message)
        });
      }

      // Process each newly completed round
      for (const roundId of detectionResult.completedRoundIds) {
        try {
          logger.info(`EmailScheduler: Processing summary email for completed round ${roundId}`);
          
          // Trigger summary email
          const triggerResult = await this.triggerSummaryEmail(roundId);
          
          results.push({
            success: triggerResult.success,
            message: triggerResult.message,
            roundId,
            emailType: 'summary',
            scheduledTime: new Date().toISOString(),
            errors: triggerResult.errors
          });

          if (triggerResult.success) {
            logger.info(`EmailScheduler: Successfully scheduled summary email for round ${roundId}`);
          } else {
            logger.error(`EmailScheduler: Failed to schedule summary email for round ${roundId}`, {
              errors: triggerResult.errors
            });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`EmailScheduler: Error processing summary for round ${roundId}`, { error: errorMessage });
          
          results.push({
            success: false,
            message: `Failed to process summary for round ${roundId}: ${errorMessage}`,
            roundId,
            emailType: 'summary',
            errors: [errorMessage]
          });
        }
      }

      if (detectionResult.completedRoundIds.length === 0) {
        logger.info('EmailScheduler: No newly completed rounds found for summary emails');
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during summary check';
      logger.error('EmailScheduler: Failed to check for summary emails', { error: errorMessage });
      
      return [{
        success: false,
        message: `Summary email check failed: ${errorMessage}`,
        emailType: 'summary',
        errors: [errorMessage]
      }];
    }
  }

  /**
   * Check for upcoming rounds that need reminder emails
   */
  async checkForReminderEmails(): Promise<SchedulingResult[]> {
    logger.info('EmailScheduler: Checking for upcoming rounds needing reminder emails...');
    const results: SchedulingResult[] = [];

    try {
      // Get timing information for open rounds
      const roundTimings = await this.getOpenRoundTimings();
      
      // Check each round for reminder email eligibility
      for (const timing of roundTimings) {
        if (timing.isReminderDue) {
          try {
            logger.info(`EmailScheduler: Processing reminder email for round ${timing.roundId}`, {
              roundName: timing.roundName,
              earliestKickoff: timing.earliestKickoff,
              reminderSendTime: timing.reminderSendTime
            });

            // Check if reminder was already sent
            const alreadySent = await this.wasReminderAlreadySent(timing.roundId);
            
            if (alreadySent) {
              logger.info(`EmailScheduler: Reminder already sent for round ${timing.roundId}`);
              results.push({
                success: true,
                message: `Reminder already sent for round ${timing.roundId}`,
                roundId: timing.roundId,
                emailType: 'reminder',
                scheduledTime: timing.reminderSendTime
              });
              continue;
            }

            // Trigger reminder email
            const triggerResult = await this.triggerReminderEmail(timing.roundId);
            
            results.push({
              success: triggerResult.success,
              message: triggerResult.message,
              roundId: timing.roundId,
              emailType: 'reminder',
              scheduledTime: timing.reminderSendTime,
              errors: triggerResult.errors
            });

            if (triggerResult.success) {
              // Mark reminder as sent
              await this.markReminderAsSent(timing.roundId);
              logger.info(`EmailScheduler: Successfully scheduled reminder email for round ${timing.roundId}`);
            } else {
              logger.error(`EmailScheduler: Failed to schedule reminder email for round ${timing.roundId}`, {
                errors: triggerResult.errors
              });
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`EmailScheduler: Error processing reminder for round ${timing.roundId}`, { error: errorMessage });
            
            results.push({
              success: false,
              message: `Failed to process reminder for round ${timing.roundId}: ${errorMessage}`,
              roundId: timing.roundId,
              emailType: 'reminder',
              errors: [errorMessage]
            });
          }
        }
      }

      if (roundTimings.length === 0) {
        logger.info('EmailScheduler: No open rounds found for reminder emails');
      } else {
        const dueCount = roundTimings.filter(t => t.isReminderDue).length;
        logger.info(`EmailScheduler: Found ${dueCount} rounds due for reminder emails out of ${roundTimings.length} open rounds`);
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during reminder check';
      logger.error('EmailScheduler: Failed to check for reminder emails', { error: errorMessage });
      
      return [{
        success: false,
        message: `Reminder email check failed: ${errorMessage}`,
        emailType: 'reminder',
        errors: [errorMessage]
      }];
    }
  }

  /**
   * Get timing information for all open rounds
   */
  async getOpenRoundTimings(): Promise<RoundTiming[]> {
    logger.debug('EmailScheduler: Fetching timing information for open rounds...');
    
    try {
      const supabase = getSupabaseServiceRoleClient();
      const now = new Date();

      const { data: openRounds, error } = await supabase
        .from('betting_rounds')
        .select('id, name, status, earliest_fixture_kickoff, latest_fixture_kickoff')
        .eq('status', 'open')
        .order('earliest_fixture_kickoff', { ascending: true });

      if (error) {
        logger.error('EmailScheduler: Error fetching open rounds', { error: error.message });
        throw new Error(`Failed to fetch open rounds: ${error.message}`);
      }

      if (!openRounds || openRounds.length === 0) {
        logger.debug('EmailScheduler: No open rounds found');
        return [];
      }

      // Calculate timing information for each round
      const timings: RoundTiming[] = openRounds
        .filter(round => round.earliest_fixture_kickoff && round.latest_fixture_kickoff) // Filter out rounds with null kickoff times
        .map(round => {
          const earliestKickoff = new Date(round.earliest_fixture_kickoff!); // Non-null assertion after filter
          const reminderSendTime = new Date(earliestKickoff.getTime() - (this.REMINDER_HOURS_BEFORE * 60 * 60 * 1000));
          
          // Transparency email is due when the round has started (first game kicked off)
          // Allow a small buffer (5 minutes) after kickoff to account for scheduling delays
          const transparencyBufferMinutes = 5;
          const transparencyDueTime = new Date(earliestKickoff.getTime() + (transparencyBufferMinutes * 60 * 1000));
          const isTransparencyDue = now >= earliestKickoff && now <= transparencyDueTime;
          
          return {
            roundId: round.id,
            roundName: round.name,
            status: round.status as 'open' | 'scoring' | 'scored',
            earliestKickoff: round.earliest_fixture_kickoff!,
            latestKickoff: round.latest_fixture_kickoff!,
            reminderSendTime: reminderSendTime.toISOString(),
            isReminderDue: now >= reminderSendTime,
            isSummaryDue: false, // Open rounds are never due for summary
            isTransparencyDue
          };
        });

      logger.debug(`EmailScheduler: Found ${timings.length} open rounds with timing information`);
      return timings;

    } catch (error) {
      logger.error('EmailScheduler: Failed to get round timings', { error });
      throw error;
    }
  }

  /**
   * Trigger a summary email for a completed round
   */
  async triggerSummaryEmail(roundId: number): Promise<EmailTriggerResult> {
    logger.info(`EmailScheduler: Triggering summary email for round ${roundId}`);

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/send-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`, // Use cron secret for internal API calls
        },
        body: JSON.stringify({
          round_id: roundId,
          test_mode: process.env.EMAIL_TEST_MODE === 'true'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Summary email API call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Summary email triggered successfully for round ${roundId}`,
        emailsSent: result.emails_sent || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`EmailScheduler: Failed to trigger summary email for round ${roundId}`, { error: errorMessage });
      
      return {
        success: false,
        message: `Failed to trigger summary email for round ${roundId}`,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Trigger a reminder email for an upcoming round
   */
  async triggerReminderEmail(roundId: number): Promise<EmailTriggerResult> {
    logger.info(`EmailScheduler: Triggering reminder email for round ${roundId}`);

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`, // Use cron secret for internal API calls
        },
        body: JSON.stringify({
          round_id: roundId,
          test_mode: process.env.EMAIL_TEST_MODE === 'true',
          deadline_hours: this.REMINDER_HOURS_BEFORE
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reminder email API call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Reminder email triggered successfully for round ${roundId}`,
        emailsSent: result.emails_sent || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`EmailScheduler: Failed to trigger reminder email for round ${roundId}`, { error: errorMessage });
      
      return {
        success: false,
        message: `Failed to trigger reminder email for round ${roundId}`,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Check if a reminder email was already sent for a round
   */
  async wasReminderAlreadySent(roundId: number): Promise<boolean> {
    try {
      const supabase = getSupabaseServiceRoleClient();
      
      logger.debug(`EmailScheduler: Checking reminder status for round ${roundId}`);
      
      const { data, error } = await supabase
        .from('betting_rounds')
        .select('reminder_sent_at')
        .eq('id', roundId)
        .single();

      if (error) {
        logger.warn(`EmailScheduler: Could not check reminder status for round ${roundId}`, { error: error.message });
        return false; // Assume not sent if we can't check
      }

      const reminderSent = !!data?.reminder_sent_at;
      logger.debug(`EmailScheduler: Round ${roundId} reminder status: ${reminderSent ? 'sent' : 'not sent'}`, {
        reminder_sent_at: data?.reminder_sent_at
      });

      return reminderSent;

    } catch (error) {
      logger.warn(`EmailScheduler: Error checking reminder status for round ${roundId}`, { error });
      return false; // Assume not sent if there's an error
    }
  }

  /**
   * Mark a reminder email as sent for a round
   */
  async markReminderAsSent(roundId: number): Promise<void> {
    try {
      const supabase = getSupabaseServiceRoleClient();
      
      const timestamp = new Date().toISOString();
      logger.debug(`EmailScheduler: Marking reminder as sent for round ${roundId} at ${timestamp}`);
      
      const { error } = await supabase
        .from('betting_rounds')
        .update({ reminder_sent_at: timestamp })
        .eq('id', roundId);

      if (error) {
        logger.error(`EmailScheduler: Failed to mark reminder as sent for round ${roundId}`, { error: error.message });
        throw new Error(`Failed to mark reminder as sent: ${error.message}`);
      }

      logger.debug(`EmailScheduler: Successfully marked reminder as sent for round ${roundId}`);

    } catch (error) {
      logger.error(`EmailScheduler: Error marking reminder as sent for round ${roundId}`, { error });
      throw error;
    }
  }

  /**
   * Get the next scheduled email events for monitoring/debugging
   */
  async getUpcomingEmailSchedule(): Promise<RoundTiming[]> {
    logger.info('EmailScheduler: Getting upcoming email schedule...');
    
    try {
      const roundTimings = await this.getOpenRoundTimings();
      
      // Filter to only upcoming events
      const now = new Date();
      const upcoming = roundTimings.filter(timing => {
        const reminderTime = new Date(timing.reminderSendTime);
        return reminderTime > now;
      });

      logger.info(`EmailScheduler: Found ${upcoming.length} upcoming email events`);
      return upcoming;

    } catch (error) {
      logger.error('EmailScheduler: Failed to get upcoming schedule', { error });
      throw error;
    }
  }

  /**
   * Check for rounds that have just started and need transparency emails
   */
  async checkForTransparencyEmails(): Promise<SchedulingResult[]> {
    logger.info('EmailScheduler: Checking for rounds that just started needing transparency emails...');
    const results: SchedulingResult[] = [];

    try {
      // Get timing information for open rounds
      const roundTimings = await this.getOpenRoundTimings();
      
      // Check each round for transparency email eligibility (round just started)
      for (const timing of roundTimings) {
        if (timing.isTransparencyDue) {
          try {
            logger.info(`EmailScheduler: Processing transparency email for started round ${timing.roundId}`, {
              roundName: timing.roundName,
              earliestKickoff: timing.earliestKickoff
            });

            // Check if transparency email was already sent
            const alreadySent = await this.wasTransparencyAlreadySent(timing.roundId);
            
            if (alreadySent) {
              logger.info(`EmailScheduler: Transparency email already sent for round ${timing.roundId}`);
                             results.push({
                 success: true,
                 message: `Transparency email already sent for round ${timing.roundId}`,
                 roundId: timing.roundId,
                 emailType: 'transparency' as const,
                 scheduledTime: timing.earliestKickoff
               });
              continue;
            }

            // Trigger transparency email
            const triggerResult = await this.triggerTransparencyEmail(timing.roundId);
            
                         results.push({
               success: triggerResult.success,
               message: triggerResult.message,
               roundId: timing.roundId,
               emailType: 'transparency' as const,
               scheduledTime: new Date().toISOString(),
               errors: triggerResult.errors
             });

            if (triggerResult.success) {
              logger.info(`EmailScheduler: Successfully triggered transparency email for round ${timing.roundId}`);
              // Mark transparency as sent
              await this.markTransparencyAsSent(timing.roundId);
            } else {
              logger.error(`EmailScheduler: Failed to trigger transparency email for round ${timing.roundId}`, {
                errors: triggerResult.errors
              });
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`EmailScheduler: Error processing transparency for round ${timing.roundId}`, { error: errorMessage });
            
                         results.push({
               success: false,
               message: `Failed to process transparency for round ${timing.roundId}: ${errorMessage}`,
               roundId: timing.roundId,
               emailType: 'transparency' as const,
               errors: [errorMessage]
             });
          }
        }
      }

      if (results.length === 0) {
        logger.info('EmailScheduler: No rounds found that just started and need transparency emails');
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during transparency check';
      logger.error('EmailScheduler: Failed to check for transparency emails', { error: errorMessage });
      
             return [{
         success: false,
         message: `Transparency email check failed: ${errorMessage}`,
         emailType: 'transparency' as const,
         errors: [errorMessage]
       }];
    }
  }

  /**
   * Trigger a transparency email for a started round
   */
  async triggerTransparencyEmail(roundId: number): Promise<EmailTriggerResult> {
    logger.info(`EmailScheduler: Triggering transparency email for round ${roundId}`);

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/send-transparency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          round_id: roundId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transparency email API call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Transparency email triggered successfully for round ${roundId}`,
        emailsSent: result.emails_sent || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`EmailScheduler: Failed to trigger transparency email for round ${roundId}`, { error: errorMessage });
      
      return {
        success: false,
        message: `Failed to trigger transparency email for round ${roundId}`,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Check if a transparency email was already sent for a round
   */
  async wasTransparencyAlreadySent(roundId: number): Promise<boolean> {
    try {
      const supabase = getSupabaseServiceRoleClient();
      
      logger.debug(`EmailScheduler: Checking transparency status for round ${roundId}`);
      
      const { data, error } = await supabase
        .from('betting_rounds')
        .select('transparency_sent_at')
        .eq('id', roundId)
        .single();

      if (error) {
        logger.warn(`EmailScheduler: Could not check transparency status for round ${roundId}`, { error: error.message });
        return false; // Assume not sent if we can't check
      }

      const transparencySent = !!data?.transparency_sent_at;
      logger.debug(`EmailScheduler: Round ${roundId} transparency status: ${transparencySent ? 'sent' : 'not sent'}`, {
        transparency_sent_at: data?.transparency_sent_at
      });

      return transparencySent;

    } catch (error) {
      logger.warn(`EmailScheduler: Error checking transparency status for round ${roundId}`, { error });
      return false; // Assume not sent if there's an error
    }
  }

  /**
   * Mark a transparency email as sent for a round
   */
  async markTransparencyAsSent(roundId: number): Promise<void> {
    try {
      const supabase = getSupabaseServiceRoleClient();
      
      const timestamp = new Date().toISOString();
      logger.debug(`EmailScheduler: Marking transparency as sent for round ${roundId} at ${timestamp}`);
      
      const { error } = await supabase
        .from('betting_rounds')
        .update({ transparency_sent_at: timestamp })
        .eq('id', roundId);

      if (error) {
        logger.error(`EmailScheduler: Failed to mark transparency as sent for round ${roundId}`, { error: error.message });
        throw new Error(`Failed to mark transparency as sent: ${error.message}`);
      }

      logger.debug(`EmailScheduler: Successfully marked transparency as sent for round ${roundId}`);

    } catch (error) {
      logger.error(`EmailScheduler: Error marking transparency as sent for round ${roundId}`, { error });
      throw error;
    }
  }
}

// Export singleton instance
export const emailSchedulerService = new EmailSchedulerService();

/**
 * Convenience function for scheduled triggers (e.g., from Vercel Scheduler)
 */
export async function runEmailSchedulingCheck(): Promise<SchedulingResult[]> {
  logger.info('EmailScheduler: Running scheduled email check...');
  return await emailSchedulerService.checkAndScheduleEmails();
} 