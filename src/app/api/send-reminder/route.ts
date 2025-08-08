import { NextResponse } from 'next/server';
import React from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { render } from '@react-email/render';
import { SimpleReminderEmail } from '@/components/emails/SimpleReminderEmail';
import { reminderEmailDataService } from '@/lib/reminderEmailDataService';
import { sendEmail } from '@/lib/resend';
import { emailMonitoringService } from '@/lib/emailMonitoringService';
import { logger } from '@/utils/logger';

/**
 * Validation schema for reminder email request
 */
const reminderEmailRequestSchema = z.object({
  user_ids: z.array(z.string().uuid()).optional(),
  round_id: z.number().optional(),
  test_mode: z.boolean().optional().default(false),
  deadline_hours: z.number().min(1).max(168).optional().default(24), // 1 hour to 1 week
  force_send: z.boolean().optional().default(false), // Send even to users who already submitted
});

type ReminderEmailRequest = z.infer<typeof reminderEmailRequestSchema>;

/**
 * POST /api/send-reminder
 * 
 * Send reminder emails to users about upcoming prediction deadlines.
 * 
 * Request body:
 * - user_ids?: string[] - Optional array of user IDs. If not provided, sends to all active users
 * - round_id?: number - Optional round ID. If not provided, uses current active round
 * - test_mode?: boolean - If true, returns email preview instead of sending (default: false)
 * - deadline_hours?: number - Hours before deadline to send reminder (default: 24, range: 1-168)
 * 
 * Environment variables:
 * - EMAIL_TEST_MODE: If 'true', forces test mode regardless of request parameter
 * 
 * Returns:
 * - 200: Success with email stats
 * - 400: Invalid request parameters
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(request: Request) {
  const operationId = emailMonitoringService.startOperation(
    'reminder',
    null,
    0,
    null
  );

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = reminderEmailRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = 'Invalid request parameters for reminder email';
      logger.error('ReminderEmailAPI: Validation failed', {
        operationId,
        errors: validationResult.error.errors,
        requestBody: body
      });

      emailMonitoringService.recordError(operationId, 'validation', errorMessage, {
        validationErrors: validationResult.error.errors,
        requestBody: body
      });

      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const payload: ReminderEmailRequest = validationResult.data;
    
    logger.info('ReminderEmailAPI: Processing reminder email request', {
      operationId,
      userIdsProvided: !!payload.user_ids,
      userCount: payload.user_ids?.length || 'all',
      roundId: payload.round_id || 'current',
      testMode: payload.test_mode,
      deadlineHours: payload.deadline_hours
    });

    // Authentication: Support both server-to-server (cron) and user session authentication
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;
    
    const isServerCall = cronSecret && (
      authHeader === `Bearer ${cronSecret}` || 
      cronSecretHeader === cronSecret
    );

    if (!isServerCall) {
      // For non-server calls, require user authentication
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              cookieStore.set({ name, value: '', ...options });
            },
          },
        }
      );

      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        const errorMessage = 'Authentication required';
        logger.warn('ReminderEmailAPI: Authentication failed', {
          operationId,
          authError: authError?.message || 'Auth session missing!'
        });

        emailMonitoringService.recordError(operationId, 'authentication', errorMessage, {
          authError: authError?.message || 'Auth session missing!'
        });

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 401 }
        );
      }
    } else {
      logger.info('ReminderEmailAPI: Server-to-server authentication successful', { operationId });
    }

    // Create Supabase client for data operations (using service role key for both cases)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    );

    // Check for test mode (environment variable overrides request parameter)
    const isTestMode = process.env.EMAIL_TEST_MODE === 'true' || payload.test_mode;
    
    if (isTestMode) {
      logger.info('ReminderEmailAPI: Running in test mode - will return email preview', {
        operationId,
        testModeSource: process.env.EMAIL_TEST_MODE === 'true' ? 'environment' : 'request'
      });
    }

    // Handle test mode with realistic preview
    if (isTestMode) {
      try {
        // Generate realistic test data using our service
        const testUserId = 'test-user-id';
        const testReminderData = await reminderEmailDataService.getReminderEmailData(
          testUserId,
          payload.round_id,
          payload.deadline_hours
        );
        
        // Create simple email props for test mode
        const testEmailProps = {
          roundName: testReminderData.roundContext.roundName,
          submittedUsers: testReminderData.submissionStatus.submittedUserNames,
          gameLeaderInitials: 'PC',
          appUrl: process.env.NEXT_PUBLIC_APP_URL
        };

        const htmlContent = render(React.createElement(SimpleReminderEmail, testEmailProps));
        
        const testResponse = {
          success: true,
          message: 'Test mode: Reminder email preview generated',
          operation_id: operationId,
          test_mode: true,
          preview: htmlContent,
          data: testEmailProps,
          round_context: testReminderData.roundContext
        };

        emailMonitoringService.completeOperation(operationId, {
          success: true,
          totalSent: 1,
          totalFailed: 0
        });

        return NextResponse.json(testResponse, { status: 200 });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test mode error';
        logger.error('ReminderEmailAPI: Test mode failed', { operationId, error: errorMessage });
        
                 emailMonitoringService.recordError(operationId, 'template', errorMessage);
        emailMonitoringService.completeOperation(operationId, {
          success: false,
          totalSent: 0,
          totalFailed: 1
        });

        return NextResponse.json(
          { success: false, error: 'Test mode failed', details: errorMessage },
          { status: 500 }
        );
      }
    }

    // Production reminder email logic
    let targetUsers: Array<{ id: string; email: string; name?: string }> = [];
    
    try {
      if (payload.user_ids && payload.user_ids.length > 0) {
        // Get specific users - emails from auth.users, names from profiles
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
          throw new Error(`Failed to fetch users from auth: ${authError.message}`);
        }
        
        // Filter to requested users and get their profile info
        const requestedUsers = authUsers.users.filter(user => 
          payload.user_ids!.includes(user.id) && user.email
        );
        
        // Get profile names for these users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', requestedUsers.map(u => u.id));
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        targetUsers = requestedUsers.map(user => ({
          id: user.id,
          email: user.email!,
          name: profileMap.get(user.id) || undefined
        }));
        
      } else {
        // Get only users who have actively participated in betting
        const { data: activeBettors, error: bettorsError } = await supabase
          .from('user_bets')
          .select('user_id');
          
        if (bettorsError) {
          throw new Error(`Failed to fetch active bettors: ${bettorsError.message}`);
        }
        
        const activeBettorIds = [...new Set(activeBettors?.map(bet => bet.user_id) || [])];
        
        if (activeBettorIds.length === 0) {
          logger.info('No active bettors found, skipping reminder emails');
          targetUsers = [];
        } else {
          // Get auth users (for emails) filtered to active bettors only
          const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
          if (authError) {
            throw new Error(`Failed to fetch users from auth: ${authError.message}`);
          }
          
          // Filter to active bettors with emails
          const relevantUsers = authUsers.users.filter(user => 
            user.email && activeBettorIds.includes(user.id)
          );
          
          // Get profile names for relevant users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', relevantUsers.map(u => u.id));
          
          const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
          
          targetUsers = relevantUsers.map(user => ({
            id: user.id,
            email: user.email!,
            name: profileMap.get(user.id) || undefined
          }));
        }
      }
      
      logger.info(`ReminderEmailAPI: Targeting ${targetUsers.length} users for reminders`, {
        operationId,
        specificUsers: !!payload.user_ids
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users';
      logger.error('ReminderEmailAPI: Error fetching users', { operationId, error: errorMessage });
      
             emailMonitoringService.recordError(operationId, 'unknown', errorMessage);
      emailMonitoringService.completeOperation(operationId, {
        success: false,
        totalSent: 0,
        totalFailed: 1
      });

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
    
    // Send reminder emails to each user
    const emailResults: Array<{
      userId: string;
      email: string;
      status: 'sent' | 'failed' | 'skipped';
      emailId?: string;
      error?: string;
      reason?: string;
      roundNumber?: number;
    }> = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the service
    
    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (targetUser) => {
        try {
          // Get personalized reminder data for this user
          const reminderData = await reminderEmailDataService.getReminderEmailData(
            targetUser.id,
            payload.round_id,
            payload.deadline_hours
          );
          
          // Always send reminder emails - even to users who have already submitted
          // This serves as confirmation and keeps everyone informed about who has submitted
          // Force send is no longer needed since we always send to everyone
          
          // Create simple email props
          const simpleEmailProps = {
            roundName: reminderData.roundContext.roundName,
            submittedUsers: reminderData.submissionStatus.submittedUserNames,
            gameLeaderInitials: 'PC', // TODO: Make this configurable
            appUrl: process.env.NEXT_PUBLIC_APP_URL
          };
          
          // Render email HTML
          const htmlContent = await render(React.createElement(SimpleReminderEmail, simpleEmailProps));
          
          // Send email via Resend
          const emailResponse = await sendEmail({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@tippslottet.com',
            to: targetUser.email,
            subject: `APL - Round ${reminderData.roundContext.roundNumber} - Friendly Reminder`,
            html: htmlContent,
            tags: [
              { name: 'type', value: 'reminder' },
              { name: 'round', value: reminderData.roundContext.roundNumber.toString() },
              { name: 'urgent', value: reminderData.fixtures.deadline.isUrgent.toString() }
            ]
          });
          
          if (!emailResponse.success) {
            throw new Error(emailResponse.error || 'Email sending failed');
          }
          
          return {
            userId: targetUser.id,
            email: targetUser.email,
            status: 'sent' as const,
            emailId: emailResponse.id,
            roundNumber: reminderData.roundContext.roundNumber
          };
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`ReminderEmailAPI: Failed to send reminder to user ${targetUser.id}`, { 
            operationId, 
            userId: targetUser.id, 
            error: errorMessage 
          });
          
          return {
            userId: targetUser.id,
            email: targetUser.email,
            status: 'failed' as const,
            error: errorMessage
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          emailResults.push(result.value);
        } else {
          const user = batch[index];
          emailResults.push({
            userId: user.id,
            email: user.email,
            status: 'failed' as const,
            error: result.reason
          });
        }
      });
      
      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < targetUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Calculate results summary
    const summary = {
      total: emailResults.length,
      sent: emailResults.filter(r => r.status === 'sent').length,
      failed: emailResults.filter(r => r.status === 'failed').length,
      skipped: emailResults.filter(r => r.status === 'skipped').length
    };
    
    logger.info('ReminderEmailAPI: Batch completed', { operationId, summary });
    
    // Complete monitoring operation
    emailMonitoringService.completeOperation(operationId, {
      success: true,
      totalSent: summary.sent,
      totalFailed: summary.failed
    });

    const response = {
      success: true,
      message: `Reminder emails processed: ${summary.sent} sent, ${summary.failed} failed, ${summary.skipped} skipped`,
      operation_id: operationId,
      round_id: payload.round_id || 'current',
      deadline_hours: payload.deadline_hours,
      summary,
      results: emailResults.map(r => ({
        userId: r.userId,
        email: r.email,
        status: r.status,
        ...(r.status === 'sent' && { emailId: r.emailId }),
        ...(r.status === 'failed' && { error: r.error }),
        ...(r.status === 'skipped' && { reason: r.reason })
      }))
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('ReminderEmailAPI: Unexpected error', {
      operationId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    emailMonitoringService.recordError(operationId, 'unknown', errorMessage, {
      stack: error instanceof Error ? error.stack : undefined
    });

    // Complete the operation as failed
    emailMonitoringService.completeOperation(operationId, {
      success: false,
      totalSent: 0,
      totalFailed: 1,
      errors: [errorMessage]
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        operation_id: operationId
      },
      { status: 500 }
    );
  }
} 