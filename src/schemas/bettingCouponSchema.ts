import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Selections, Match, SelectionType } from '@/components/BettingCoupon/types';

// Define a schema for valid selection values
export const SelectionSchema = z.enum(['1', 'X', '2'] as const);

// Schema for validating selections
export const SelectionsSchema = z.record(
  // Keys are match IDs as strings
  z.string(),
  // Values must be valid selections or null
  SelectionSchema.nullable()
);

// Function to create a validator that checks if all required matches have selections
export const createSelectionsValidator = (matches: Match[]) => {
  return (selections: Selections) => {
    const errors: Record<string, string> = {};
    let isValid = true;

    console.log('🔍 Running validator with matches:', matches.length);
    console.log('🔍 Selections to validate:', JSON.stringify(selections, null, 2));
    console.log('🔍 Matches that need validation:', matches.map(m => `${m.id}: ${m.homeTeam} vs ${m.awayTeam}`).join(', '));

    // Check if every match has a valid selection
    matches.forEach((match) => {
      const matchId = String(match.id);
      const selection = selections[matchId];
      
      console.log(`🏟️ Checking match ${matchId} (${match.homeTeam} vs ${match.awayTeam}): Selection = ${selection}`);
      
      // Only mark as invalid if selection is null or undefined
      if (selection === null || selection === undefined) {
        isValid = false;
        errors[matchId] = `Please select a result for ${match.homeTeam} vs ${match.awayTeam}`;
        console.log(`❌ Match ${matchId} is invalid: no selection`);
      } else {
        console.log(`✅ Match ${matchId} is valid: selection = ${selection}`);
      }
    });

    console.log(`🧪 Validation result: isValid=${isValid}, errors=${Object.keys(errors).length > 0 ? JSON.stringify(errors, null, 2) : 'none'}`);
    return { isValid, errors: isValid ? undefined : errors };
  };
};

// Validate the full coupon
export const validateCoupon = (matches: Match[], selections: Selections) => {
  console.log('🔍 validateCoupon called with:');
  console.log('- matches:', matches.length);
  console.log('- selections:', JSON.stringify(selections, null, 2));
  
  // First validate the structure of the selections
  const structureResult = SelectionsSchema.safeParse(selections);
  console.log('🧪 Structure validation result:', structureResult.success ? 'Valid' : 'Invalid');
  
  if (!structureResult.success) {
    // Handle structure validation errors
    const formattedErrors: Record<string, string> = {};
    structureResult.error.issues.forEach((issue) => {
      // For record validation, path will contain the key with the issue
      const matchId = issue.path.join('.');
      formattedErrors[matchId] = `Invalid selection: ${issue.message}`;
      console.log(`❌ Structure error for match ${matchId}: ${issue.message}`);
    });
    
    return { isValid: false, errors: formattedErrors };
  }

  // Then validate that all required matches have selections
  const result = createSelectionsValidator(matches)(selections);
  console.log('🧪 Final validation result:', result.isValid ? '✅ Valid' : '❌ Invalid', 
    result.errors ? `with ${Object.keys(result.errors).length} errors` : '');
  return result;
};

// Type inference
export type ValidSelections = z.infer<typeof SelectionsSchema>; 