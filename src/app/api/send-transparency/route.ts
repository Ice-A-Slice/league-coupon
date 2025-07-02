import { NextResponse } from 'next/server';
import React from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { render } from '@react-email/render';
import { TransparencyEmail } from '@/components/emails/TransparencyEmail';
import { getAllUsersPredictionsForRound } from '@/lib/userDataAggregationService';
import { sendEmail } from '@/lib/resend';
import { emailMonitoringService } from '@/lib/emailMonitoringService';
import { logger } from '@/utils/logger';

/**
 * Validation schema for transparency email request
 */
const transparencyEmailRequestSchema = z.object({
  round_id: z.number(),
  user_ids: z.array(z.string().uuid()).optional(), // If provided, send only to these users
});

/**
 * Send transparency emails showing all users' predictions for a round
 * POST /api/send-transparency
 */
export async function POST(request: Request) {
  logger.info('API: send-transparency endpoint called');

  let operationId: string | null = null;

  try {
    // Authentication: Support both server-to-server (cron) and user session authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isServerCall = authHeader === `Bearer ${cronSecret}`;

    if (!isServerCall) {
      // For non-server calls, require user authentication
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

      // Check user authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        logger.error('Transparency API: Authentication failed', { error: userError });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      logger.info(`User ${user.id} attempting to send transparency emails`);
    } else {
      logger.info('Server-to-server authentication successful for transparency emails');
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = transparencyEmailRequestSchema.parse(body);
    const { round_id, user_ids } = validatedData;

    logger.info(`Processing transparency email for round ${round_id}`);

    // Create Supabase client for data operations (using service role for both cases)
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

    // Get all users' predictions for this round
    const transparencyData = await getAllUsersPredictionsForRound(round_id);

    if (!transparencyData || transparencyData.users.length === 0) {
      logger.warn(`No predictions found for round ${round_id}`);
      return NextResponse.json(
        { 
          success: false, 
          message: `No predictions found for round ${round_id}` 
        },
        { status: 404 }
      );
    }

    // Get list of users to send emails to
    let targetUsers;
    if (user_ids) {
      // Send to specific users only
      targetUsers = transparencyData.users.filter(user => 
        user_ids.includes(user.userId)
      );
    } else {
      // Send to all users who made predictions
      targetUsers = transparencyData.users;
    }

    if (targetUsers.length === 0) {
      logger.warn(`No target users found for transparency email`);
      return NextResponse.json(
        { 
          success: false, 
          message: 'No target users found' 
        },
        { status: 404 }
      );
    }

    logger.info(`Sending transparency emails to ${targetUsers.length} users`);

    // Start monitoring operation
    operationId = emailMonitoringService.startOperation(
      'notification', // Closest type to transparency
      round_id,
      targetUsers.length,
      null
    );

    // Send emails to each user
    const emailResults = [];
    for (const user of targetUsers) {
      try {
        // Get user profile for email address
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', user.userId)
          .single();

        if (profileError || !profile?.email) {
          logger.error(`Failed to get email for user ${user.userId}:`, profileError);
          emailResults.push({
            userId: user.userId,
            success: false,
            error: `No email found for user ${user.userId}`
          });
          continue;
        }

        // Generate email HTML
        const emailHtml = await render(
          React.createElement(TransparencyEmail, {
            data: transparencyData
          })
        );

        // Send email
        const emailResponse = await sendEmail({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@tippslottet.com',
          to: [profile.email],
          subject: `Round ${transparencyData.roundName} - All Predictions Revealed`,
          html: emailHtml,
          tags: [
            { name: 'type', value: 'transparency' },
            { name: 'round', value: round_id.toString() }
          ]
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error);
        }

        emailResults.push({
          userId: user.userId,
          email: profile.email,
          success: true,
          messageId: emailResponse.id
        });

        logger.info(`Transparency email sent successfully to ${profile.email}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send transparency email to user ${user.userId}:`, errorMessage);
        
        emailResults.push({
          userId: user.userId,
          success: false,
          error: errorMessage
        });
      }
    }

    // Count results
    const successCount = emailResults.filter(result => result.success).length;
    const failureCount = emailResults.length - successCount;

    // Update transparency_sent_at in database if any emails were sent successfully
    if (successCount > 0) {
      const { error: updateError } = await supabase
        .from('betting_rounds')
        .update({ transparency_sent_at: new Date().toISOString() })
        .eq('id', round_id);

      if (updateError) {
        logger.error(`Failed to update transparency_sent_at for round ${round_id}:`, updateError);
      } else {
        logger.info(`Updated transparency_sent_at for round ${round_id}`);
      }
    }

    // Complete monitoring operation
    emailMonitoringService.completeOperation(operationId, {
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: failureCount
    });

    // Return results
    return NextResponse.json({
      success: successCount > 0,
      message: `Transparency emails processed: ${successCount} sent, ${failureCount} failed`,
      roundId: round_id,
      totalTargeted: targetUsers.length,
      successCount,
      failureCount,
      results: emailResults
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('send-transparency endpoint error:', errorMessage);

    if (operationId) {
      emailMonitoringService.completeOperation(operationId, {
        success: false,
        totalSent: 0,
        totalFailed: 1,
        errors: [errorMessage]
      });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request data', 
          errors: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: errorMessage
      },
      { status: 500 }
    );
  }
} 