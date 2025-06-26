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

    // Test Summary Email
    if (emailType === 'summary' || emailType === 'both') {
      try {
        const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/send-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`
          },
          body: JSON.stringify({
            userEmail,
            roundId,
            test_mode: testMode ?? true, // Default to test mode for manual testing
            force: true // Force send even if timing isn't right
          })
        });

        const summaryData = await summaryResponse.json();
        results.push({
          type: 'summary',
          success: summaryResponse.ok,
          status: summaryResponse.status,
          data: summaryData
        });
      } catch (error) {
        results.push({
          type: 'summary',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test Reminder Email
    if (emailType === 'reminder' || emailType === 'both') {
      try {
        const reminderResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/send-reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`
          },
          body: JSON.stringify({
            userEmail,
            roundId,
            test_mode: testMode ?? true, // Default to test mode for manual testing
            force: true // Force send even if timing isn't right
          })
        });

        const reminderData = await reminderResponse.json();
        results.push({
          type: 'reminder',
          success: reminderResponse.ok,
          status: reminderResponse.status,
          data: reminderData
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