// TypeScript types for Questionnaire component

/**
 * Represents a selectable team.
 */
export interface Team {
  /** Unique identifier for the team (often numeric but stored as string). */
  id: string;
  /** Display name of the team. */
  name: string;
}

/**
 * Represents a selectable player.
 */
export interface Player {
  /** Unique identifier for the player (often numeric but stored as string). */
  id: string;
  /** Display name of the player. */
  name: string;
  /** ID of the team the player belongs to. */
  teamId: string;
}

/**
 * Represents the user's predictions for season-long questions.
 * Uses string keys corresponding to `QuestionId`.
 */
export interface Prediction {
  [key: string]: string | null; // Allow string keys
}

// Define PredictionKeys based on the Prediction interface
/** Type alias for the valid keys used in the `Prediction` object (e.g., 'leagueWinner'). */
export type PredictionKeys = keyof Prediction;

/**
 * Defines the properties accepted by the Questionnaire component.
 */
export interface QuestionnaireProps {
  /** Whether the questionnaire section should be visible. Defaults to true. */
  showQuestionnaire?: boolean;
  /** An array of available teams for selection. */
  teams: Team[];
  /** An array of available players for selection. */
  players: Player[];
  /** Initial prediction values to populate the form. */
  initialPredictions?: Prediction;
  /** Optional callback function triggered when a prediction changes. */
  onPredictionChange?: (questionKey: PredictionKeys) => void;
  /** Optional callback function triggered when the questionnaire is submitted (potentially unused if submission is handled externally). */
  onSubmit?: (predictions: Prediction) => void;
  /** Optional callback function triggered when the visibility toggle is clicked. */
  onToggleVisibility?: () => void;
  /** Optional object containing validation errors, keyed by question ID (e.g., 'leagueWinner'). */
  validationErrors?: Record<string, string>;
}

/** Type alias for the specific identifiers used for each questionnaire question. */
export type QuestionId = 'leagueWinner' | 'lastPlace' | 'bestGoalDifference' | 'topScorer';

/**
 * Defines the structure for a single questionnaire question.
 */
export interface Question {
  /** Unique identifier for the question. */
  id: QuestionId;
  /** The text of the question displayed to the user. */
  text: string;
  /** The type of answer expected ('team' or 'player'), determining which selector to use. */
  type: 'team' | 'player';
  /** Optional helper text displayed below the question. */
  helperText?: string;
} 