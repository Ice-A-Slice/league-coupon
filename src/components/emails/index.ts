// Email Templates
export { default as SummaryEmail } from './SummaryEmail';
export { default as ReminderEmail } from './ReminderEmail';
export { TransparencyEmail } from './TransparencyEmail';

// TypeScript Types for Summary Email
export type {
  MatchResult,
  UserPerformance,
  LeagueStanding,
  AIGeneratedStory,
  SummaryEmailProps,
} from './SummaryEmail';

// TypeScript Types for Reminder Email
export type {
  UpcomingFixture,
  UserPosition,
  DeadlineInfo,
  AIMotivationalContent,
  ReminderEmailProps,
} from './ReminderEmail';

// TypeScript Types for Transparency Email
export type {
  TransparencyEmailProps,
} from './TransparencyEmail'; 