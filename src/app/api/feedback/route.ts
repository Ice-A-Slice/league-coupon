import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

// Admin emails to send feedback to
const ADMIN_EMAILS = [
  'arnarsteinnjohannsson@gmail.com',
  'pierluigi@apl.zone'
];

export async function POST(request: Request) {
  try {
    const { message, userEmail, userName, currentPage } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    logger.info('Received feedback submission', {
      userEmail: userEmail || 'anonymous',
      userName: userName || 'anonymous',
      currentPage,
      messageLength: message.length,
    });

    // Prepare email content
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fromInfo = userEmail 
      ? `${userName ? `${userName} (${userEmail})` : userEmail}`
      : 'Anonymous User';

    const emailSubject = `TippSlottet Feedback - ${currentPage || 'Unknown Page'}`;
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TippSlottet Feedback</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3B82F6, #1E40AF); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; }
    .message { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3B82F6; margin: 15px 0; }
    .meta { color: #6c757d; font-size: 14px; margin-top: 15px; }
    .meta strong { color: #495057; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📝 New Feedback - TippSlottet</h1>
  </div>
  
  <div class="content">
    <div class="meta">
      <p><strong>From:</strong> ${fromInfo}</p>
      <p><strong>Page:</strong> ${currentPage || 'Unknown'}</p>
      <p><strong>Submitted:</strong> ${timestamp} UTC</p>
    </div>
    
    <div class="message">
      <h3 style="margin-top: 0; color: #1E40AF;">Message:</h3>
      <p style="white-space: pre-wrap; line-height: 1.5; margin: 0;">${message}</p>
    </div>
    
    <div class="meta">
      <p style="font-size: 12px; color: #6c757d;">
        This feedback was automatically sent from the TippSlottet application.
      </p>
    </div>
  </div>
</body>
</html>`;

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
        from: 'TippSlottet Feedback <noreply@apl.zone>',
        to: ADMIN_EMAILS,
        subject: emailSubject,
        html: emailHtml,
        ...(userEmail && { reply_to: userEmail }), // Allow admins to reply directly
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();

    logger.info('Feedback email sent successfully', {
      emailId: result.id,
      recipients: ADMIN_EMAILS,
      userEmail: userEmail || 'anonymous',
      currentPage,
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback sent successfully',
    });

  } catch (error) {
    logger.error('Failed to send feedback email', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { 
        error: 'Failed to send feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}