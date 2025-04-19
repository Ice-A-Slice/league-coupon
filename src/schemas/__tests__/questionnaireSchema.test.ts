import { PredictionSchema, validatePrediction } from '../questionnaireSchema';
import type { Prediction } from '@/components/Questionnaire/types';

// Mock uuid for testing - Using simple non-empty strings as schema only requires min(1)
const mockValue1 = 'some-valid-string-1';
const mockValue2 = 'some-valid-string-2';
const mockValue3 = 'some-valid-string-3';
const mockValue4 = 'some-valid-string-4';

describe('PredictionSchema', () => {
  it('should validate complete predictions', () => {
    const validPrediction: Prediction = {
      leagueWinner: mockValue1,
      lastPlace: mockValue2,
      bestGoalDifference: mockValue3,
      topScorer: mockValue4
    };

    const result = PredictionSchema.safeParse(validPrediction);
    expect(result.success).toBe(true);
  });

  it('should reject predictions with null values', () => {
    const invalidPrediction: Prediction = {
      leagueWinner: mockValue1,
      lastPlace: null, // Null value
      bestGoalDifference: mockValue3,
      topScorer: mockValue4
    };

    const result = PredictionSchema.safeParse(invalidPrediction);
    expect(result.success).toBe(false);
    // Check that the specific error message for null is as expected from Zod
    const nullIssue = result.error?.issues.find(issue => issue.path[0] === 'lastPlace');
    expect(nullIssue?.message).toBe('Expected string, received null'); 
  });

  it('should reject predictions with empty strings', () => {
    const invalidPrediction = {
      leagueWinner: mockValue1,
      lastPlace: mockValue2,
      bestGoalDifference: '', // Empty string
      topScorer: mockValue4
    };

    const result = PredictionSchema.safeParse(invalidPrediction);
    expect(result.success).toBe(false);
    // Check that the specific error message for empty string matches the schema
    const emptyIssue = result.error?.issues.find(issue => issue.path[0] === 'bestGoalDifference');
    expect(emptyIssue?.message).toBe('Best goal difference team prediction is required'); 
  });
});

describe('validatePrediction', () => {
  it('should return isValid true for valid predictions', () => {
    const validPrediction: Prediction = {
      leagueWinner: mockValue1,
      lastPlace: mockValue2,
      bestGoalDifference: mockValue3,
      topScorer: mockValue4
    };

    const result = validatePrediction(validPrediction);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid predictions (null/empty)', () => {
    const invalidPrediction: Prediction = {
      leagueWinner: mockValue1,
      lastPlace: null, // Test null
      bestGoalDifference: '', // Test empty string
      topScorer: mockValue4
    };

    const result = validatePrediction(invalidPrediction);
    expect(result.isValid).toBe(false);
    // Expect the specific error messages from the validatePrediction helper
    // For null, Zod's message is passed through
    expect(result.errors).toHaveProperty('lastPlace', 'Expected string, received null'); 
    // For empty string, the schema's custom message is passed through
    expect(result.errors).toHaveProperty('bestGoalDifference', 'Best goal difference team prediction is required');
  });
}); 