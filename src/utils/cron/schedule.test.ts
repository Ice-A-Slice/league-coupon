import {
  validateCronSchedule,
  validateTimezone,
  getCronConfiguration,
  validateCronConfiguration,
  describeCronSchedule,
  getNextExecutionTime,
  checkDaylightSavingTime,
  DEFAULT_SCHEDULES,
  SUPPORTED_TIMEZONES,
  SupportedTimezone
} from './schedule';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('Cron Schedule Utilities', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.SEASON_COMPLETION_SCHEDULE;
    delete process.env.WINNER_DETERMINATION_SCHEDULE;
    delete process.env.CRON_TIMEZONE;
    delete process.env.SEASON_COMPLETION_ENABLED;
    delete process.env.WINNER_DETERMINATION_ENABLED;
  });

  describe('validateCronSchedule', () => {
    it('should validate correct cron schedules', () => {
      expect(validateCronSchedule('0 2 * * 0')).toBe(true); // Sunday 2 AM
      expect(validateCronSchedule('0 3 * * *')).toBe(true); // Daily 3 AM
      expect(validateCronSchedule('30 14 * * 1')).toBe(true); // Monday 2:30 PM
      expect(validateCronSchedule('0 0 1 1 *')).toBe(true); // Jan 1st midnight
      expect(validateCronSchedule('* * * * *')).toBe(true); // Every minute
    });

    it('should reject invalid cron schedules', () => {
      expect(validateCronSchedule('')).toBe(false);
      expect(validateCronSchedule('invalid')).toBe(false);
      expect(validateCronSchedule('60 0 * * *')).toBe(false); // Invalid minute
      expect(validateCronSchedule('0 25 * * *')).toBe(false); // Invalid hour
      expect(validateCronSchedule('0 0 32 * *')).toBe(false); // Invalid day
      expect(validateCronSchedule('0 0 * 13 *')).toBe(false); // Invalid month
      expect(validateCronSchedule('0 0 * * 7')).toBe(false); // Invalid day of week
      expect(validateCronSchedule('0 0 * *')).toBe(false); // Too few parts
      expect(validateCronSchedule('0 0 * * * *')).toBe(false); // Too many parts
    });

    it('should handle null and undefined inputs', () => {
      expect(validateCronSchedule(null as unknown as string)).toBe(false);
      expect(validateCronSchedule(undefined as unknown as string)).toBe(false);
    });
  });

  describe('validateTimezone', () => {
    it('should validate supported timezones', () => {
      expect(validateTimezone('UTC')).toBe(true);
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('Europe/Stockholm')).toBe(true);
      expect(validateTimezone('Asia/Tokyo')).toBe(true);
    });

    it('should reject unsupported timezones', () => {
      expect(validateTimezone('Invalid/Timezone')).toBe(false);
      expect(validateTimezone('EST')).toBe(false);
      expect(validateTimezone('')).toBe(false);
      expect(validateTimezone('America/Unknown')).toBe(false);
    });
  });

  describe('getCronConfiguration', () => {
    it('should return default configuration', () => {
      const config = getCronConfiguration();

      expect(config.seasonCompletion.schedule).toBe('0 2 * * 0');
      expect(config.seasonCompletion.timezone).toBe('UTC');
      expect(config.seasonCompletion.enabled).toBe(true);
      expect(config.seasonCompletion.description).toContain('Weekly season completion');

      expect(config.winnerDetermination.schedule).toBe('0 3 * * *');
      expect(config.winnerDetermination.timezone).toBe('UTC');
      expect(config.winnerDetermination.enabled).toBe(true);
      expect(config.winnerDetermination.description).toContain('Daily winner determination');
    });

    it('should use environment variables when set', () => {
      process.env.SEASON_COMPLETION_SCHEDULE = '0 4 * * 1';
      process.env.WINNER_DETERMINATION_SCHEDULE = '0 5 * * *';
      process.env.CRON_TIMEZONE = 'America/New_York';
      process.env.SEASON_COMPLETION_ENABLED = 'false';
      process.env.WINNER_DETERMINATION_ENABLED = 'false';

      // Clear module cache and re-import to pick up env vars
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCronConfiguration: freshGetCronConfiguration } = require('./schedule');
      const config = freshGetCronConfiguration();

      expect(config.seasonCompletion.schedule).toBe('0 4 * * 1');
      expect(config.seasonCompletion.timezone).toBe('America/New_York');
      expect(config.seasonCompletion.enabled).toBe(false);

      expect(config.winnerDetermination.schedule).toBe('0 5 * * *');
      expect(config.winnerDetermination.timezone).toBe('America/New_York');
      expect(config.winnerDetermination.enabled).toBe(false);
    });

    it('should fallback to UTC for invalid timezone', () => {
      process.env.CRON_TIMEZONE = 'Invalid/Timezone';

      const config = getCronConfiguration();

      expect(config.seasonCompletion.timezone).toBe('UTC');
      expect(config.winnerDetermination.timezone).toBe('UTC');
    });
  });

  describe('validateCronConfiguration', () => {
    it('should validate correct configuration', () => {
      const config = getCronConfiguration();
      const validation = validateCronConfiguration(config);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid schedules', () => {
      const config = getCronConfiguration();
      config.seasonCompletion.schedule = 'invalid';
      config.winnerDetermination.schedule = '60 0 * * *';

      const validation = validateCronConfiguration(config);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Invalid season completion schedule: 'invalid'");
      expect(validation.errors).toContain("Invalid winner determination schedule: '60 0 * * *'");
    });

    it('should detect invalid timezones', () => {
      const config = getCronConfiguration();
      config.seasonCompletion.timezone = 'Invalid/Timezone' as unknown as SupportedTimezone;

      const validation = validateCronConfiguration(config);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Invalid season completion timezone: 'Invalid/Timezone'");
    });

    it('should warn about schedule conflicts', () => {
      const config = getCronConfiguration();
      config.winnerDetermination.schedule = config.seasonCompletion.schedule;

      const validation = validateCronConfiguration(config);

      expect(validation.warnings).toContain('Season completion and winner determination have the same schedule - consider staggering them');
    });

    it('should warn about disabled jobs', () => {
      const config = getCronConfiguration();
      config.seasonCompletion.enabled = false;
      config.winnerDetermination.enabled = false;

      const validation = validateCronConfiguration(config);

      expect(validation.warnings).toContain('Season completion cron job is disabled');
      expect(validation.warnings).toContain('Winner determination cron job is disabled');
    });
  });

  describe('describeCronSchedule', () => {
    it('should describe common schedules', () => {
      expect(describeCronSchedule('0 2 * * 0')).toBe('Every Sunday at 2:00 AM');
      expect(describeCronSchedule('0 3 * * *')).toBe('Every day at 3:00 AM');
    });

    it('should describe custom schedules', () => {
      expect(describeCronSchedule('30 14 * * 1')).toContain('14:30');
      expect(describeCronSchedule('30 14 * * 1')).toContain('Monday');
    });

    it('should handle invalid schedules', () => {
      expect(describeCronSchedule('invalid')).toBe('Invalid schedule');
      expect(describeCronSchedule('')).toBe('Invalid schedule');
    });
  });

  describe('getNextExecutionTime', () => {
    beforeEach(() => {
      // Mock Date to a specific time for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z')); // Monday
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate next Sunday execution for weekly schedule', () => {
      const nextTime = getNextExecutionTime('0 2 * * 0');
      
      // Should be next Sunday at 2 AM UTC
      expect(nextTime.getUTCDay()).toBe(0); // Sunday
      expect(nextTime.getUTCHours()).toBe(2);
      expect(nextTime.getUTCMinutes()).toBe(0);
    });

    it('should calculate next daily execution', () => {
      const nextTime = getNextExecutionTime('0 3 * * *');
      
      // Should be tomorrow at 3 AM UTC (since current time is 10 AM)
      expect(nextTime.getUTCHours()).toBe(3);
      expect(nextTime.getUTCMinutes()).toBe(0);
    });

    it('should handle edge case when execution time has passed today', () => {
      jest.setSystemTime(new Date('2024-01-15T05:00:00Z')); // 5 AM - after 3 AM execution
      
      const nextTime = getNextExecutionTime('0 3 * * *');
      
      // Should be tomorrow at 3 AM UTC
      expect(nextTime.getUTCDate()).toBe(16); // Next day
      expect(nextTime.getUTCHours()).toBe(3);
    });
  });

  describe('checkDaylightSavingTime', () => {
    it('should detect DST timezones', () => {
      const result = checkDaylightSavingTime('America/New_York');
      
      expect(result.hasDST).toBe(true);
      expect(result.warning).toContain('daylight saving time');
    });

    it('should detect non-DST timezones', () => {
      const result = checkDaylightSavingTime('UTC');
      
      expect(result.hasDST).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it('should handle all supported timezones', () => {
      SUPPORTED_TIMEZONES.forEach(timezone => {
        const result = checkDaylightSavingTime(timezone);
        
        expect(typeof result.hasDST).toBe('boolean');
        if (result.warning) {
          expect(typeof result.warning).toBe('string');
        }
      });
    });
  });

  describe('DEFAULT_SCHEDULES', () => {
    it('should have valid default schedules', () => {
      expect(validateCronSchedule(DEFAULT_SCHEDULES.SEASON_COMPLETION)).toBe(true);
      expect(validateCronSchedule(DEFAULT_SCHEDULES.WINNER_DETERMINATION)).toBe(true);
      expect(validateTimezone(DEFAULT_SCHEDULES.TIMEZONE)).toBe(true);
    });

    it('should use environment variables when available', () => {
      process.env.SEASON_COMPLETION_SCHEDULE = '0 4 * * 1';
      
      // Re-import to get updated DEFAULT_SCHEDULES
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DEFAULT_SCHEDULES: updatedSchedules } = require('./schedule');
      
      expect(updatedSchedules.SEASON_COMPLETION).toBe('0 4 * * 1');
    });
  });

  describe('Integration tests', () => {
    it('should handle complete configuration lifecycle', () => {
      // Set environment variables
      process.env.SEASON_COMPLETION_SCHEDULE = '0 1 * * 0';
      process.env.WINNER_DETERMINATION_SCHEDULE = '0 2 * * *';
      process.env.CRON_TIMEZONE = 'Europe/Stockholm';

      // Clear module cache and re-import to pick up env vars
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCronConfiguration: freshGetCronConfiguration, validateCronConfiguration: freshValidateCronConfiguration, describeCronSchedule: freshDescribeCronSchedule, checkDaylightSavingTime: freshCheckDaylightSavingTime } = require('./schedule');

      // Get configuration
      const config = freshGetCronConfiguration();

      // Validate configuration
      const validation = freshValidateCronConfiguration(config);

      // Should be valid
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Check descriptions
      expect(freshDescribeCronSchedule(config.seasonCompletion.schedule)).toContain('Sunday');
      expect(freshDescribeCronSchedule(config.winnerDetermination.schedule)).toContain('every day');

      // Check DST warnings
      const dstCheck = freshCheckDaylightSavingTime(config.seasonCompletion.timezone);
      expect(dstCheck.hasDST).toBe(true);
    });

    it('should handle error scenarios gracefully', () => {
      // Set invalid environment variables
      process.env.SEASON_COMPLETION_SCHEDULE = 'invalid';
      process.env.CRON_TIMEZONE = 'Invalid/Timezone';

      // Clear module cache and re-import to pick up env vars
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCronConfiguration: freshGetCronConfiguration, validateCronConfiguration: freshValidateCronConfiguration } = require('./schedule');
      
      // Get configuration (should fallback gracefully)
      const config = freshGetCronConfiguration();

      // Should fallback to UTC timezone
      expect(config.seasonCompletion.timezone).toBe('UTC');

      // Validation should catch the invalid schedule
      const validation = freshValidateCronConfiguration(config);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
}); 