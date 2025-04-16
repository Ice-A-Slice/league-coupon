// TypeScript types for BettingCoupon component

export type SelectionType = '1' | 'X' | '2';

export interface Match {
  id: string | number; // Allow string or number for match ID
  homeTeam: string;
  awayTeam: string;
}

export type Selections = {
  [matchId: string]: SelectionType | null; // Map matchId (string) to selection or null
};

export interface BettingCouponProps {
  matches: Match[];
  initialSelections?: Selections;
  onSelectionChange?: (selections: Selections) => void;
}

export {}; 