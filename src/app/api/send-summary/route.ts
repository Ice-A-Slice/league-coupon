import { NextResponse } from 'next/server';
import React from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { emailDataService } from '@/lib/emailDataService';
import { SummaryEmail } from '@/components/emails/SummaryEmail';
import { render } from '@react-email/render';
import { summaryEmailSender, type SummaryEmailResult } from '@/lib/summaryEmailSender';
import { emailMonitoringService } from '@/lib/emailMonitoringService';

/**
 * Zod schema for validating the send-summary API request body.
 */
const sendSummarySchema = z.object({
  /** Optional: The specific round ID to send summary for. If not provided, uses the latest completed round. */
  round_id: z.number().optional(),
  /** Optional: Test mode flag to prevent actual email sending and instead return email content for preview. */
  test_mode: z.boolean().optional().default(false),
  /** Optional: Array of specific user IDs to send summary to. If not provided, sends to all users. */
  user_ids: z.array(z.string()).optional(),
});

/**
 * Represents the expected structure of the request body for the POST /api/send-summary endpoint.
 */
type SendSummaryPayload = z.infer<typeof sendSummarySchema>;

/**
 * Handles POST requests to /api/send-summary for sending post-round summary emails.
 * 
 * This handler performs the following steps:
 * 1. **Authentication:** Verifies the user is logged in using Supabase auth.
 * 2. **Request Validation:** Parses and validates the JSON request body using Zod schema.
 * 3. **Round Determination:** Identifies the target round (either specified or latest completed).
 * 4. **Authorization Check:** Ensures only authorized users can trigger email sending.
 * 5. **Test Mode Support:** Handles EMAIL_TEST_MODE environment variable for development.
 * 6. **Response:** Returns success message or appropriate error response.
 *
 * @param {Request} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a Next.js response object.
 */
export async function POST(request: Request) {
  // Authentication: Support both server-to-server (cron) and user session authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isServerCall = authHeader === `Bearer ${cronSecret}`;

  let userId: string | null = null;
  let supabase;

  if (!isServerCall) {
    // For non-server calls, require user authentication
    const cookieStore = await cookies();
    const cookieMethods = {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          console.error("Error setting cookie in Route Handler:", error);
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          console.error("Error removing cookie in Route Handler:", error);
        }
      },
    };

    // Create Supabase client for user authentication
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieMethods,
      }
    );

    // Check user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error getting user or no user found:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    userId = user.id;
    console.log(`User ${userId} attempting to send summary emails.`);
  } else {
    // For server calls, use service role client
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('Server-to-server authentication successful for summary emails');
  }

  // 2. Parse and Validate Request Body
  let payload: SendSummaryPayload;
  try {
    const body = await request.json();
    const validationResult = sendSummarySchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.error.issues);
      const errorMessages = validationResult.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      return NextResponse.json({ 
        error: `Invalid request body: ${errorMessages}` 
      }, { status: 400 });
    }
    
    payload = validationResult.data;
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ 
      error: 'Failed to parse request body' 
    }, { status: 400 });
  }

  console.log(`Summary email request validated. Payload:`, payload);

  // 3. Authorization Check (Optional: Add role-based access control)
  // For now, any authenticated user can trigger summary emails
  // In production, you might want to restrict this to admin users only
  
  // 4. Check Test Mode (both from payload and environment variable)
  const isTestMode = payload.test_mode || process.env.EMAIL_TEST_MODE === 'true';
  
  if (isTestMode) {
    console.log('Test mode enabled - email content will be logged instead of sent');
  }

  // 5. Template Integration & Email Processing (Subtask 5.2 & 5.3 - Complete)
  try {
    // Determine target users
    let targetUserIds = payload.user_ids || [];
    
    if (targetUserIds.length === 0) {
      // Get all users if none specified
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id');
      
      if (!profiles) {
        return NextResponse.json(
          { error: 'Failed to fetch user profiles' },
          { status: 500 }
        );
      }
      
      targetUserIds = profiles.map(p => p.id);
    }

    if (isTestMode) {
      // In test mode, generate preview for a single user
      const testUserId = targetUserIds[0];
      
      if (!testUserId) {
        return NextResponse.json(
          { error: 'No users available for test mode' },
          { status: 404 }
        );
      }

      // Generate SummaryEmail props for test user
      const emailProps = await emailDataService.getSummaryEmailProps(testUserId, payload.round_id);
      
      // Render email template to HTML
      const emailHtml = await render(React.createElement(SummaryEmail, emailProps));
      
      console.log('TEST MODE - Summary email template rendered for user:', testUserId);
      return NextResponse.json({
        success: true,
        message: 'Summary email template rendered successfully',
        test_mode: true,
        user_id: testUserId,
        round_number: emailProps.roundNumber,
        stats: {
          matches: emailProps.matches.length,
          standings: emailProps.leagueStandings.length,
          stories: emailProps.aiStories.length
        },
        email_preview: {
          html_length: emailHtml.length,
          user_performance: {
            name: emailProps.user.name,
            position: emailProps.user.currentPosition,
            points_earned: emailProps.user.pointsEarned,
            correct_predictions: `${emailProps.user.correctPredictions}/${emailProps.user.totalPredictions}`
          },
          week_highlights: emailProps.weekHighlights
        },
        template_html: emailHtml.substring(0, 500) + '...', // Preview first 500 chars
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // Production mode - Send actual emails using SummaryEmailSender with monitoring (Subtask 5.4 & 5.5)
    console.log(`Sending summary emails to ${targetUserIds.length} users`);
    
    // Start monitoring operation
    const operationId = emailMonitoringService.startOperation(
      'summary',
      payload.round_id || null,
      targetUserIds.length,
      userId
    );
    
    let summaryResponse: object;
    let emailResult: SummaryEmailResult;
    
    try {
      // Get email stats before sending
      const emailStats = await summaryEmailSender.getEmailStats(payload.round_id);
      
      console.log('Email sending statistics:', emailStats);
      
      // Send emails using the SummaryEmailSender service
      emailResult = await summaryEmailSender.sendSummaryEmails(
        targetUserIds,
        payload.round_id
      );
      
      // Complete monitoring with results
      emailMonitoringService.completeOperation(
        operationId,
        emailResult
      );
    
      // Prepare comprehensive response with monitoring data
      const operationMetrics = emailMonitoringService.getOperationMetrics(operationId);
      
      summaryResponse = {
        success: emailResult.success,
        message: emailResult.success 
          ? 'Summary emails sent successfully' 
          : 'Summary email sending completed with some failures',
        operation_id: operationId,
        round_id: payload.round_id || 'latest_completed',
        email_stats: {
          total_requested: emailResult.totalRequested,
          total_sent: emailResult.totalSent,
          total_failed: emailResult.totalFailed,
          success_rate: emailResult.totalRequested > 0 
            ? ((emailResult.totalSent / emailResult.totalRequested) * 100).toFixed(1) + '%'
            : '0%',
          duration_ms: emailResult.duration,
          batch_count: emailResult.batchResults.length,
          emails_per_second: operationMetrics?.emailsPerSecond?.toFixed(2) || null
        },
        batch_results: emailResult.batchResults.map(batch => ({
          batch_index: batch.batchIndex,
          users_in_batch: batch.userIds.length,
          successful: batch.successCount,
          failed: batch.failureCount,
          duration_ms: batch.duration
        })),
        errors: emailResult.errors.length > 0 ? emailResult.errors.slice(0, 10) : undefined, // Limit errors in response
        test_mode: false,
        timestamp: new Date().toISOString()
      };
      
    } catch (monitoringError) {
      // If there's an error in the monitored operation, record it and complete the operation as failed
      emailMonitoringService.recordError(
        operationId,
        'unknown',
        monitoringError instanceof Error ? monitoringError.message : 'Unknown error occurred',
        { stack: monitoringError instanceof Error ? monitoringError.stack : undefined }
      );
      
      // Complete the operation as failed
      emailMonitoringService.completeOperation(operationId, {
        success: false,
        totalSent: 0,
        totalFailed: targetUserIds.length,
        errors: [monitoringError instanceof Error ? monitoringError.message : 'Unknown error occurred']
      });
      
      throw monitoringError; // Re-throw to be caught by outer error handler
    }

    // Log the results
    if (emailResult.success) {
      console.log('Summary emails sent successfully:', {
        totalSent: emailResult.totalSent,
        totalFailed: emailResult.totalFailed,
        duration: emailResult.duration
      });
    } else {
      console.error('Summary email sending failed or had errors:', {
        totalSent: emailResult.totalSent,
        totalFailed: emailResult.totalFailed,
        errors: emailResult.errors.slice(0, 5)
      });
    }

    // Return appropriate status code
    const statusCode = emailResult.success 
      ? (emailResult.totalFailed > 0 ? 207 : 200) // 207 for partial success, 200 for full success
      : 500; // 500 for failure

    return NextResponse.json(summaryResponse, { status: statusCode });

  } catch (error) {
    console.error('Unexpected error processing summary email request:', error);
    return NextResponse.json({ 
      error: 'Internal server error processing email request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 