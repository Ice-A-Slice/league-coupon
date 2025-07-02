import {
  ValidAnswer,
  AnswerComparisonData,
  isMultipleAnswer,
  isSingleAnswer,
  normalizeAnswerToArray,
  doesUserPredictionMatch
} from '../dynamicPointsCalculator';

describe('DynamicPointsCalculator - Type Definitions and Utilities', () => {
  
  describe('Type Guards', () => {
    describe('isMultipleAnswer', () => {
      it('should return true for arrays', () => {
        expect(isMultipleAnswer([1, 2, 3])).toBe(true);
        expect(isMultipleAnswer([42])).toBe(true);
        expect(isMultipleAnswer([])).toBe(true);
      });

      it('should return false for single numbers', () => {
        expect(isMultipleAnswer(42)).toBe(false);
        expect(isMultipleAnswer(0)).toBe(false);
        expect(isMultipleAnswer(-1)).toBe(false);
      });

      it('should return false for NaN', () => {
        expect(isMultipleAnswer(Number.NaN)).toBe(false);
      });
    });

    describe('isSingleAnswer', () => {
      it('should return true for valid numbers', () => {
        expect(isSingleAnswer(42)).toBe(true);
        expect(isSingleAnswer(0)).toBe(true);
        expect(isSingleAnswer(-1)).toBe(true);
        expect(isSingleAnswer(1.5)).toBe(true);
      });

      it('should return false for arrays', () => {
        expect(isSingleAnswer([1, 2, 3])).toBe(false);
        expect(isSingleAnswer([42])).toBe(false);
        expect(isSingleAnswer([])).toBe(false);
      });

      it('should return false for NaN', () => {
        expect(isSingleAnswer(Number.NaN)).toBe(false);
      });
    });
  });

  describe('normalizeAnswerToArray', () => {
    it('should return arrays unchanged', () => {
      expect(normalizeAnswerToArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(normalizeAnswerToArray([42])).toEqual([42]);
      expect(normalizeAnswerToArray([])).toEqual([]);
    });

    it('should convert single numbers to single-item arrays', () => {
      expect(normalizeAnswerToArray(42)).toEqual([42]);
      expect(normalizeAnswerToArray(0)).toEqual([0]);
      expect(normalizeAnswerToArray(-1)).toEqual([-1]);
    });

    it('should handle edge cases', () => {
      expect(normalizeAnswerToArray(Number.NaN)).toEqual([Number.NaN]);
    });
  });

  describe('doesUserPredictionMatch', () => {
    describe('Single Valid Answer Scenarios', () => {
      it('should return true when user prediction matches single valid answer', () => {
        expect(doesUserPredictionMatch(42, 42)).toBe(true);
        expect(doesUserPredictionMatch(0, 0)).toBe(true);
        expect(doesUserPredictionMatch(-1, -1)).toBe(true);
      });

      it('should return false when user prediction does not match single valid answer', () => {
        expect(doesUserPredictionMatch(42, 43)).toBe(false);
        expect(doesUserPredictionMatch(1, 0)).toBe(false);
        expect(doesUserPredictionMatch(42, -1)).toBe(false);
      });
    });

    describe('Multiple Valid Answers Scenarios', () => {
      it('should return true when user prediction matches one of multiple valid answers', () => {
        expect(doesUserPredictionMatch(42, [40, 41, 42])).toBe(true);
        expect(doesUserPredictionMatch(40, [40, 41, 42])).toBe(true);
        expect(doesUserPredictionMatch(41, [40, 41, 42])).toBe(true);
      });

      it('should return false when user prediction does not match any valid answer', () => {
        expect(doesUserPredictionMatch(39, [40, 41, 42])).toBe(false);
        expect(doesUserPredictionMatch(43, [40, 41, 42])).toBe(false);
        expect(doesUserPredictionMatch(0, [40, 41, 42])).toBe(false);
      });

      it('should return true when user prediction matches single item in array', () => {
        expect(doesUserPredictionMatch(42, [42])).toBe(true);
      });

      it('should return false when user prediction does not match single item in array', () => {
        expect(doesUserPredictionMatch(41, [42])).toBe(false);
      });

      it('should return false for empty valid answers array', () => {
        expect(doesUserPredictionMatch(42, [])).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle NaN values correctly', () => {
        expect(doesUserPredictionMatch(Number.NaN, Number.NaN)).toBe(false); // NaN !== NaN
        expect(doesUserPredictionMatch(42, Number.NaN)).toBe(false);
        expect(doesUserPredictionMatch(Number.NaN, [1, 2, 3])).toBe(false);
        expect(doesUserPredictionMatch(1, [Number.NaN, 2, 3])).toBe(false); // NaN will not match
      });

      it('should handle zero values correctly', () => {
        expect(doesUserPredictionMatch(0, 0)).toBe(true);
        expect(doesUserPredictionMatch(0, [0, 1, 2])).toBe(true);
        expect(doesUserPredictionMatch(1, [0, 1, 2])).toBe(true);
      });

      it('should handle negative values correctly', () => {
        expect(doesUserPredictionMatch(-1, -1)).toBe(true);
        expect(doesUserPredictionMatch(-1, [-1, 0, 1])).toBe(true);
        expect(doesUserPredictionMatch(-2, [-1, 0, 1])).toBe(false);
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should allow ValidAnswer to accept both numbers and arrays', () => {
      // These should compile without TypeScript errors
      const singleAnswer: ValidAnswer = 42;
      const multipleAnswers: ValidAnswer = [40, 41, 42];
      const emptyAnswers: ValidAnswer = [];

      expect(typeof singleAnswer).toBe('number');
      expect(Array.isArray(multipleAnswers)).toBe(true);
      expect(Array.isArray(emptyAnswers)).toBe(true);
    });

    it('should allow AnswerComparisonData to handle mixed answer types', () => {
      // Test Phase 1 implementation structure
      const answerData: AnswerComparisonData = {
        topScorerAnswer: [33, 40, 50], // Multiple tied top scorers
        bestGoalDifferenceAnswer: [1, 2], // Multiple tied teams
        leagueWinnerAnswer: 33, // Single current leader
        lastPlaceAnswer: 20 // Single last place team
      };

      expect(isMultipleAnswer(answerData.topScorerAnswer)).toBe(true);
      expect(isMultipleAnswer(answerData.bestGoalDifferenceAnswer)).toBe(true);
      expect(isSingleAnswer(answerData.leagueWinnerAnswer)).toBe(true);
      expect(isSingleAnswer(answerData.lastPlaceAnswer)).toBe(true);
    });

    it('should allow AnswerComparisonData to handle legacy single answer format', () => {
      // Test backward compatibility with existing single-answer format
      const legacyAnswerData: AnswerComparisonData = {
        topScorerAnswer: 33, // Single top scorer (legacy format)
        bestGoalDifferenceAnswer: 1, // Single team (legacy format)
        leagueWinnerAnswer: 33, // Single current leader
        lastPlaceAnswer: 20 // Single last place team
      };

      expect(isSingleAnswer(legacyAnswerData.topScorerAnswer)).toBe(true);
      expect(isSingleAnswer(legacyAnswerData.bestGoalDifferenceAnswer)).toBe(true);
      expect(isSingleAnswer(legacyAnswerData.leagueWinnerAnswer)).toBe(true);
      expect(isSingleAnswer(legacyAnswerData.lastPlaceAnswer)).toBe(true);
    });
  });

  describe('Integration with Utility Functions', () => {
    it('should work correctly with realistic football data scenarios', () => {
      // Scenario: Two players tied for top scorer with 15 goals each
      const tiedTopScorers = [101, 202]; // Player IDs
      
      // User predicted player 101 (should get points)
      expect(doesUserPredictionMatch(101, tiedTopScorers)).toBe(true);
      
      // User predicted player 202 (should get points)
      expect(doesUserPredictionMatch(202, tiedTopScorers)).toBe(true);
      
      // User predicted player 303 (should not get points)
      expect(doesUserPredictionMatch(303, tiedTopScorers)).toBe(false);
    });

    it('should handle large arrays efficiently', () => {
      // Test performance with larger datasets (though unlikely in football)
      const largeAnswerSet = Array.from({ length: 1000 }, (_, i) => i);
      
      // Check first and last elements
      expect(doesUserPredictionMatch(0, largeAnswerSet)).toBe(true);
      expect(doesUserPredictionMatch(999, largeAnswerSet)).toBe(true);
      
      // Check element not in array
      expect(doesUserPredictionMatch(1000, largeAnswerSet)).toBe(false);
    });

    it('should maintain consistency between type guards and utility functions', () => {
      const answers: ValidAnswer[] = [
        42,
        [1, 2, 3],
        [],
        [42]
      ];

      answers.forEach(answer => {
        const normalized = normalizeAnswerToArray(answer);
        
        // Normalized result should always be an array
        expect(Array.isArray(normalized)).toBe(true);
        
        // Type guards should be consistent
        if (isMultipleAnswer(answer)) {
          expect(normalized).toEqual(answer);
        } else if (isSingleAnswer(answer)) {
          expect(normalized).toEqual([answer]);
        }
      });
    });
  });
}); 