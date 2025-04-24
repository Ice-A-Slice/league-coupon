import type { Match, SelectionType, Selections } from "@/components/BettingCoupon/types";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";

// Define a structure for validation results
interface ValidationResult {
  isValid: boolean;
  errors?: Record<string, string>;
}

/**
 * Validates the betting coupon selections.
 * Checks if a selection exists for every match provided.
 * 
 * @param selections The user's selections { [fixtureId]: SelectionType }.
 * @param matches The list of matches that should have selections.
 * @returns ValidationResult indicating if all matches have selections and any errors.
 */
export function validateCouponSelections(selections: Selections | undefined | null, matches: Match[]): ValidationResult {
  const errors: Record<string, string> = {};

  if (!selections || Object.keys(selections).length === 0) {
    errors.form = 'No selections made.';
    return { isValid: false, errors };
  }

  // Check if every match has a corresponding selection
  const missingSelections = matches.filter(match => !selections[match.id]);

  if (missingSelections.length > 0) {
    missingSelections.forEach(match => {
      // Use fixture ID as the key for specific error messages if needed
      errors[`match_${match.id}`] = `Selection missing for ${match.homeTeam} vs ${match.awayTeam}`;
    });
    // Add a general error message as well
    errors.form = `Missing selections for ${missingSelections.length} match(es). Please select H, U, or B for all matches.`;
    return { isValid: false, errors };
  }

  // Add other validation rules here if needed (e.g., check selection format)

  return { isValid: true };
}

/**
 * Validates the questionnaire answers.
 * Checks if all expected questions have been answered.
 * 
 * @param answers The user's season answers.
 * @returns ValidationResult indicating if all questions are answered and any errors.
 */
export function validateQuestionnaireAnswers(answers: SeasonAnswers[] | undefined | null): ValidationResult {
  const errors: Record<string, string> = {};
  const expectedAnswers = 4; // Hardcoded based on current implementation

  // Check if answers array exists and has the expected number of items
  if (!answers || answers.length < expectedAnswers) {
    errors.form = `Please answer all ${expectedAnswers} season questions.`;
    return { isValid: false, errors };
  }

  // Check if each answer has a selected team or player ID
  const allAnswered = answers.every(ans => ans.answered_team_id !== null || ans.answered_player_id !== null);

  if (!allAnswered) {
    errors.form = 'Please answer all season questions.';
    // We could add more specific errors per question if needed
    return { isValid: false, errors };
  }

  return { isValid: true };
}

/**
 * Prepares the betting selections data for submission to the API.
 * 
 * @param selections The validated user selections.
 * @returns An array formatted for the /api/bets endpoint.
 */
export function prepareBetSubmissionData(selections: Selections): { fixture_id: number; prediction: SelectionType }[] {
  return Object.entries(selections).map(([fixtureId, prediction]) => ({
    fixture_id: parseInt(fixtureId, 10),
    prediction: prediction as SelectionType, // Ensure type safety
  }));
}

/**
 * Prepares the questionnaire answers data for submission.
 * Currently just returns the validated answers as they are assumed to be in the correct format.
 * 
 * @param answers The validated questionnaire answers.
 * @returns The answers array ready for submission.
 */
export function prepareAnswersSubmissionData(answers: SeasonAnswers[]): SeasonAnswers[] {
  // Assuming the answers array is already in the correct format for the API
  return answers;
} 