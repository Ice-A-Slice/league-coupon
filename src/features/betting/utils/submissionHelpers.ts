import type { Match, SelectionType, Selections } from "@/components/BettingCoupon/types";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";
import type { Prediction } from "@/components/Questionnaire/types";

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
    errors.form = `Missing selections for ${missingSelections.length} match(es). Please select 1, X, or 2 for all matches.`;
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