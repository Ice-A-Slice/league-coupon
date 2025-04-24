import {
  validateCouponSelections,
  validateQuestionnaireAnswers,
  prepareBetSubmissionData,
  prepareAnswersSubmissionData,
} from './submissionHelpers';
import type { Match, Selections } from "@/components/BettingCoupon/types";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";

// --- Mock Data ---
const mockMatches: Match[] = [
  { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' },
  { id: '2', homeTeam: 'Team C', awayTeam: 'Team D' },
  { id: '3', homeTeam: 'Team E', awayTeam: 'Team F' },
];

const mockCompleteSelections: Selections = {
  '1': '1',
  '2': 'X',
  '3': '2',
};

const mockIncompleteSelections: Selections = {
  '1': '1',
  // Missing selection for match '2'
  '3': '2',
};

const mockValidAnswers: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 10, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: 11, answered_player_id: null },
  { question_type: 'best_goal_difference', answered_team_id: 12, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
];

const mockInvalidAnswersMissing: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 10, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: 11, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
];

const mockInvalidAnswersUnanswered: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 10, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: null, answered_player_id: null },
  { question_type: 'best_goal_difference', answered_team_id: 12, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
];


// --- Test Suites ---
describe('submissionHelpers', () => {

  // --- validateCouponSelections --- 
  describe('validateCouponSelections', () => {
    it('should return isValid: true for complete selections', () => {
      const result = validateCouponSelections(mockCompleteSelections, mockMatches);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return isValid: false if selections are null or empty', () => {
      const resultNull = validateCouponSelections(null, mockMatches);
      expect(resultNull.isValid).toBe(false);
      expect(resultNull.errors).toBeDefined();
      expect(resultNull.errors).toHaveProperty('form');
      expect(resultNull.errors).toHaveProperty('match_1');
      expect(resultNull.errors).toHaveProperty('match_2');
      expect(resultNull.errors).toHaveProperty('match_3');

      const resultEmpty = validateCouponSelections({}, mockMatches);
      expect(resultEmpty.isValid).toBe(false);
      expect(resultEmpty.errors).toBeDefined();
      expect(resultEmpty.errors).toHaveProperty('form');
      expect(resultEmpty.errors).toHaveProperty('match_1');
      expect(resultEmpty.errors).toHaveProperty('match_2');
      expect(resultEmpty.errors).toHaveProperty('match_3');
    });

    it('should return isValid: false if some selections are missing', () => {
      const result = validateCouponSelections(mockIncompleteSelections, mockMatches);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveProperty('match_2');
      expect(result.errors).toHaveProperty('form');
    });

    it('should return isValid: true if matches array is empty (nothing to validate)', () => {
      const result = validateCouponSelections(mockCompleteSelections, []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  // --- validateQuestionnaireAnswers ---
  describe('validateQuestionnaireAnswers', () => {
    it('should return isValid: true for complete and answered questions', () => {
      const result = validateQuestionnaireAnswers(mockValidAnswers);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return isValid: false if answers are null or undefined', () => {
      const resultNull = validateQuestionnaireAnswers(null);
      expect(resultNull.isValid).toBe(false);
      expect(resultNull.errors).toHaveProperty('form');

      const resultUndefined = validateQuestionnaireAnswers(undefined);
      expect(resultUndefined.isValid).toBe(false);
      expect(resultUndefined.errors).toHaveProperty('form');
    });

    it('should return isValid: false if fewer than expected answers are provided', () => {
      const result = validateQuestionnaireAnswers(mockInvalidAnswersMissing);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveProperty('form');
    });

    it('should return isValid: false if one or more questions are unanswered', () => {
      const result = validateQuestionnaireAnswers(mockInvalidAnswersUnanswered);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveProperty('form');
    });
  });

  // --- prepareBetSubmissionData ---
  describe('prepareBetSubmissionData', () => {
    it('should format selections correctly for the API', () => {
      const result = prepareBetSubmissionData(mockCompleteSelections);
      expect(result).toEqual([
        { fixture_id: 1, prediction: '1' },
        { fixture_id: 2, prediction: 'X' },
        { fixture_id: 3, prediction: '2' },
      ]);
    });

    it('should return an empty array for empty selections', () => {
      const result = prepareBetSubmissionData({});
      expect(result).toEqual([]);
    });
  });

  // --- prepareAnswersSubmissionData ---
  describe('prepareAnswersSubmissionData', () => {
    it('should return the answers array as is', () => {
      const result = prepareAnswersSubmissionData(mockValidAnswers);
      // Should return the same array instance or an equivalent array
      expect(result).toEqual(mockValidAnswers);
      // Optionally check if it's the same instance if mutation is a concern
      // expect(result).toBe(mockValidAnswers); 
    });

    it('should return an empty array if input is empty', () => {
      const result = prepareAnswersSubmissionData([]);
      expect(result).toEqual([]);
    });
  });

}); 