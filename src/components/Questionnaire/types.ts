// TypeScript types for Questionnaire component

export interface Team {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export interface Prediction {
  [key: string]: string | null; // Allow string keys
}

// Define PredictionKeys based on the Prediction interface
export type PredictionKeys = keyof Prediction;

export interface QuestionnaireProps {
  showQuestionnaire?: boolean;
  teams: Team[];
  players: Player[];
  initialPredictions?: Prediction;
  onPredictionChange?: (questionKey: PredictionKeys) => void;
  onSubmit?: (predictions: Prediction) => void;
  onToggleVisibility?: () => void;
  validationErrors?: Record<string, string>;
}

export type QuestionId = 'leagueWinner' | 'lastPlace' | 'bestGoalDifference' | 'topScorer';

export interface Question {
  id: QuestionId;
  text: string;
  type: 'team' | 'player';
  helperText?: string;
} 