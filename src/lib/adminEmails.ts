/**
 * Utility functions for managing admin email addresses
 */

/**
 * Get super admin emails from environment variable
 * These are admins who receive additional emails like reminders and transparency
 */
export const getSuperAdminEmails = (): string[] => {
  const superAdminEmailsEnv = process.env.SUPER_ADMIN_EMAILS;
  if (!superAdminEmailsEnv) {
    return []; // Return empty array if not configured (optional feature)
  }
  return superAdminEmailsEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);
};

/**
 * Get admin emails from environment variable
 * These are admins who receive admin summary emails
 */
export const getAdminEmails = (): string[] => {
  const adminEmailsEnv = process.env.ADMIN_EMAILS;
  if (!adminEmailsEnv) {
    throw new Error('ADMIN_EMAILS environment variable is not configured');
  }
  return adminEmailsEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);
};