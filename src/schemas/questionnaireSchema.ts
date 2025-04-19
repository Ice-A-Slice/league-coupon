import { z } from 'zod';
import type { Prediction } from '@/components/Questionnaire/types';

// Schema for validating non-null values for prediction fields
export const PredictionSchema = z.object({
  leagueWinner: z.string().min(1, "League winner is required").nullable(),
  lastPlace: z.string().min(1, "Last place team is required").nullable(),
  bestGoalDifference: z.string().min(1, "Best goal difference team is required").nullable(),
  topScorer: z.string().min(1, "Top scorer is required").nullable()
});

// Helper schema that doesn't enforce non-null validation
// Useful for partial validations during form completion
export const PartialPredictionSchema = z.object({
  leagueWinner: z.string().nullable(),
  lastPlace: z.string().nullable(),
  bestGoalDifference: z.string().nullable(),
  topScorer: z.string().nullable()
});

// Function to validate a prediction and return field-specific errors
export const validatePrediction = (prediction: Prediction) => {
  const result = PredictionSchema.safeParse(prediction);
  if (result.success) {
    return { isValid: true };
  }
  
  // Format error messages by field
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    // Path[0] is the field name since we're using an object schema
    const field = issue.path[0]?.toString();
    if (field) {
      errors[field] = issue.message;
    }
  });
  
  return { isValid: false, errors };
};

// Type inference
export type ValidPrediction = z.infer<typeof PredictionSchema>; 