import React from 'react';
import { render } from '@testing-library/react';
import ReminderEmail from '../ReminderEmail';
import { mockReminderData, mockUrgentReminderData } from '../mockData';
import { ReminderEmailProps } from '../index';

// Mock @react-email/components since they may not work in test environment
jest.mock('@react-email/components', () => ({
  Html: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <html {...props}>{children}</html>,
  Head: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="head" {...props}>{children}</div>,
  Preview: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="preview" {...props}>{children}</div>,
  Body: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <body {...props}>{children}</body>,
  Container: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="container" {...props}>{children}</div>,
  Section: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <section {...props}>{children}</section>,
  Row: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="row" {...props}>{children}</div>,
  Column: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="column" {...props}>{children}</div>,
  Heading: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <h1 {...props}>{children}</h1>,
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <p {...props}>{children}</p>,
  Button: ({ children, href, ...props }: React.PropsWithChildren<{href: string} & Record<string, unknown>>) => <a href={href} {...props}>{children}</a>,
  Hr: (props: Record<string, unknown>) => <hr {...props} />,
}));

describe('ReminderEmail', () => {
  const defaultProps = mockReminderData;

  describe('Rendering', () => {
    test('renders without crashing', () => {
      render(<ReminderEmail {...defaultProps} />);
    });

    test('displays correct round number in header', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Round 16 Predictions/)).toBeInTheDocument();
    });

    test('displays user name correctly', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Alex Johnson/)).toBeInTheDocument();
    });

    test('shows time remaining', () => {
      const { getAllByText } = render(<ReminderEmail {...defaultProps} />);
      const timeElements = getAllByText(/23 hours, 15 minutes/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    test('displays user position correctly', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/3rd/)).toBeInTheDocument();
      expect(getByText(/out of 24 players/)).toBeInTheDocument();
    });
  });

  describe('Urgency Handling', () => {
    test('shows non-urgent styling for regular deadline', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/⏰ Deadline Reminder/)).toBeInTheDocument();
      expect(getByText(/Time to make your picks/)).toBeInTheDocument();
    });

    test('shows urgent styling for urgent deadline', () => {
      const { getByText } = render(<ReminderEmail {...mockUrgentReminderData} />);
      expect(getByText(/🚨 DEADLINE ALERT/)).toBeInTheDocument();
      expect(getByText(/Final call/)).toBeInTheDocument();
    });

    test('shows different CTA button for urgent deadlines', () => {
      const { getByText } = render(<ReminderEmail {...mockUrgentReminderData} />);
      expect(getByText(/🚨 Submit Now - Time Running Out!/)).toBeInTheDocument();
    });

    test('shows regular CTA button for non-urgent deadlines', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/⚽ Make Your Predictions/)).toBeInTheDocument();
    });
  });

  describe('Position Suffix', () => {
    test('displays correct suffix for 1st position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 1 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/1st/)).toBeInTheDocument();
    });

    test('displays correct suffix for 2nd position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 2 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/2nd/)).toBeInTheDocument();
    });

    test('displays correct suffix for 3rd position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 3 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/3rd/)).toBeInTheDocument();
    });

    test('displays correct suffix for 4th position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 4 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/4th/)).toBeInTheDocument();
    });

    test('displays correct suffix for 11th position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 11 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/11th/)).toBeInTheDocument();
    });

    test('displays correct suffix for 21st position', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 21 },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/21st/)).toBeInTheDocument();
    });
  });

  describe('User Performance', () => {
    test('displays points behind leader', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/-18/)).toBeInTheDocument();
      expect(getByText(/points behind leader/)).toBeInTheDocument();
    });

    test('shows recent form with correct icon', () => {
      const { getByText, getAllByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/📈/)).toBeInTheDocument(); // improving form
      expect(getByText(/Recent form:/)).toBeInTheDocument();
      // "improving" appears in multiple places (AI content and form section)
      const improvingElements = getAllByText(/improving/);
      expect(improvingElements.length).toBeGreaterThan(0);
    });

    test('handles declining form correctly', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, recentForm: 'declining' },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/📉/)).toBeInTheDocument();
      expect(getByText(/Recent form:/)).toBeInTheDocument();
      expect(getByText(/declining/)).toBeInTheDocument();
    });

    test('handles steady form correctly', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, recentForm: 'steady' },
      };
      const { getByText } = render(<ReminderEmail {...props} />);
      expect(getByText(/➡️/)).toBeInTheDocument();
      expect(getByText(/Recent form:/)).toBeInTheDocument();
      expect(getByText(/steady/)).toBeInTheDocument();
    });

    test('shows points ahead of next player when available', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/4 pts ahead of next player/)).toBeInTheDocument();
    });

    test('handles missing points ahead gracefully', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, pointsAheadOfNext: undefined },
      };
      const { queryByText } = render(<ReminderEmail {...props} />);
      expect(queryByText(/pts ahead of next player/)).not.toBeInTheDocument();
    });
  });

  describe('AI Content', () => {
    test('displays AI-generated personal message', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/You're on fire with your recent predictions/)).toBeInTheDocument();
    });

    test('displays strategy tip when provided', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Strategy Tip:/)).toBeInTheDocument();
      expect(getByText(/Liverpool vs City could be a title decider/)).toBeInTheDocument();
    });

    test('displays fixture insight when provided', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Match Insight:/)).toBeInTheDocument();
      expect(getByText(/Arsenal vs Chelsea is always unpredictable/)).toBeInTheDocument();
    });

    test('displays encouragement message', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Trust your instincts and keep building that momentum/)).toBeInTheDocument();
    });

    test('handles missing strategy tip gracefully', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        aiContent: {
          ...defaultProps.aiContent,
          strategyTip: undefined,
        },
      };
      const { queryByText } = render(<ReminderEmail {...props} />);
      expect(queryByText(/Strategy Tip:/)).not.toBeInTheDocument();
    });

    test('handles missing fixture insight gracefully', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        aiContent: {
          ...defaultProps.aiContent,
          fixtureInsight: undefined,
        },
      };
      const { queryByText } = render(<ReminderEmail {...props} />);
      expect(queryByText(/Match Insight:/)).not.toBeInTheDocument();
    });
  });

  describe('Key Matches', () => {
    test('displays key matches section when provided', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/🔥 Key Matches This Round/)).toBeInTheDocument();
    });

    test('shows match importance badges', () => {
      const { getAllByText } = render(<ReminderEmail {...defaultProps} />);
      const badges = getAllByText(/⭐ HIGH IMPORTANCE/);
      expect(badges.length).toBeGreaterThan(0);
    });

    test('displays team names for key matches', () => {
      const { getAllByText } = render(<ReminderEmail {...defaultProps} />);
      // Liverpool appears in multiple places (AI content and match listings)
      expect(getAllByText(/Liverpool/).length).toBeGreaterThan(0);
      expect(getAllByText(/Manchester City/).length).toBeGreaterThan(0);
      expect(getAllByText(/Arsenal/).length).toBeGreaterThan(0);
      expect(getAllByText(/Chelsea/).length).toBeGreaterThan(0);
    });

    test('shows team form when available', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Form: WWDLW/)).toBeInTheDocument();
      expect(getByText(/Form: WWWDW/)).toBeInTheDocument();
    });

    test('handles missing key matches gracefully', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        keyMatches: undefined,
      };
      const { queryByText } = render(<ReminderEmail {...props} />);
      expect(queryByText(/Key Matches This Round/)).not.toBeInTheDocument();
    });
  });

  describe('All Fixtures', () => {
    test('displays all upcoming fixtures', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/📅 All Round 16 Fixtures/)).toBeInTheDocument();
    });

    test('shows fixture matchups', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Tottenham/)).toBeInTheDocument();
      expect(getByText(/Newcastle/)).toBeInTheDocument();
      expect(getByText(/Brighton/)).toBeInTheDocument();
      expect(getByText(/West Ham/)).toBeInTheDocument();
    });
  });

  describe('League Context', () => {
    test('displays league context when provided', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/🎯 How You're Doing/)).toBeInTheDocument();
    });

    test('shows user last round score', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText('8')).toBeInTheDocument();
      expect(getByText(/Your last round/)).toBeInTheDocument();
    });

    test('shows league average', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText('6')).toBeInTheDocument();
      expect(getByText(/League average/)).toBeInTheDocument();
    });

    test('shows round high score', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText('12')).toBeInTheDocument();
      expect(getByText(/Round high score/)).toBeInTheDocument();
    });

    test('handles missing league context gracefully', () => {
      const props: ReminderEmailProps = {
        ...defaultProps,
        leagueContext: undefined,
      };
      const { queryByText } = render(<ReminderEmail {...props} />);
      expect(queryByText(/How You're Doing/)).not.toBeInTheDocument();
    });
  });

  describe('Call to Action', () => {
    test('includes correct CTA button with tracking parameters', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      const button = getByText(/Make Your Predictions/);
      expect(button).toHaveAttribute('href', expect.stringContaining('utm_source=email'));
      expect(button).toHaveAttribute('href', expect.stringContaining('utm_medium=reminder'));
      expect(button).toHaveAttribute('href', expect.stringContaining('round_16'));
    });

    test('shows motivational text', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Don't miss out on round 16/)).toBeInTheDocument();
    });
  });

  describe('Email Preview', () => {
    test('generates appropriate preview text for non-urgent', () => {
      const { getByTestId } = render(<ReminderEmail {...defaultProps} />);
      const preview = getByTestId('preview');
      expect(preview).toHaveTextContent(/⏰ Prediction Deadline Approaching/);
      expect(preview).toHaveTextContent(/Round 16/);
      expect(preview).toHaveTextContent(/23 hours, 15 minutes remaining/);
    });

    test('generates appropriate preview text for urgent', () => {
      const { getByTestId } = render(<ReminderEmail {...mockUrgentReminderData} />);
      const preview = getByTestId('preview');
      expect(preview).toHaveTextContent(/🚨 Last Chance!/);
      expect(preview).toHaveTextContent(/4 hours, 43 minutes remaining/);
    });
  });

  describe('Footer', () => {
    test('includes personalized footer message', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Good luck with your predictions, Alex Johnson!/)).toBeInTheDocument();
    });

    test('includes unsubscribe and preferences links', () => {
      const { getByText } = render(<ReminderEmail {...defaultProps} />);
      expect(getByText(/Unsubscribe/)).toBeInTheDocument();
      expect(getByText(/Email Preferences/)).toBeInTheDocument();
    });
  });
}); 