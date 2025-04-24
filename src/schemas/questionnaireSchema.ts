import { z } from 'zod';
import type { Prediction } from '@/components/Questionnaire/types';

// Schema for validating non-null values for prediction fields
/**
 * Zod schema for validating the final season predictions.
 * Ensures that all required prediction fields (leagueWinner, lastPlace, etc.) 
 * are non-empty strings.
 */
export const PredictionSchema = z.object({
  leagueWinner: z.string().min(1, "League winner prediction is required"),
  lastPlace: z.string().min(1, "Last place team prediction is required"),
  bestGoalDifference: z.string().min(1, "Best goal difference team prediction is required"),
  topScorer: z.string().min(1, "Top scorer prediction is required")
});

// Helper schema that doesn't enforce non-null validation
// Useful for partial validations during form completion
/**
 * Zod schema for representing partial season predictions.
 * Allows fields to be nullable strings. This can be useful for validating 
 * intermediate states or inputs before final submission requires non-null values.
 */
export const PartialPredictionSchema = z.object({
  leagueWinner: z.string().nullable(),
  lastPlace: z.string().nullable(),
  bestGoalDifference: z.string().nullable(),
  topScorer: z.string().nullable()
});

// Function to validate a prediction and return field-specific errors
/**
 * Validates a prediction object against the strict `PredictionSchema`.
 * 
 * This function checks if all required fields have valid, non-empty string values.
 * If validation fails, it formats the Zod errors into a simple key-value map.
 *
 * @param {Prediction} prediction - The prediction object to validate.
 * @returns {{ isValid: boolean; errors?: Record<string, string> }} An object indicating if the prediction is valid.
 *          If invalid, the `errors` property contains a map where keys are field names and values are error messages.
 */
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