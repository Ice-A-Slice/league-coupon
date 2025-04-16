// TypeScript types for Questionnaire component

export interface Team {
  id: string | number;
  name: string;
}

export interface Player {
  id: string | number;
  name: string;
  teamId: string | number;
}

export interface Prediction {
  leagueWinner: string | number | null;
  lastPlace: string | number | null;
  bestGoalDifference: string | number | null;
  topScorer: string | number | null;
}

export interface QuestionnaireProps {
  showQuestionnaire?: boolean;
  teams: Team[];
  players: Player[];
  initialPredictions?: Prediction;
  onPredictionChange?: (predictions: Prediction) => void;
  onSubmit?: (predictions: Prediction) => void;
  onToggleVisibility?: () => void;
}

export type QuestionId = 'leagueWinner' | 'lastPlace' | 'bestGoalDifference' | 'topScorer';

export interface Question {
  id: QuestionId;
  text: string;
  type: 'team' | 'player';
  helperText?: string;
} 