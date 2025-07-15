/**
 * Cron Job Scheduling and Timezone Utilities
 * 
 * This module provides utilities for managing cron job schedules,
 * timezone handling, and configuration validation for automated
 * season completion and winner determination processes.
 */

import { logger } from '@/utils/logger';

/**
 * Default cron schedules for different environments
 */
export const DEFAULT_SCHEDULES = {
  // Season completion detection - weekly on Sundays at 2:00 AM UTC
  SEASON_COMPLETION: process.env.SEASON_COMPLETION_SCHEDULE || '0 2 * * 0',
  
  // Winner determination - daily at 3:00 AM UTC (backup/catch-up)
  WINNER_DETERMINATION: process.env.WINNER_DETERMINATION_SCHEDULE || '0 3 * * *',
  
  // Timezone for consistent execution (default to UTC)
  TIMEZONE: process.env.CRON_TIMEZONE || 'UTC'
} as const;

/**
 * Cron schedule validation patterns
 */
const CRON_PATTERN = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([0-2]?\d|3[01])) (\*|([0-1]?\d)) (\*|([0-6]))$/;

/**
 * Supported timezones for cron job execution
 */
export const SUPPORTED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Stockholm',
  'Asia/Tokyo',
  'Australia/Sydney'
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

/**
 * Cron job configuration interface
 */
export interface CronJobConfig {
  /** The cron schedule expression (e.g., '0 2 * * 0') */
  schedule: string;
  /** The timezone for execution */
  timezone: SupportedTimezone;
  /** Whether the job is enabled */
  enabled: boolean;
  /** Job description for documentation */
  description: string;
}

/**
 * Configuration for all cron jobs
 */
export interface CronConfiguration {
  seasonCompletion: CronJobConfig;
  winnerDetermination: CronJobConfig;
}

/**
 * Validates a cron expression
 * @param schedule - The cron schedule string to validate
 * @returns boolean indicating if the schedule is valid
 */
export function validateCronSchedule(schedule: string): boolean {
  if (!schedule || typeof schedule !== 'string') {
    return false;
  }

  // Remove extra whitespace and check basic format
  const cleanSchedule = schedule.trim();
  if (!CRON_PATTERN.test(cleanSchedule)) {
    return false;
  }

  const parts = cleanSchedule.split(' ');
  if (parts.length !== 5) {
    return false;
  }

  // Validate each part
  const [minute, hour, day, month, dayOfWeek] = parts;
  
  // Minute (0-59)
  if (!isValidCronPart(minute, 0, 59)) return false;
  
  // Hour (0-23)
  if (!isValidCronPart(hour, 0, 23)) return false;
  
  // Day of month (1-31)
  if (!isValidCronPart(day, 1, 31)) return false;
  
  // Month (1-12)
  if (!isValidCronPart(month, 1, 12)) return false;
  
  // Day of week (0-6, where 0 = Sunday)
  if (!isValidCronPart(dayOfWeek, 0, 6)) return false;

  return true;
}

/**
 * Validates a single part of a cron expression
 */
function isValidCronPart(part: string, min: number, max: number): boolean {
  if (part === '*') return true;
  
  const num = parseInt(part, 10);
  if (isNaN(num)) return false;
  
  return num >= min && num <= max;
}

/**
 * Validates a timezone string
 * @param timezone - The timezone string to validate
 * @returns boolean indicating if the timezone is supported
 */
export function validateTimezone(timezone: string): timezone is SupportedTimezone {
  return SUPPORTED_TIMEZONES.includes(timezone as SupportedTimezone);
}

/**
 * Gets the current cron configuration from environment variables
 * @returns CronConfiguration object with current settings
 */
export function getCronConfiguration(): CronConfiguration {
  const config: CronConfiguration = {
    seasonCompletion: {
      schedule: DEFAULT_SCHEDULES.SEASON_COMPLETION,
      timezone: DEFAULT_SCHEDULES.TIMEZONE as SupportedTimezone,
      enabled: process.env.SEASON_COMPLETION_ENABLED !== 'false',
      description: 'Weekly season completion detection - checks for completed seasons and marks them'
    },
    winnerDetermination: {
      schedule: DEFAULT_SCHEDULES.WINNER_DETERMINATION,
      timezone: DEFAULT_SCHEDULES.TIMEZONE as SupportedTimezone,
      enabled: process.env.WINNER_DETERMINATION_ENABLED !== 'false',
      description: 'Daily winner determination - backup processing for any missed winner determinations'
    }
  };

  // Validate timezone
  if (!validateTimezone(config.seasonCompletion.timezone)) {
    logger.warn(`Invalid timezone '${config.seasonCompletion.timezone}', falling back to UTC`);
    config.seasonCompletion.timezone = 'UTC';
    config.winnerDetermination.timezone = 'UTC';
  }

  return config;
}

/**
 * Validates the complete cron configuration
 * @param config - The configuration to validate
 * @returns Object with validation results and any errors
 */
export function validateCronConfiguration(config: CronConfiguration): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate season completion schedule
  if (!validateCronSchedule(config.seasonCompletion.schedule)) {
    errors.push(`Invalid season completion schedule: '${config.seasonCompletion.schedule}'`);
  }

  // Validate winner determination schedule  
  if (!validateCronSchedule(config.winnerDetermination.schedule)) {
    errors.push(`Invalid winner determination schedule: '${config.winnerDetermination.schedule}'`);
  }

  // Validate timezones
  if (!validateTimezone(config.seasonCompletion.timezone)) {
    errors.push(`Invalid season completion timezone: '${config.seasonCompletion.timezone}'`);
  }

  if (!validateTimezone(config.winnerDetermination.timezone)) {
    errors.push(`Invalid winner determination timezone: '${config.winnerDetermination.timezone}'`);
  }

  // Check for schedule conflicts (both running at same time)
  if (config.seasonCompletion.schedule === config.winnerDetermination.schedule) {
    warnings.push('Season completion and winner determination have the same schedule - consider staggering them');
  }

  // Warn if jobs are disabled
  if (!config.seasonCompletion.enabled) {
    warnings.push('Season completion cron job is disabled');
  }

  if (!config.winnerDetermination.enabled) {
    warnings.push('Winner determination cron job is disabled');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Converts a cron schedule to a human-readable description
 * @param schedule - The cron schedule string
 * @returns Human-readable description of the schedule
 */
export function describeCronSchedule(schedule: string): string {
  if (!validateCronSchedule(schedule)) {
    return 'Invalid schedule';
  }

  const [minute, hour, day, , dayOfWeek] = schedule.split(' ');

  // Handle common patterns
  if (schedule === '0 2 * * 0') {
    return 'Every Sunday at 2:00 AM';
  }
  
  if (schedule === '0 3 * * *') {
    return 'Every day at 3:00 AM';
  }

  // Generic description
  let description = 'At ';
  
  if (minute === '0' && hour !== '*') {
    description += `${hour}:00`;
  } else if (minute !== '*' && hour !== '*') {
    description += `${hour}:${minute.padStart(2, '0')}`;
  } else {
    description += `minute ${minute}, hour ${hour}`;
  }

  if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    description += ` on ${days[parseInt(dayOfWeek, 10)]}`;
  } else if (day !== '*') {
    description += ` on day ${day} of the month`;
  } else {
    description += ' every day';
  }

  return description;
}

/**
 * Gets the next execution time for a cron schedule
 * @param schedule - The cron schedule string
 * @param timezone - The timezone for calculation
 * @returns Date object representing the next execution time
 */
export function getNextExecutionTime(schedule: string, _timezone: SupportedTimezone = 'UTC'): Date {
  // This is a simplified implementation
  // In a production app, you'd want to use a library like 'node-cron' or 'cron-parser'
  const now = new Date();
  
  if (schedule === '0 2 * * 0') {
    // Weekly on Sunday at 2 AM
    const nextSunday = new Date(now);
    nextSunday.setUTCDate(now.getUTCDate() + (7 - now.getUTCDay()));
    nextSunday.setUTCHours(2, 0, 0, 0);
    
    // If it's already past this week's execution, go to next week
    if (nextSunday <= now) {
      nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
    }
    
    return nextSunday;
  }
  
  if (schedule === '0 3 * * *') {
    // Daily at 3 AM
    const nextExecution = new Date(now);
    nextExecution.setUTCHours(3, 0, 0, 0);
    
    // If it's already past today's execution, go to tomorrow
    if (nextExecution <= now) {
      nextExecution.setUTCDate(nextExecution.getUTCDate() + 1);
    }
    
    return nextExecution;
  }
  
  // Fallback - just add one hour
  return new Date(now.getTime() + 60 * 60 * 1000);
}

/**
 * Checks if daylight saving time might affect execution
 * @param timezone - The timezone to check
 * @returns Object with DST information
 */
export function checkDaylightSavingTime(timezone: SupportedTimezone): {
  hasDST: boolean;
  warning?: string;
} {
  const dstTimezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Stockholm'
  ];

  const hasDST = dstTimezones.includes(timezone);
  
  return {
    hasDST,
    warning: hasDST 
      ? 'This timezone observes daylight saving time. Cron jobs may be affected by time changes in spring/fall.'
      : undefined
  };
} 