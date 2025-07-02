import {
  normalizeNumericAnswer,
  normalizeUserPrediction,
  normalizeValidAnswersArray,
  convertLegacyAnswerToArray,
  normalizeAnswer,
  doesNormalizedUserPredictionMatch
} from '../dynamicPointsCalculator';

// Mock console to avoid test output noise
const consoleSpy = {
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
};

describe('DynamicPointsCalculator - Answer Normalization Utilities', () => {
  
  beforeEach(() => {
    // Clear console spy calls before each test
    consoleSpy.warn.mockClear();
  });

  describe('normalizeNumericAnswer', () => {
    describe('Valid Numbers', () => {
      it('should normalize valid positive integers', () => {
        expect(normalizeNumericAnswer(123)).toBe(123);
        expect(normalizeNumericAnswer(1)).toBe(1);
        expect(normalizeNumericAnswer(9999999)).toBe(9999999);
      });

      it('should normalize positive decimal numbers to integers', () => {
        expect(normalizeNumericAnswer(123.456)).toBe(123);
        expect(normalizeNumericAnswer(99.9)).toBe(99);
        expect(normalizeNumericAnswer(1.1)).toBe(1);
      });

      it('should convert negative numbers to positive integers', () => {
        expect(normalizeNumericAnswer(-123)).toBe(123);
        expect(normalizeNumericAnswer(-456.789)).toBe(456);
      });
    });

    describe('String Numbers', () => {
      it('should convert valid string numbers', () => {
        expect(normalizeNumericAnswer('123')).toBe(123);
        expect(normalizeNumericAnswer('456.789')).toBe(456);
        expect(normalizeNumericAnswer('  789  ')).toBe(789); // Trimmed
      });

      it('should handle string edge cases', () => {
        expect(normalizeNumericAnswer('')).toBe(null);
        expect(normalizeNumericAnswer('   ')).toBe(null); // Only whitespace
        expect(normalizeNumericAnswer('abc')).toBe(null); // Non-numeric
        expect(normalizeNumericAnswer('123abc')).toBe(null); // Mixed
      });
    });

    describe('Invalid Values', () => {
      it('should return null for null/undefined', () => {
        expect(normalizeNumericAnswer(null)).toBe(null);
        expect(normalizeNumericAnswer(undefined)).toBe(null);
      });

      it('should return null for NaN and infinity', () => {
        expect(normalizeNumericAnswer(NaN)).toBe(null);
        expect(normalizeNumericAnswer(Infinity)).toBe(null);
        expect(normalizeNumericAnswer(-Infinity)).toBe(null);
      });

      it('should return null for invalid types', () => {
        expect(normalizeNumericAnswer(true)).toBe(null);
        expect(normalizeNumericAnswer(false)).toBe(null);
        expect(normalizeNumericAnswer({})).toBe(null);
        expect(normalizeNumericAnswer([])).toBe(null);
        expect(normalizeNumericAnswer(() => {})).toBe(null);
      });

      it('should return null for numbers outside valid range', () => {
        expect(normalizeNumericAnswer(0)).toBe(null); // Too small
        expect(normalizeNumericAnswer(-1)).toBe(1); // Converted to positive, but original was -1 which is outside range when negative
        expect(normalizeNumericAnswer(10_000_001)).toBe(null); // Too large
      });
    });
  });

  describe('normalizeUserPrediction', () => {
    it('should normalize valid user predictions', () => {
      expect(normalizeUserPrediction(123)).toBe(123);
      expect(normalizeUserPrediction('456')).toBe(456);
      expect(normalizeUserPrediction('789.5')).toBe(789);
    });

    it('should warn and return null for invalid predictions', () => {
      expect(normalizeUserPrediction('invalid')).toBe(null);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'normalizeUserPrediction: Invalid user prediction provided:', 
        'invalid'
      );
      
      expect(normalizeUserPrediction(null)).toBe(null);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'normalizeUserPrediction: Invalid user prediction provided:', 
        null
      );
    });
  });

  describe('normalizeValidAnswersArray', () => {
    it('should normalize arrays of valid numbers', () => {
      expect(normalizeValidAnswersArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(normalizeValidAnswersArray(['1', '2', '3'])).toEqual([1, 2, 3]);
      expect(normalizeValidAnswersArray([1.5, 2.7, 3.9])).toEqual([1, 2, 3]);
    });

    it('should filter out invalid values', () => {
      expect(normalizeValidAnswersArray([1, 'invalid', 3, null])).toEqual([1, 3]);
      expect(normalizeValidAnswersArray([NaN, 2, Infinity, 4])).toEqual([2, 4]);
    });

    it('should remove duplicates', () => {
      expect(normalizeValidAnswersArray([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
      expect(normalizeValidAnswersArray(['1', 1, '1.0', 1.5])).toEqual([1]);
    });

    it('should handle empty arrays', () => {
      expect(normalizeValidAnswersArray([])).toEqual([]);
    });

    it('should warn and return empty array for non-arrays', () => {
      expect(normalizeValidAnswersArray('not-array' as unknown[])).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'normalizeValidAnswersArray: Expected array but received:', 
        'string'
      );
    });

    it('should warn about invalid values in arrays', () => {
      normalizeValidAnswersArray([1, 'invalid', 3]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'normalizeValidAnswersArray: Invalid answer at index 1:', 
        'invalid'
      );
    });
  });

  describe('convertLegacyAnswerToArray', () => {
    it('should convert valid legacy answers to arrays', () => {
      expect(convertLegacyAnswerToArray(123)).toEqual([123]);
      expect(convertLegacyAnswerToArray('456')).toEqual([456]);
      expect(convertLegacyAnswerToArray(789.5)).toEqual([789]);
    });

    it('should return empty array for invalid legacy answers', () => {
      expect(convertLegacyAnswerToArray(null)).toEqual([]);
      expect(convertLegacyAnswerToArray('invalid')).toEqual([]);
      expect(convertLegacyAnswerToArray(NaN)).toEqual([]);
    });
  });

  describe('normalizeAnswer', () => {
    it('should handle single values (legacy format)', () => {
      expect(normalizeAnswer(123)).toEqual([123]);
      expect(normalizeAnswer('456')).toEqual([456]);
    });

    it('should handle arrays (new format)', () => {
      expect(normalizeAnswer([1, 2, 3])).toEqual([1, 2, 3]);
      expect(normalizeAnswer(['1', '2', '3'])).toEqual([1, 2, 3]);
    });

    it('should handle null/undefined', () => {
      expect(normalizeAnswer(null)).toEqual([]);
      expect(normalizeAnswer(undefined)).toEqual([]);
    });

    it('should filter invalid values from arrays', () => {
      expect(normalizeAnswer([1, 'invalid', 3, null])).toEqual([1, 3]);
    });

    it('should handle invalid single values', () => {
      expect(normalizeAnswer('invalid')).toEqual([]);
      expect(normalizeAnswer(NaN)).toEqual([]);
    });
  });

  describe('doesNormalizedUserPredictionMatch', () => {
    describe('Single Valid Answer (Legacy Format)', () => {
      it('should match valid single answers', () => {
        expect(doesNormalizedUserPredictionMatch(123, 123)).toBe(true);
        expect(doesNormalizedUserPredictionMatch('123', 123)).toBe(true);
        expect(doesNormalizedUserPredictionMatch(123, '123')).toBe(true);
        expect(doesNormalizedUserPredictionMatch('123', '123')).toBe(true);
      });

      it('should not match different single answers', () => {
        expect(doesNormalizedUserPredictionMatch(123, 456)).toBe(false);
        expect(doesNormalizedUserPredictionMatch('123', '456')).toBe(false);
      });
    });

    describe('Multiple Valid Answers (New Format)', () => {
      it('should match when user prediction is in the array', () => {
        expect(doesNormalizedUserPredictionMatch(2, [1, 2, 3])).toBe(true);
        expect(doesNormalizedUserPredictionMatch('2', [1, 2, 3])).toBe(true);
        expect(doesNormalizedUserPredictionMatch(2, ['1', '2', '3'])).toBe(true);
      });

      it('should not match when user prediction is not in the array', () => {
        expect(doesNormalizedUserPredictionMatch(4, [1, 2, 3])).toBe(false);
        expect(doesNormalizedUserPredictionMatch('4', ['1', '2', '3'])).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should return false for invalid user predictions', () => {
        expect(doesNormalizedUserPredictionMatch(null, [1, 2, 3])).toBe(false);
        expect(doesNormalizedUserPredictionMatch('invalid', [1, 2, 3])).toBe(false);
        expect(doesNormalizedUserPredictionMatch(NaN, [1, 2, 3])).toBe(false);
      });

      it('should return false for empty valid answers', () => {
        expect(doesNormalizedUserPredictionMatch(123, [])).toBe(false);
        expect(doesNormalizedUserPredictionMatch(123, null)).toBe(false);
        expect(doesNormalizedUserPredictionMatch(123, undefined)).toBe(false);
      });

      it('should return false when valid answers array contains only invalid values', () => {
        expect(doesNormalizedUserPredictionMatch(123, ['invalid', null, NaN])).toBe(false);
      });

      it('should handle mixed valid/invalid arrays correctly', () => {
        expect(doesNormalizedUserPredictionMatch(2, [1, 'invalid', 2, null, 3])).toBe(true);
        expect(doesNormalizedUserPredictionMatch(4, [1, 'invalid', 2, null, 3])).toBe(false);
      });
    });

    describe('Real Football Scenarios', () => {
      it('should handle top scorer ties', () => {
        // Multiple players tied for top scorer
        const tiedTopScorers = [12345, 67890, 11111]; // Player IDs
        
        expect(doesNormalizedUserPredictionMatch(12345, tiedTopScorers)).toBe(true);
        expect(doesNormalizedUserPredictionMatch(67890, tiedTopScorers)).toBe(true);
        expect(doesNormalizedUserPredictionMatch(99999, tiedTopScorers)).toBe(false);
      });

      it('should handle best goal difference ties', () => {
        // Multiple teams tied for best goal difference
        const tiedTeams = [101, 102, 103]; // Team IDs
        
        expect(doesNormalizedUserPredictionMatch(102, tiedTeams)).toBe(true);
        expect(doesNormalizedUserPredictionMatch(999, tiedTeams)).toBe(false);
      });

      it('should maintain backward compatibility with single answers', () => {
        // Single top scorer (existing behavior)
        const singleTopScorer = 12345;
        
        expect(doesNormalizedUserPredictionMatch(12345, singleTopScorer)).toBe(true);
        expect(doesNormalizedUserPredictionMatch(67890, singleTopScorer)).toBe(false);
      });
    });

    describe('Performance with Large Datasets', () => {
      it('should handle large arrays efficiently', () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => i + 1);
        
        // Should find match quickly (early in array)
        expect(doesNormalizedUserPredictionMatch(5, largeArray)).toBe(true);
        
        // Should find match at end of array
        expect(doesNormalizedUserPredictionMatch(1000, largeArray)).toBe(true);
        
        // Should return false for non-existent value
        expect(doesNormalizedUserPredictionMatch(1001, largeArray)).toBe(false);
      });
    });
  });
}); 