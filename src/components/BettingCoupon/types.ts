// TypeScript types for BettingCoupon component

/** Type alias for the possible bet selection outcomes ('1', 'X', '2'). */
export type SelectionType = '1' | 'X' | '2';

/**
 * Represents a single match (fixture) displayed in the betting coupon.
 */
export interface Match {
  /** Unique identifier for the match (can be string or number). */
  id: string | number; // Allow string or number for match ID
  /** Name of the home team. */
  homeTeam: string;
  /** Name of the away team. */
  awayTeam: string;
}

/** 
 * Represents the user's selections for the betting coupon.
 * Maps match ID (string) to the selected outcome (`SelectionType`) or null if no selection.
 */
export type Selections = {
  [matchId: string]: SelectionType | null; // Map matchId (string) to selection or null
};

/**
 * Defines the properties accepted by the BettingCoupon component.
 */
export interface BettingCouponProps {
  /** An array of matches to display in the coupon. */
  matches: Match[];
  /** Optional initial selections to pre-populate the coupon. */
  initialSelections?: Selections;
  /** Optional callback function triggered when a user makes or changes a selection. Passes the full selections object and the ID of the changed match. */
  onSelectionChange?: (selections: Selections, matchId: string) => void;
  /** Optional object containing validation errors, keyed by match ID (e.g., 'match_123'). */
  validationErrors?: Record<string, string> | null; // Add optional validation errors prop
}

export {}; 