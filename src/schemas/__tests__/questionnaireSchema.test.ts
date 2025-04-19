import { PredictionSchema, validatePrediction } from '../questionnaireSchema';
import type { Prediction } from '@/components/Questionnaire/types';

// Mock uuid for testing
const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

describe('PredictionSchema', () => {
  it('should validate complete predictions', () => {
    const validPrediction: Prediction = {
      leagueWinner: mockUuid,
      lastPlace: mockUuid,
      bestGoalDifference: mockUuid,
      topScorer: mockUuid
    };

    const result = PredictionSchema.safeParse(validPrediction);
    expect(result.success).toBe(true);
  });

  it('should reject predictions with null values', () => {
    const invalidPrediction: Prediction = {
      leagueWinner: mockUuid,
      lastPlace: null, // Missing value
      bestGoalDifference: mockUuid,
      topScorer: mockUuid
    };

    const result = PredictionSchema.safeParse(invalidPrediction);
    expect(result.success).toBe(false);
  });

  it('should reject predictions with invalid UUIDs', () => {
    const invalidPrediction = {
      leagueWinner: mockUuid,
      lastPlace: mockUuid,
      bestGoalDifference: 'not-a-uuid', // Invalid UUID format
      topScorer: mockUuid
    };

    const result = PredictionSchema.safeParse(invalidPrediction);
    expect(result.success).toBe(false);
  });
});

describe('validatePrediction', () => {
  it('should return isValid true for valid predictions', () => {
    const validPrediction: Prediction = {
      leagueWinner: mockUuid,
      lastPlace: mockUuid,
      bestGoalDifference: mockUuid,
      topScorer: mockUuid
    };

    const result = validatePrediction(validPrediction);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid predictions', () => {
    const invalidPrediction: Prediction = {
      leagueWinner: mockUuid,
      lastPlace: null,
      bestGoalDifference: mockUuid,
      topScorer: null
    };

    const result = validatePrediction(invalidPrediction);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('lastPlace', 'Last place team is required');
    expect(result.errors).toHaveProperty('topScorer', 'Top scorer is required');
  });
}); 