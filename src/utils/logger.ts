/*
// Temporarily disabling Pino logger for debugging worker issues
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// Configure Pino options
const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'), // Default level
};

// Use pino-pretty only in development for readability
if (isDevelopment) {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard', // Use system's standard time format
      ignore: 'pid,hostname', // Ignore less relevant fields in dev
    },
  };
}

// Create and export the logger instance
// export const logger = pino(pinoOptions); 
*/

// --- Temporary Console Logger --- 
// Basic console logging replacement for debugging
const simpleLogger = {
    info: (...args: any[]) => console.log('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
    // Add other levels like trace, fatal if used elsewhere, mapping to console.log/debug
    fatal: (...args: any[]) => console.error('[FATAL]', ...args),
    trace: (...args: any[]) => console.debug('[TRACE]', ...args),
};

export const logger = simpleLogger;
// --- End Temporary Console Logger --- 