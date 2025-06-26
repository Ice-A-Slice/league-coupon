import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

/**
 * POST /api/test-emails
 * 
 * Manual email testing endpoint for development/staging.
 * Allows triggering emails outside of normal scheduling windows.
 * 
 * Body parameters:
 * - emailType: 'summary' | 'reminder' | 'both'
 * - userEmail: email address to send test to
 * - roundId?: specific round to test with (optional)
 * - testMode?: override EMAIL_TEST_MODE (optional)
 * 
 * Authentication: Requires CRON_SECRET or development environment
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Environment check - only allow in development or with proper auth
    const isDevelopment = process.env.NODE_ENV === 'development';
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const isAuthorized = authHeader === `Bearer ${cronSecret}`;

    if (!isDevelopment && !isAuthorized) {
      return NextResponse.json({ 
        error: 'Unauthorized - test endpoint only available in development or with proper authentication' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { emailType, userEmail, roundId, testMode } = body;

    // Validate required parameters
    if (!emailType || !userEmail) {
      return NextResponse.json({ 
        error: 'Missing required parameters: emailType and userEmail' 
      }, { status: 400 });
    }

    if (!['summary', 'reminder', 'both'].includes(emailType)) {
      return NextResponse.json({ 
        error: 'Invalid emailType. Must be: summary, reminder, or both' 
      }, { status: 400 });
    }

    logger.info('Manual email test triggered', {
      emailType,
      userEmail: userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email for privacy
      roundId,
      testMode,
      environment: process.env.NODE_ENV
    });

    const results = [];

    // Test Summary Email - Using direct service calls instead of API routes
    if (emailType === 'summary' || emailType === 'both') {
      try {
        // Import email services dynamically
        const { sendEmail } = await import('@/lib/resend');
        const { SummaryEmail } = await import('@/components/emails');
        const { EmailDataService } = await import('@/lib/emailDataService');
        const { supabaseServerClient } = await import('@/lib/supabase/server');
        
        // Get user ID from email (or create a test user ID if testing)
        let userId: string;
        
        if (testMode) {
          // In test mode, use a mock user ID
          userId = 'test-user-' + Math.random().toString(36).substring(7);
        } else {
          const { data: userProfile } = await supabaseServerClient
            .from('profiles')
            .select('id')
            .eq('email', userEmail)
            .single();

          if (!userProfile) {
            throw new Error(`No user found with email: ${userEmail}. Try using "testMode": true to bypass database lookup.`);
          }
          
          userId = userProfile.id;
        }

        // Create service instance and get email props
        const emailDataService = new EmailDataService();
        const emailProps = await emailDataService.getSummaryEmailProps(userId, roundId);
        
        // Send the email
        const result = await sendEmail({
          to: userEmail,
          from: 'noreply@tippslottet.com',
          subject: `Week ${emailProps.roundNumber} Summary - Your Football Predictions`,
          react: SummaryEmail(emailProps),
          tags: [
            { name: 'type', value: 'summary' },
            { name: 'source', value: 'manual-test' }
          ]
        });

        results.push({
          type: 'summary',
          success: result.success,
          data: {
            ...result,
            email_preview: {
              roundNumber: emailProps.roundNumber,
              user: emailProps.user.name,
              matchCount: emailProps.matches.length
            }
          }
        });
      } catch (error) {
        results.push({
          type: 'summary',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test Reminder Email - Using direct service calls instead of API routes
    if (emailType === 'reminder' || emailType === 'both') {
      try {
        // Import email services dynamically
        const { sendEmail } = await import('@/lib/resend');
        const { ReminderEmail } = await import('@/components/emails');
        const { ReminderEmailDataService } = await import('@/lib/reminderEmailDataService');
        const { supabaseServerClient } = await import('@/lib/supabase/server');
        
        // Get user ID from email (or create a test user ID if testing)
        let userId: string;
        
        if (testMode) {
          // In test mode, use a mock user ID
          userId = 'test-user-' + Math.random().toString(36).substring(7);
        } else {
          const { data: userProfile } = await supabaseServerClient
            .from('profiles')
            .select('id')
            .eq('email', userEmail)
            .single();

          if (!userProfile) {
            throw new Error(`No user found with email: ${userEmail}. Try using "testMode": true to bypass database lookup.`);
          }
          
          userId = userProfile.id;
        }

        // Create service instance and get reminder data
        const reminderService = new ReminderEmailDataService();
        const reminderData = await reminderService.getReminderEmailData(userId, roundId);
        
        // Transform to email props
        const emailProps = await reminderService.transformToEmailProps(reminderData, userEmail);
        
        // Send the email
        const result = await sendEmail({
          to: userEmail,
          from: 'noreply@tippslottet.com',
          subject: emailProps.subject,
          react: ReminderEmail(emailProps),
          tags: [
            { name: 'type', value: 'reminder' },
            { name: 'source', value: 'manual-test' }
          ]
        });

        results.push({
          type: 'reminder',
          success: result.success,
          data: {
            ...result,
            email_preview: {
              roundNumber: reminderData.roundContext.roundNumber,
              hasSubmitted: reminderData.submissionStatus.hasSubmitted,
              upcomingFixtures: reminderData.fixtures.upcomingFixtures.length
            }
          }
        });
      } catch (error) {
        results.push({
          type: 'reminder',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    const response = {
      success: successCount === totalCount,
      message: `Manual email test completed: ${successCount}/${totalCount} successful`,
      duration_ms: duration,
      emailType,
      userEmail: userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      results,
      timestamp: new Date().toISOString()
    };

    logger.info('Manual email test completed', response);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Manual email test failed', {
      error: errorMessage,
      duration_ms: duration
    });

    return NextResponse.json({
      success: false,
      error: 'Manual email test failed',
      message: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 