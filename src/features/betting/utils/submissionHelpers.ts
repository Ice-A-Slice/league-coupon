import type { Match, SelectionType, Selections } from "@/components/BettingCoupon/types";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";
import type { Prediction } from "@/components/Questionnaire/types";

// Define a structure for validation results
/**
 * Represents the result of a validation check.
 */
interface ValidationResult {
  /** Indicates whether the validation passed. */
  isValid: boolean;
  /** An optional record of specific validation errors, mapping field/item ID to error message. */
  errors?: Record<string, string>;
}

/**
 * Validates the betting coupon selections.
 * Checks if a valid selection ('1', 'X', or '2') exists for every match in the provided list.
 * Returns a general form error and specific match errors if validation fails.
 * 
 * @param {Selections | undefined | null} selections - The user's selections, mapping fixture ID (string) to the selection ('1', 'X', '2') or null/undefined.
 * @param {Match[]} matches - The list of matches that are required to have selections.
 * @returns {ValidationResult} An object indicating if validation passed (`isValid`) and a map of errors (`errors`) if it failed. 
 *          Errors are keyed by `match_{matchId}` for specific missing selections and `form` for the general error message.
 */
export function validateCouponSelections(selections: Selections | undefined | null, matches: Match[]): ValidationResult {
  const errors: Record<string, string> = {};

  let allSelected = true;

  // Iterate through all matches to check for selections
  matches.forEach(match => {
    const matchIdStr = match.id.toString();
    if (!selections || !selections[matchIdStr]) {
      allSelected = false;
      // Use a consistent key format, e.g., match_ID
      errors[`match_${matchIdStr}`] = `Selection missing for ${match.homeTeam} vs ${match.awayTeam}`;
    }
  });

  // If any selections are missing, add a general form error
  if (!allSelected) {
    errors.form = `Please select 1, X, or 2 for all matches.`;
    return { isValid: false, errors };
  }

  // Add other validation rules here if needed (e.g., check selection format)

  return { isValid: true };
}

/**
 * Validates the questionnaire answers.
 * Checks if all expected questions (currently league winner, last place, best goal difference, top scorer) 
 * have been answered and if the total number of answers matches the expected count.
 * Returns a general form error and specific question errors if validation fails.
 * 
 * @param {SeasonAnswers[] | undefined | null} answers - The user's submitted season answers.
 * @returns {ValidationResult} An object indicating if validation passed (`isValid`) and a map of errors (`errors`) if it failed.
 *          Errors are keyed by the question ID (e.g., 'leagueWinner') for specific missing answers and `form` for the general error message.
 */
export function validateQuestionnaireAnswers(answers: SeasonAnswers[] | undefined | null): ValidationResult {
  const expectedAnswers = 4;
  // Define expected questions using their IDs (keys of Prediction) and corresponding question_type
  const questions: { id: keyof Prediction; type: string }[] = [
    { type: 'league_winner', id: 'leagueWinner' },
    { type: 'last_place', id: 'lastPlace' },
    { type: 'best_goal_difference', id: 'bestGoalDifference' },
    { type: 'top_scorer', id: 'topScorer' },
  ];
  const errors: Record<string, string> = {};
  let allAnswered = true; // Assume true initially
  const correctNumberOfAnswers = answers && answers.length === expectedAnswers;

  questions.forEach(q => {
    // Find the answer only if the answers array exists
    const correspondingAnswer = answers?.find(ans => ans.question_type === q.type);
    const isAnswered = correspondingAnswer && (correspondingAnswer.answered_team_id !== null || correspondingAnswer.answered_player_id !== null);
    if (!isAnswered) {
      allAnswered = false;
      errors[q.id] = 'Please select an answer.'; // Add specific error only if unanswered
    }
  });

  if (!allAnswered || !correctNumberOfAnswers) {
    // Set general error message if anything is wrong
    errors.form = `Please answer all ${expectedAnswers} season questions.`;
    return { isValid: false, errors };
  }

  return { isValid: true };
}

/**
 * Prepares the betting selections data for submission to the API.
 * 
 * Transforms the selections map (fixtureId: selection) into an array of objects
 * suitable for the `/api/bets` endpoint body, parsing fixture IDs to numbers.
 * 
 * @param {Selections} selections - The validated user selections object.
 * @returns {Array<{ fixture_id: number; prediction: SelectionType }>} An array formatted for the `/api/bets` endpoint.
 */
export function prepareBetSubmissionData(selections: Selections): { fixture_id: number; prediction: SelectionType }[] {
  return Object.entries(selections).map(([fixtureId, prediction]) => ({
    fixture_id: parseInt(fixtureId, 10),
    prediction: prediction as SelectionType, // Ensure type safety
  }));
}

/**
 * Prepares the questionnaire answers data for submission.
 * 
 * Currently, this function acts as a pass-through, assuming the input `answers` array 
 * (validated by `validateQuestionnaireAnswers`) is already in the correct format 
 * required by the `/api/season-answers` endpoint.
 * 
 * @param {SeasonAnswers[]} answers - The validated questionnaire answers array.
 * @returns {SeasonAnswers[]} The answers array, ready for submission.
 */
export function prepareAnswersSubmissionData(answers: SeasonAnswers[]): SeasonAnswers[] {
  // Assuming the answers array is already in the correct format for the API
  return answers;
} 