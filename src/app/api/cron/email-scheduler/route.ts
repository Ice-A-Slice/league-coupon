import { NextResponse } from 'next/server';
import { runEmailSchedulingCheck } from '@/lib/emailScheduler';
import { logger } from '@/utils/logger';

/**
 * GET /api/cron/email-scheduler
 * 
 * Cron endpoint for automated email scheduling.
 * This endpoint should be called periodically (e.g., every hour) to:
 * - Check for completed rounds and trigger summary emails
 * - Check for upcoming rounds and trigger reminder emails (24h before start)
 * 
 * Authentication: Requires CRON_SECRET environment variable
 * 
 * Returns:
 * - 200: Success with scheduling results
 * - 401: Unauthorized (missing or invalid CRON_SECRET)
 * - 500: Internal server error
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  logger.info('EmailScheduler: Starting cron job for email scheduling...');

  // Authenticate cron job using secret (support both Bearer and X-Cron-Secret headers)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');
  
  const isValidAuth = cronSecret && (
    authHeader === `Bearer ${cronSecret}` || 
    cronSecretHeader === cronSecret
  );
  
  if (!isValidAuth) {
    logger.error('EmailScheduler: Unauthorized attempt to run email scheduling cron job', {
      hasSecret: !!cronSecret,
      hasAuth: !!authHeader,
      hasCronHeader: !!cronSecretHeader,
      authMatches: authHeader === `Bearer ${cronSecret}`,
      cronHeaderMatches: cronSecretHeader === cronSecret
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run the email scheduling check
    const results = await runEmailSchedulingCheck();
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Analyze results
    const totalOpportunities = results.length;
    const successfulOperations = results.filter(r => r.success).length;
    const failedOperations = results.filter(r => !r.success).length;
    const summaryEmails = results.filter(r => r.emailType === 'summary').length;
    const reminderEmails = results.filter(r => r.emailType === 'reminder').length;
    const transparencyEmails = results.filter(r => r.emailType === 'transparency').length;
    const adminSummaryEmails = results.filter(r => r.emailType === 'admin-summary').length;

    const summary = {
      success: true,
      message: 'Email scheduling check completed',
      duration_ms: duration,
      total_opportunities: totalOpportunities,
      successful_operations: successfulOperations,
      failed_operations: failedOperations,
      summary_emails: summaryEmails,
      reminder_emails: reminderEmails,
      transparency_emails: transparencyEmails,
      admin_summary_emails: adminSummaryEmails,
      timestamp: new Date().toISOString()
    };

    logger.info('EmailScheduler: Cron job completed successfully', summary);

    // Include detailed results in response for debugging
    return NextResponse.json({
      ...summary,
      detailed_results: results
    }, { status: 200 });

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('EmailScheduler: Cron job failed', {
      error: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      error: 'Email scheduling check failed',
      message: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 