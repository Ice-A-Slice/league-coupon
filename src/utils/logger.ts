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
export const logger = pino(pinoOptions); 