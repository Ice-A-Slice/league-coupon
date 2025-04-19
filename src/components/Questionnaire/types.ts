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
  leagueWinner: string | null;
  lastPlace: string | null;
  bestGoalDifference: string | null;
  topScorer: string | null;
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