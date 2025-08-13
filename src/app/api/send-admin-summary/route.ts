import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { emailDataService } from '@/lib/emailDataService';
import { logger } from '@/utils/logger';
import { render } from '@react-email/render';
import AdminSummaryEmail from '@/components/emails/AdminSummaryEmail';
import { headers } from 'next/headers';

// Admin emails to send summary to
const ADMIN_EMAILS = [
  'arnarsteinnjohannnsson@gmail.com',
  'pierluigi@apl.zone'
];

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const headersList = await headers();
    const cronSecret = headersList.get('authorization');
    
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized admin summary email request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roundId } = await request.json();

    if (!roundId) {
      return NextResponse.json({ error: 'Round ID is required' }, { status: 400 });
    }

    logger.info('Starting admin summary email send', { roundId });

    // Get admin summary data
    const adminSummaryData = await emailDataService.getAdminSummaryEmailProps(roundId);

    // Render email HTML
    const emailHtml = await render(AdminSummaryEmail(adminSummaryData));

    // Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'APL League Coupon <noreply@apl.zone>',
        to: ADMIN_EMAILS,
        subject: `📊 ${adminSummaryData.roundName} Admin Summary - ${adminSummaryData.totalParticipants} participants`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();

    // Update round to mark admin summary as sent
    const supabase = createSupabaseServiceRoleClient();
    const { error: updateError } = await supabase
      .from('betting_rounds')
      .update({ admin_summary_sent_at: new Date().toISOString() })
      .eq('id', roundId);

    if (updateError) {
      logger.warn('Failed to update admin_summary_sent_at', { 
        roundId, 
        error: updateError.message 
      });
    }

    logger.info('Admin summary email sent successfully', {
      roundId,
      roundName: adminSummaryData.roundName,
      recipients: ADMIN_EMAILS,
      emailId: result.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin summary email sent successfully',
      emailId: result.id,
      recipients: ADMIN_EMAILS,
    });

  } catch (error) {
    logger.error('Failed to send admin summary email', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { 
        error: 'Failed to send admin summary email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}