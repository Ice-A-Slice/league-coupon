import { z } from 'zod';
import type { Selections, Match, SelectionType } from '@/components/BettingCoupon/types';

// Define a schema for valid selection values
const SelectionSchema = z.enum(['1', 'X', '2'] as const);

// Schema for validating selections
export const SelectionsSchema = z.record(
  // Keys are match IDs as strings
  z.string(),
  // Values must be valid selections or null
  SelectionSchema.nullable()
);

// Function to create a validator that checks if all required matches have selections
export const createSelectionsValidator = (matches: Match[]) => {
  return z.function()
    .args(SelectionsSchema)
    .returns(
      z.object({
        isValid: z.boolean(),
        errors: z.record(z.string(), z.string()).optional(),
      })
    )
    .implement((selections) => {
      const errors: Record<string, string> = {};
      let isValid = true;

      // Check if every match has a valid selection
      matches.forEach((match) => {
        const matchId = String(match.id);
        const selection = selections[matchId];
        
        if (selection === null || selection === undefined) {
          isValid = false;
          errors[matchId] = 'No selection made';
        }
      });

      return { isValid, errors: isValid ? undefined : errors };
    });
};

// Type inference
export type ValidSelections = z.infer<typeof SelectionsSchema>; 