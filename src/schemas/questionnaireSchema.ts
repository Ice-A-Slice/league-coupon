import { z } from 'zod';
import type { Prediction } from '@/components/Questionnaire/types';

// Schema for validating non-null values for prediction fields
export const PredictionSchema = z.object({
  leagueWinner: z.string().uuid().nullable().refine(
    (value) => value !== null, 
    { message: 'League winner is required' }
  ),
  lastPlace: z.string().uuid().nullable().refine(
    (value) => value !== null, 
    { message: 'Last place team is required' }
  ),
  bestGoalDifference: z.string().uuid().nullable().refine(
    (value) => value !== null, 
    { message: 'Best goal difference team is required' }
  ),
  topScorer: z.string().uuid().nullable().refine(
    (value) => value !== null, 
    { message: 'Top scorer is required' }
  )
});

// Helper schema that doesn't enforce non-null validation
// Useful for partial validations during form completion
export const PartialPredictionSchema = z.object({
  leagueWinner: z.string().uuid().nullable(),
  lastPlace: z.string().uuid().nullable(),
  bestGoalDifference: z.string().uuid().nullable(),
  topScorer: z.string().uuid().nullable()
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