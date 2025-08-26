import 'server-only';

import { logger } from '@/utils/logger';
import { roundCompletionDetectorService } from '@/services/roundCompletionDetectorService';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { emailDeliveryService, type EmailDelivery } from './emailDeliveryService';
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
  emailType?: 'summary' | 'reminder' | 'transparency' | 'admin-summary';
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
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

      // Check for scored rounds that missed their admin summary emails
      const missedAdminResults = await this.checkForMissedAdminSummaries();
      results.push(...missedAdminResults);

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

          // Always send admin summary email for completed rounds (independent of user summary)
          logger.info(`EmailScheduler: Triggering admin summary email for round ${roundId}`);
          const adminResult = await this.triggerAdminSummaryEmail(roundId);
          
          results.push({
            success: adminResult.success,
            message: adminResult.message,
            roundId,
            emailType: 'admin-summary',
            scheduledTime: new Date().toISOString(),
            errors: adminResult.errors
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

            // Set up individual delivery tracking for reminder emails
            // This replaces the old round-level "reminder_sent_at" approach
            await this.setupReminderDeliveryTracking(timing.roundId);
            
            // Get pending reminder deliveries for this round
            const pendingDeliveries = await emailDeliveryService.getPendingDeliveries({
              email_type: 'reminder',
              betting_round_id: timing.roundId,
              max_retry_count: 3
            });
            
            if (pendingDeliveries.length === 0) {
              logger.info(`EmailScheduler: No pending reminder deliveries for round ${timing.roundId}`);
              results.push({
                success: true,
                message: `All reminder emails already sent for round ${timing.roundId}`,
                roundId: timing.roundId,
                emailType: 'reminder',
                scheduledTime: timing.reminderSendTime
              });
              continue;
            }
            
            logger.info(`EmailScheduler: Found ${pendingDeliveries.length} pending reminder deliveries for round ${timing.roundId}`);

            // Trigger reminder email for pending users only
            const triggerResult = await this.triggerReminderEmailWithDeliveryTracking(timing.roundId, pendingDeliveries);
            
            results.push({
              success: triggerResult.success,
              message: triggerResult.message,
              roundId: timing.roundId,
              emailType: 'reminder',
              scheduledTime: timing.reminderSendTime,
              errors: triggerResult.errors
            });

            // With individual delivery tracking, success/failure is handled per-user
            // No need for round-level success logic anymore
            if (triggerResult.success) {
              logger.info(`EmailScheduler: Reminder email process completed for round ${timing.roundId} (${triggerResult.emailsSent || 0} deliveries attempted)`);
            } else {
              logger.error(`EmailScheduler: Failed to process reminder emails for round ${timing.roundId}`, {
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
      const supabase = createSupabaseServiceRoleClient();
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
          // Allow a larger buffer (30 minutes) after kickoff to account for API timeouts and retries
          const transparencyBufferMinutes = 30;
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
   * Trigger an admin summary email for a completed round
   */
  async triggerAdminSummaryEmail(roundId: number): Promise<EmailTriggerResult> {
    logger.info(`EmailScheduler: Triggering admin summary email for round ${roundId}`);

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/send-admin-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          roundId: roundId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Admin summary email API call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Admin summary email triggered successfully for round ${roundId}`,
        emailsSent: result.recipients?.length || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`EmailScheduler: Failed to trigger admin summary email for round ${roundId}`, { error: errorMessage });
      
      return {
        success: false,
        message: `Failed to trigger admin summary email for round ${roundId}`,
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
        emailsSent: result.summary?.sent || result.emails_sent || 0
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
      const supabase = createSupabaseServiceRoleClient();
      
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
      const supabase = createSupabaseServiceRoleClient();
      
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
   * Check for scored rounds that need admin summary emails
   * This handles rounds that were scored but never got their admin summary sent
   */
  async checkForMissedAdminSummaries(): Promise<SchedulingResult[]> {
    logger.info('EmailScheduler: Checking for scored rounds needing admin summary emails...');
    const results: SchedulingResult[] = [];
    
    try {
      const supabase = createSupabaseServiceRoleClient();
      
      // Find rounds that:
      // 1. Are scored (status = 'scored')
      // 2. Were scored within last 24 hours (to avoid sending old summaries)
      // 3. Haven't had admin summary sent (admin_summary_sent_at is NULL)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const { data: missedRounds, error } = await supabase
        .from('betting_rounds')
        .select('id, name, scored_at, admin_summary_sent_at')
        .eq('status', 'scored')
        .gte('scored_at', twentyFourHoursAgo.toISOString())
        .is('admin_summary_sent_at', null);
      
      if (error) {
        logger.error('Failed to fetch rounds needing admin summary', { error });
        throw error;
      }
      
      logger.info(`Found ${missedRounds?.length || 0} scored rounds without admin summary`);
      
      // Process each round
      for (const round of missedRounds || []) {
        try {
          logger.info(`Processing missed admin summary for round ${round.id} (${round.name})`);
          
          // Double-check admin_summary_sent_at is still null (prevent race conditions)
          const { data: currentRound, error: checkError } = await supabase
            .from('betting_rounds')
            .select('admin_summary_sent_at')
            .eq('id', round.id)
            .single();
          
          if (checkError || currentRound?.admin_summary_sent_at) {
            logger.warn(`Round ${round.id} admin summary already sent or error checking`, { 
              error: checkError,
              admin_summary_sent_at: currentRound?.admin_summary_sent_at 
            });
            continue;
          }
          
          // Trigger admin summary email
          const adminResult = await this.triggerAdminSummaryEmail(round.id);
          
          results.push({
            success: adminResult.success,
            message: adminResult.message,
            roundId: round.id,
            emailType: 'admin-summary' as const,
            scheduledTime: new Date().toISOString(),
            errors: adminResult.errors
          });
          
          if (adminResult.success) {
            logger.info(`Successfully sent admin summary for round ${round.id}`);
          } else {
            logger.error(`Failed to send admin summary for round ${round.id}`, {
              errors: adminResult.errors
            });
          }
          
        } catch (roundError) {
          const errorMessage = roundError instanceof Error ? roundError.message : 'Unknown error';
          logger.error(`Error processing admin summary for round ${round.id}`, { error: errorMessage });
          
          results.push({
            success: false,
            message: `Failed to process admin summary for round ${round.id}: ${errorMessage}`,
            roundId: round.id,
            emailType: 'admin-summary' as const,
            errors: [errorMessage]
          });
        }
      }
      
      return results;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to check for missed admin summaries', { error: errorMessage });
      
      return [{
        success: false,
        message: `Admin summary check failed: ${errorMessage}`,
        emailType: 'admin-summary' as const,
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
          'Authorization': `Bearer ${process.env.CRON_SECRET}`, // Use cron secret for internal API calls
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
      const supabase = createSupabaseServiceRoleClient();
      
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
      const supabase = createSupabaseServiceRoleClient();
      
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

  /**
   * Set up delivery tracking records for reminder emails
   * Creates records for all users who need reminder emails for this round
   */
  async setupReminderDeliveryTracking(roundId: number): Promise<void> {
    try {
      logger.debug(`EmailScheduler: Setting up reminder delivery tracking for round ${roundId}`);
      
      const supabase = createSupabaseServiceRoleClient();
      
      // Get all active users who have made bets (same logic as reminder API)
      const { data: activeBettors, error: bettorsError } = await supabase
        .from('user_bets')
        .select('user_id')
        .not('user_id', 'is', null); // Ensure user_id is not null
        
      if (bettorsError) {
        throw new Error(`Failed to fetch active bettors: ${bettorsError.message}`);
      }
      
      const activeBettorIds = [...new Set(activeBettors?.map(bet => bet.user_id) || [])];
      
      if (activeBettorIds.length === 0) {
        logger.info(`EmailScheduler: No active bettors found for delivery tracking setup`);
        return;
      }
      
      // Get auth users (for emails) filtered to active bettors only
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        throw new Error(`Failed to fetch users from auth: ${authError.message}`);
      }
      
      // Filter to active bettors with emails
      const targetUsers = authUsers.users.filter(user => 
        user.email && activeBettorIds.includes(user.id)
      );
      
      // Create delivery tracking records
      const deliveryRecords = targetUsers.map(user => ({
        user_id: user.id,
        betting_round_id: roundId,
        email_type: 'reminder' as const,
        recipient_email: user.email!,
        max_retries: 3
      }));
      
      if (deliveryRecords.length > 0) {
        await emailDeliveryService.createDeliveryRecords(deliveryRecords);
        logger.info(`EmailScheduler: Set up delivery tracking for ${deliveryRecords.length} users for round ${roundId}`);
      }
      
    } catch (error) {
      logger.error(`EmailScheduler: Failed to setup reminder delivery tracking for round ${roundId}`, { error });
      throw error;
    }
  }

  /**
   * Trigger reminder emails with individual delivery tracking
   * This replaces the old triggerReminderEmail method
   */
  async triggerReminderEmailWithDeliveryTracking(
    roundId: number, 
    pendingDeliveries: EmailDelivery[]
  ): Promise<EmailTriggerResult> {
    logger.info(`EmailScheduler: Triggering reminder emails with delivery tracking for round ${roundId} (${pendingDeliveries.length} pending)`);

    try {
      // Extract user IDs from pending deliveries
      const userIds = pendingDeliveries.map(delivery => delivery.user_id);
      
      const response = await fetch(`${this.API_BASE_URL}/api/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          round_id: roundId,
          user_ids: userIds, // Only send to pending users
          test_mode: process.env.EMAIL_TEST_MODE === 'true',
          deadline_hours: this.REMINDER_HOURS_BEFORE,
          delivery_tracking: true // Flag to enable delivery tracking in API
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reminder email API call failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Reminder emails triggered with delivery tracking for round ${roundId}`,
        emailsSent: result.summary?.sent || result.emails_sent || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`EmailScheduler: Failed to trigger reminder emails with delivery tracking for round ${roundId}`, { error: errorMessage });
      
      return {
        success: false,
        message: `Failed to trigger reminder emails with delivery tracking for round ${roundId}`,
        errors: [errorMessage]
      };
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