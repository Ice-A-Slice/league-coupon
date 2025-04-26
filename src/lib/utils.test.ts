import { describe, it, expect } from '@jest/globals';
import { calculateTimeDifference } from './utils'; // Assuming utils.ts is in the same directory

describe('Utility Functions (src/lib/utils.ts)', () => {

  describe('calculateTimeDifference', () => {
    const date1Str = '2024-01-01T10:00:00.000Z';
    const date2Str = '2024-01-01T12:30:00.000Z';
    const date3Str = '2024-01-03T10:00:00.000Z'; // 48 hours after date1

    const date1 = new Date(date1Str);
    const date2 = new Date(date2Str);
    const date3 = new Date(date3Str);

    it('should calculate the difference in hours by default', () => {
      expect(calculateTimeDifference(date1, date2)).toBeCloseTo(2.5);
      expect(calculateTimeDifference(date1Str, date3Str)).toBeCloseTo(48);
    });

    it('should calculate the difference in minutes', () => {
      expect(calculateTimeDifference(date1, date2, 'minutes')).toBeCloseTo(150);
      expect(calculateTimeDifference(date1Str, date3Str, 'minutes')).toBeCloseTo(48 * 60);
    });

    it('should calculate the difference in seconds', () => {
      expect(calculateTimeDifference(date1, date2, 'seconds')).toBeCloseTo(150 * 60);
    });

    it('should calculate the difference in milliseconds', () => {
      expect(calculateTimeDifference(date1, date2, 'milliseconds')).toBe(150 * 60 * 1000);
    });

    it('should handle negative differences correctly', () => {
      expect(calculateTimeDifference(date2, date1)).toBeCloseTo(-2.5); // Hours
      expect(calculateTimeDifference(date2Str, date1Str, 'minutes')).toBeCloseTo(-150);
    });

    it('should return 0 for identical dates', () => {
      expect(calculateTimeDifference(date1, date1)).toBe(0);
      expect(calculateTimeDifference(date1Str, date1Str, 'milliseconds')).toBe(0);
    });
  });

  // TODO: Add describe blocks for other utils like cn, debounce, filterComboboxOptions if needed

}); 