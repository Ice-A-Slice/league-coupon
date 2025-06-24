import { Resend } from 'resend';
import { logger } from '@/utils/logger';

// Environment variable validation
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

if (!RESEND_API_KEY && !EMAIL_TEST_MODE) {
  logger.error('Missing RESEND_API_KEY environment variable and not in test mode');
  throw new Error('Resend API key is required when not in test mode');
}

// Initialize Resend client (only if not in test mode)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Types
export interface EmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResponse {
  success: boolean;
  id?: string;
  error?: string;
  details?: unknown;
}

export interface EmailValidation {
  isValid: boolean;
  errors: string[];
}

// Email validation utility
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate email options
export function validateEmailOptions(options: EmailOptions): EmailValidation {
  const errors: string[] = [];

  // Validate 'to' field
  const toEmails = Array.isArray(options.to) ? options.to : [options.to];
  toEmails.forEach((email, index) => {
    if (!validateEmail(email)) {
      errors.push(`Invalid 'to' email at index ${index}: ${email}`);
    }
  });

  // Validate 'from' field
  if (!validateEmail(options.from)) {
    errors.push(`Invalid 'from' email: ${options.from}`);
  }

  // Validate subject
  if (!options.subject || options.subject.trim().length === 0) {
    errors.push('Subject is required and cannot be empty');
  }

  // Validate content (must have at least one of html, text, or react)
  if (!options.html && !options.text && !options.react) {
    errors.push('Email must have at least one content type: html, text, or react');
  }

  // Validate optional CC emails
  if (options.cc) {
    const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
    ccEmails.forEach((email, index) => {
      if (!validateEmail(email)) {
        errors.push(`Invalid 'cc' email at index ${index}: ${email}`);
      }
    });
  }

  // Validate optional BCC emails
  if (options.bcc) {
    const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
    bccEmails.forEach((email, index) => {
      if (!validateEmail(email)) {
        errors.push(`Invalid 'bcc' email at index ${index}: ${email}`);
      }
    });
  }

  // Validate replyTo if provided
  if (options.replyTo && !validateEmail(options.replyTo)) {
    errors.push(`Invalid 'replyTo' email: ${options.replyTo}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Format email recipients for logging (truncate for privacy)
function formatRecipientsForLog(recipients: string | string[]): string {
  const emails = Array.isArray(recipients) ? recipients : [recipients];
  return emails.map(email => {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }).join(', ');
}

// Main email sending function
export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  const startTime = Date.now();
  
  // Log email send attempt
  logger.info({
    action: 'email_send_start',
    to: formatRecipientsForLog(options.to),
    from: options.from,
    subject: options.subject,
    testMode: EMAIL_TEST_MODE
  }, 'Starting email send');

  // Validate email options
  const validation = validateEmailOptions(options);
  if (!validation.isValid) {
    const errorMsg = `Email validation failed: ${validation.errors.join(', ')}`;
    logger.error({
      action: 'email_send_error',
      error: 'validation_failed',
      errors: validation.errors
    }, errorMsg);
    
    return {
      success: false,
      error: errorMsg,
      details: { validationErrors: validation.errors }
    };
  }

  // Test mode - simulate sending without actual API call
  if (EMAIL_TEST_MODE) {
    const mockId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info({
      action: 'email_send_test_mode',
      mockId,
      to: formatRecipientsForLog(options.to),
      subject: options.subject,
      duration: Date.now() - startTime
    }, 'Email simulated in test mode');
    
    return {
      success: true,
      id: mockId
    };
  }

  // Production mode - send actual email
  if (!resend) {
    const errorMsg = 'Resend client not initialized';
    logger.error({ action: 'email_send_error', error: 'client_not_initialized' }, errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }

  try {
    const result = await resend.emails.send({
      to: options.to,
      from: options.from,
      subject: options.subject,
      html: options.html,
      text: options.text,
      react: options.react,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      tags: options.tags
    });

    if (result.error) {
      logger.error({
        action: 'email_send_error',
        error: 'resend_api_error',
        resendError: result.error,
        duration: Date.now() - startTime
      }, 'Resend API returned error');
      
      return {
        success: false,
        error: result.error.message || 'Unknown Resend API error',
        details: result.error
      };
    }

    logger.info({
      action: 'email_send_success',
      emailId: result.data?.id,
      to: formatRecipientsForLog(options.to),
      duration: Date.now() - startTime
    }, 'Email sent successfully');

    return {
      success: true,
      id: result.data?.id
    };

  } catch (error) {
    logger.error({
      action: 'email_send_error',
      error: 'unexpected_error',
      err: error,
      duration: Date.now() - startTime
    }, 'Unexpected error sending email');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error
    };
  }
}

// Utility function for sending simple text emails
export async function sendSimpleEmail(
  to: string | string[],
  subject: string,
  content: string,
  from: string = 'noreply@tippslottet.com'
): Promise<EmailResponse> {
  return sendEmail({
    to,
    from,
    subject,
    text: content,
    html: content.replace(/\n/g, '<br>')
  });
}

// Test connection function
export async function testEmailConnection(testEmail: string = 'test@example.com'): Promise<EmailResponse> {
  logger.info({ action: 'email_test_connection' }, 'Testing email service connection');
  
  return sendSimpleEmail(
    testEmail,
    'Email Service Test',
    'This is a test email to verify the email service connection is working correctly.',
    'test@tippslottet.com'
  );
}

// Get email service status
export function getEmailServiceStatus(): { 
  configured: boolean; 
  testMode: boolean; 
  apiKeyPresent: boolean; 
} {
  return {
    configured: !!(RESEND_API_KEY || EMAIL_TEST_MODE),
    testMode: EMAIL_TEST_MODE,
    apiKeyPresent: !!RESEND_API_KEY
  };
}

// Export the resend client for advanced usage (if needed)
export { resend }; 