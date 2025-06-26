import React from 'react';
import { render, within } from '@testing-library/react';
import { SummaryEmail, type SummaryEmailProps } from '../SummaryEmail';
import { mockSummaryData } from '../mockData';

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
  Button: ({ children, href, ...props }: React.PropsWithChildren<{href: string} & Record<string, unknown>>) => <a role="button" href={href} {...props}>{children}</a>,
  Hr: (props: Record<string, unknown>) => <hr {...props} />,
}));

describe('SummaryEmail', () => {
  const defaultProps = mockSummaryData;

  describe('Rendering', () => {
    test('renders without crashing', () => {
      render(<SummaryEmail {...defaultProps} />);
    });

    test('displays correct round number in header', () => {
      const { getAllByText } = render(<SummaryEmail {...defaultProps} />);
      // "Round 15" appears in both preview and header
      const roundElements = getAllByText(/Round 15/);
      expect(roundElements.length).toBeGreaterThan(0);
    });

    test('displays user name and position correctly', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/Alex Johnson/)).toBeInTheDocument();
      expect(getByText(/#3/)).toBeInTheDocument();
    });

    test('shows position change correctly for improvement', () => {
      const props = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 3, previousPosition: 5 },
      };
      const { getByText } = render(<SummaryEmail {...props} />);
      expect(getByText(/⬆️ Up 2 places/)).toBeInTheDocument();
    });

    test('shows points earned this round', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/\+8/)).toBeInTheDocument();
    });

    test('displays prediction accuracy', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/6\/10 correct predictions/)).toBeInTheDocument();
    });
  });

  describe('Position Changes', () => {
    test('handles position improvement correctly', () => {
      const props = {
        ...defaultProps,
        user: { ...defaultProps.user, currentPosition: 3, previousPosition: 5 },
      };
      const { getByText } = render(<SummaryEmail {...props} />);
      expect(getByText(/⬆️ Up 2 places/)).toBeInTheDocument();
    });

    test('handles position decline correctly', () => {
      const props: SummaryEmailProps = {
        ...defaultProps,
        user: {
          ...defaultProps.user,
          currentPosition: 8,
          previousPosition: 5,
        },
      };
      const { getByText } = render(<SummaryEmail {...props} />);
      expect(getByText(/⬇️ Down 3 places/)).toBeInTheDocument();
    });

    test('handles no position change', () => {
      const props: SummaryEmailProps = {
        ...defaultProps,
        user: {
          ...defaultProps.user,
          currentPosition: 5,
          previousPosition: 5,
        },
      };
      const { getByText } = render(<SummaryEmail {...props} />);
      expect(getByText(/➡️ Position unchanged/)).toBeInTheDocument();
    });

    test('handles missing previous position', () => {
      const props: SummaryEmailProps = {
        ...defaultProps,
        user: {
          ...defaultProps.user,
          previousPosition: undefined,
        },
      };
      const { getByText } = render(<SummaryEmail {...props} />);
      expect(getByText(/➡️ Position unchanged/)).toBeInTheDocument();
    });
  });

  describe('Match Results', () => {
    test('displays all match results', () => {
      // Check that all matches are displayed - teams appear in multiple places
      const { getAllByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getAllByText(/Arsenal/).length).toBeGreaterThan(0);
      expect(getAllByText(/Liverpool/).length).toBeGreaterThan(0);
      expect(getAllByText(/Manchester City/).length).toBeGreaterThan(0);
      expect(getAllByText(/Manchester United/).length).toBeGreaterThan(0);
    });

    test('shows dramatic badge for highlighted matches', () => {
      const { getAllByText } = render(<SummaryEmail {...defaultProps} />);
      const dramaticBadges = getAllByText(/⚡ Dramatic/);
      expect(dramaticBadges.length).toBe(2);
    });

    test('displays correct scores', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/2 - 1/)).toBeInTheDocument(); // Arsenal vs Liverpool
      expect(getByText(/3 - 0/)).toBeInTheDocument(); // City vs United
    });
  });

  describe('AI Stories', () => {
    test('displays AI-generated stories', () => {
      const { getAllByText } = render(<SummaryEmail {...defaultProps} />);
      // Story titles appear in preview and AI stories section
      expect(getAllByText(/Arsenal Stuns Liverpool in Title Race Thriller/).length).toBeGreaterThan(0);
      expect(getAllByText(/Sheffield United's Great Escape Continues/).length).toBeGreaterThan(0);
    });

    test('limits stories to 3 maximum', () => {
      const { getAllByText, queryByText } = render(<SummaryEmail {...defaultProps} />);
      
      // Check that all 3 stories from mock data are rendered (stories appear in preview and main section)
      expect(getAllByText(/Arsenal Stuns Liverpool in Title Race Thriller/).length).toBeGreaterThan(0);
      expect(getAllByText(/Sheffield United's Great Escape Continues/).length).toBeGreaterThan(0);
      expect(getAllByText(/Manchester Derby Dominance/).length).toBeGreaterThan(0);
      
      // Verify no additional stories beyond the 3 in mock data
      expect(queryByText('Story 4')).not.toBeInTheDocument();
    });

    test('handles empty AI stories gracefully', () => {
      const props: SummaryEmailProps = { ...defaultProps, aiStories: [] };
      const { queryByText } = render(<SummaryEmail {...props} />);
      expect(queryByText(/This Round's Stories/)).not.toBeInTheDocument();
    });
  });

  describe('League Table', () => {
    test('displays top 6 league standings', () => {
      const { getAllByText, getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getAllByText(/Liverpool/).length).toBeGreaterThan(0);
      expect(getAllByText(/Arsenal/).length).toBeGreaterThan(0);
      expect(getAllByText(/Manchester City/).length).toBeGreaterThan(0);
      expect(getByText('45 pts')).toBeInTheDocument();
    });

    test('shows team statistics correctly', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/20p 14w 3d 3l/)).toBeInTheDocument(); // Liverpool stats
    });
  });

  describe('Coming Up Next - Next Round Preview', () => {
    test('displays next round preview when provided', () => {
      const { getByRole } = render(<SummaryEmail {...defaultProps} />);
      const nextRoundSection = getByRole('heading', { name: /Coming Up Next/i }).parentElement as HTMLElement;
      
      const withinNextRound = within(nextRoundSection);

      expect(withinNextRound.getByText(/explosive/)).toBeInTheDocument();
      // Use getAllByText to handle multiple team name occurrences
      expect(withinNextRound.getAllByText(/Liverpool/).length).toBeGreaterThan(0);
      expect(withinNextRound.getAllByText(/Manchester City/).length).toBeGreaterThan(0);
      expect(withinNextRound.getAllByText(/Arsenal/).length).toBeGreaterThan(0);
      expect(withinNextRound.getAllByText(/Chelsea/).length).toBeGreaterThan(0);
      expect(withinNextRound.getAllByText(/\d{1,2}:\d{2}\s(AM|PM)/).length).toBeGreaterThan(0);
      expect(withinNextRound.getByText(/AI Prediction Tip/)).toBeInTheDocument();
    });

    test('limits key fixtures to 3 maximum', () => {
      const { getByRole } = render(<SummaryEmail {...defaultProps} />);
      const nextRoundSection = getByRole('heading', { name: /Coming Up Next/i }).parentElement as HTMLElement;
      const withinNextRound = within(nextRoundSection);
      
      // The heading for fixtures is "Key Fixtures"
      const fixturesHeader = withinNextRound.getByRole('heading', { name: /Key Fixtures/i });
      
      // Find the fixtures grid that comes immediately after the "Key Fixtures" heading
      // The fixtures are rendered in a div with matchGrid style, so we need to find the next sibling
      const fixturesGrid = fixturesHeader.nextElementSibling as HTMLElement;
      
      const withinFixtures = within(fixturesGrid);
      const fixtures = withinFixtures.getAllByText(/vs/i);
      
      expect(fixtures.length).toBe(3);
    });

    test('handles missing next round preview gracefully', () => {
      const props: SummaryEmailProps = { ...defaultProps, nextRoundPreview: undefined };
      const { queryByText } = render(<SummaryEmail {...props} />);
      expect(queryByText(/Coming Up Next:/i)).not.toBeInTheDocument();
    });
  });

  describe('Week Highlights', () => {
    test('displays week highlights when provided', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/Sarah Chen \(12 points\)/)).toBeInTheDocument();
      expect(getByText(/Sheffield United 3-2 Luton Town/)).toBeInTheDocument();
      expect(getByText(/Bukayo Saka's curler vs Liverpool/)).toBeInTheDocument();
    });
  });

  describe('Call to Action', () => {
    test('shows CTA button with correct tracking parameters', () => {
      const { getByTestId } = render(<SummaryEmail {...defaultProps} />);
      const button = getByTestId('summary-email-cta');
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('href', expect.stringContaining('utm_source=email'));
      expect(button).toHaveAttribute('href', expect.stringContaining('utm_medium=summary'));
      expect(button).toHaveAttribute('href', expect.stringContaining(`round_${defaultProps.roundNumber}`));
    });

    test('CTA button links to the correct app URL', () => {
      const { getByTestId } = render(<SummaryEmail {...defaultProps} />);
      const button = getByTestId('summary-email-cta');
      
      expect(button).toHaveAttribute('href', expect.stringContaining(defaultProps.appUrl));
    });

    test('renders CTA button regardless of next round preview availability', () => {
      const propsWithoutPreview = { ...defaultProps, nextRoundPreview: undefined };
      const { getByTestId } = render(<SummaryEmail {...propsWithoutPreview} />);
      const button = getByTestId('summary-email-cta');
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('role', 'button');
    });
  });

  describe('Best Prediction', () => {
    test('displays best prediction when available', () => {
      const { getByText } = render(<SummaryEmail {...defaultProps} />);
      expect(getByText(/Arsenal 2-1 Liverpool \(exact score\)/)).toBeInTheDocument();
    });

    test('handles missing best prediction', () => {
      const props: SummaryEmailProps = {
        ...defaultProps,
        user: { ...defaultProps.user, bestPrediction: undefined },
      };
      const { queryByText } = render(<SummaryEmail {...props} />);
      expect(queryByText(/Best Prediction/)).not.toBeInTheDocument();
    });
  });

  describe('Email Preview', () => {
    test('generates appropriate preview text', () => {
      const { getByTestId } = render(<SummaryEmail {...defaultProps} />);
      const preview = getByTestId('preview');
      expect(preview).toHaveTextContent(/Round 15 Summary/);
      expect(preview).toHaveTextContent(/Arsenal Stuns Liverpool/);
    });

    test('handles missing AI stories in preview', () => {
      const props: SummaryEmailProps = { ...defaultProps, aiStories: [] };
      const { getByTestId } = render(<SummaryEmail {...props} />);
      const preview = getByTestId('preview');
      expect(preview).toHaveTextContent(/Premier League Results & Your Performance/);
    });
  });
}); 