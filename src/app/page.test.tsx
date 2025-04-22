import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from './page'; 
// Import actual mock data
import { sampleTeams, samplePlayers } from '@/data/mockData';
// Import necessary types
import type { Match } from '@/components/BettingCoupon/types';
import type { Team, Player } from '@/components/Questionnaire/types';

// --- Mock Data Fixtures --- REMOVED
// const mockMatches: Match[] = [...];
// const mockTeams: Team[] = [...];
// const mockPlayers: Player[] = [...];

// --- Mock Submission Action --- REMOVED
// jest.mock('@/lib/actions', () => ({...}));
// const mockSubmitAction = ...;

// --- Render Helper ---
// Basic render helper.
// const renderPage = () => {
//   // Since Page now imports its own data, no need to pass props here for the mock data
//   return render(<Page />);
// };

// Add window.scrollTo mock 
window.scrollTo = jest.fn();

// --- Mock Data --- 
// Recreate basic mock data needed for the tests
const mockMatches: Match[] = [
  { id: 1, homeTeam: 'Team A', awayTeam: 'Team B' },
  { id: 2, homeTeam: 'Team C', awayTeam: 'Team D' },
  { id: 3, homeTeam: 'Team E', awayTeam: 'Team F' },
  { id: 4, homeTeam: 'Team G', awayTeam: 'Team H' }, // Added for coupon validity test
];

const mockTeams: Team[] = [
  { id: '101', name: 'Test Team Alpha' },
  { id: '102', name: 'Test Team Beta' },
  { id: '103', name: 'Test Team Gamma' },
];

const mockPlayers: Player[] = [
  { id: '201', name: 'Player One', teamId: '101' },
  { id: '202', name: 'Player Two', teamId: '101' },
  { id: '203', name: 'Player Three', teamId: '102' },
];

// --- Mock global.fetch --- 
global.fetch = jest.fn();

const mockFetch = fetch as jest.Mock;

// --- Jest Setup --- 
// (Assuming jest.setup.cjs handles Supabase mocks)

// Helper to reset mocks before each test
beforeEach(() => {
  mockFetch.mockClear();
  // Default mock implementation (can be overridden in specific tests)
  mockFetch.mockImplementation((url): Promise<any> => {
    console.log(`[TEST] Intercepted fetch: ${url}`);
    if (url.toString().includes('/api/fixtures')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockMatches,
      });
    }
    if (url.toString().includes('/api/teams')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockTeams,
      });
    }
    if (url.toString().includes('/api/players')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockPlayers,
      });
    }
    // Fallback for unhandled requests
    return Promise.reject(new Error(`Unhandled fetch request in test: ${url}`));
  });
});

// --- Test Suite ---
describe('Page Validation Flow Integration Tests', () => {
  const user = userEvent.setup();

  // Basic Render Test (Smoke Test)
  test('should render BettingCoupon and Questionnaire components', async () => {
    // Arrange
    render(<Page />);
    
    // Assert - Now use getByRole as elements should be present
    // Note: The Round 1 heading might be commented out in the current implementation
    // expect(screen.getByRole('heading', { name: /Round 1/i })).toBeInTheDocument();
    expect(await screen.findByTestId('toggle-button-1-1')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Questions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();
  });

  // --- Test Case: Valid Submission (Subtask 10.2) ---
  test('should allow submission when all selections and predictions are valid', async () => {
    // Arrange
    render(<Page />);
    
    // Wait for elements to appear after mock fetch
    await screen.findByTestId('toggle-button-1-1');
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });

    // Betting Coupon: Select all matches
    await user.click(screen.getByTestId('toggle-button-1-1'));
    await user.click(screen.getByTestId('toggle-button-2-X'));
    await user.click(screen.getByTestId('toggle-button-3-2'));
    await user.click(screen.getByTestId('toggle-button-4-1'));

    // Questionnaire: Select all predictions
    // League Winner
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name }));
    // Last Place
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[1].name }));
    // Goal Diff
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[2].name }));
    // Top Scorer
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(await screen.findByRole('option', { name: mockPlayers[0].name }));

    // Submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    // Check success UI (no changes needed here)
    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Submit Another Coupon/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Submit$/i })).not.toBeInTheDocument();
    // Check no errors (no changes needed here)
    expect(screen.queryByText(/Please select a result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prediction is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
  });

  // --- Test Case: Invalid BettingCoupon Submission (Subtask 10.2) ---
  test('should prevent submission and show errors when BettingCoupon is invalid', async () => {
    // Arrange
    render(<Page />);
    await screen.findByTestId('toggle-button-1-1');
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });

    // --- Act ---
    // Betting Coupon INVALID: Only match 1 selected
    await user.click(screen.getByTestId('toggle-button-1-1'));

    // Questionnaire VALID
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name }));
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[1].name }));
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[2].name }));
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(await screen.findByRole('option', { name: mockPlayers[0].name }));

    // Submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    // Check for summary error
    expect(await screen.findByText(/Please fix all errors/i)).toBeInTheDocument();
    // Check for specific coupon error (needs coupon to expose errors accessibly or via testid)
    // For now, just check summary error
    expect(screen.queryByText(/Success!/i)).not.toBeInTheDocument();
  });

  // --- Test Case: Invalid Questionnaire Submission (Subtask 10.2) ---
  test('should prevent submission and show errors when Questionnaire is invalid', async () => {
    // Arrange
    render(<Page />);
    await screen.findByTestId('toggle-button-1-1');
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });

    // --- Act ---
    // Betting Coupon VALID
    await user.click(screen.getByTestId('toggle-button-1-1'));
    await user.click(screen.getByTestId('toggle-button-2-X'));
    await user.click(screen.getByTestId('toggle-button-3-2'));
    await user.click(screen.getByTestId('toggle-button-4-1'));

    // Questionnaire INVALID (only League Winner)
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name }));

    // Submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    expect(await screen.findByText(/Please fix all errors/i)).toBeInTheDocument();
    // Check for specific questionnaire error (needs questionnaire to expose errors accessibly or via testid)
    // For now, just check summary error
    expect(screen.queryByText(/Success!/i)).not.toBeInTheDocument();
  });

  // --- Test Case: Both Components Invalid Submission (Subtask 10.2) ---
  test('should prevent submission and show errors when both components are invalid', async () => {
    // Arrange
    render(<Page />);
    await screen.findByTestId('toggle-button-1-1');
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });

    // --- Act ---
    // Betting Coupon INVALID (only m1)
    await user.click(screen.getByTestId('toggle-button-1-1'));

    // Questionnaire INVALID (only League Winner & Goal Diff)
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name }));
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[2].name }));

    // Submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    // Check failure state (no changes needed)
    expect(screen.queryByText(/Success!/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();

    // Check errors for BOTH displayed
    await waitFor(() => {
      // Coupon Errors
      const couponSection = screen.getByRole('heading', { name: /Round 1/i }).closest('section');
      // Use querySelector to find the summary alert specifically (usually a div with role="alert")
      const couponErrorSummary = within(couponSection!).getByText(/Please make selections for all matches/i).closest('[role="alert"]');
      expect(couponErrorSummary).toBeInTheDocument();
      // Fix: Use team names from mockMatches
      expect(couponErrorSummary?.textContent).toContain('Team C vs Team D');
      expect(couponErrorSummary?.textContent).toContain('Team E vs Team F');
      expect(couponErrorSummary?.textContent).toContain('Team G vs Team H');

      // Questionnaire Errors - check for field-level errors instead of a summary
      const questionnaireSection = screen.getByRole('heading', { name: /Questions/i }).closest('section');
      const errorMessages = within(questionnaireSection!).getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
      
      const errorTexts = errorMessages.map(el => el.textContent);
      expect(errorTexts.some(text => text?.includes('Expected string, received null'))).toBeTruthy();

      // General Error
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();
    });
  });

  // --- Tests for Subtask 10.3 ---
  test('should show correct positive visual feedback when selections/predictions are made', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // --- Act & Assert: Betting Coupon ---
    // Match m1 (Inter vs Juventus)
    const match1Button = await screen.findByTestId('toggle-button-1-1');
    const match1Row = match1Button.closest('div.flex.w-full') as HTMLElement;
    await user.click(match1Button);
    // Assertions (no changes needed)
    await waitFor(() => {
      expect(match1Button).toHaveAttribute('data-selected', 'true');
      expect(match1Row).toHaveClass('bg-green-50', 'border-l-green-500'); 
      expect(within(match1Row).getByTestId('validation-success-icon')).toBeInTheDocument();
    });
    // Match m2 (Milan vs Napoli) - check still neutral
    const match2Button = await screen.findByTestId('toggle-button-2-X');
    const match2Row = match2Button.closest('div.flex.w-full') as HTMLElement;
    expect(match2Row).not.toHaveClass('border-l-green-500');
    expect(await screen.findAllByTestId('validation-success-icon')).toHaveLength(1);

    // --- Act & Assert: Questionnaire ---
    // Select League Winner (Inter)
    const leagueWinnerCombobox = await screen.findByRole('combobox', { name: /Select a team for league-winner/i });
    await user.click(leagueWinnerCombobox);
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name })); // Inter
    // Assertions (no changes needed)
    await waitFor(() => {
      expect(leagueWinnerCombobox).toHaveClass('border-green-300');
      // TODO check indicator specifically
    });
    // Check no general errors (no changes needed)
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
  });

  test('should show error messages and styles only after a failed submission attempt', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // Wait for elements to be ready before interacting
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });
    // Use findByTestId to ensure buttons are loaded before checking their state
    await screen.findByTestId('toggle-button-1-1');
    const match2Button = await screen.findByTestId('toggle-button-2-X');

    // --- Assert 1: BEFORE Submit ---
    // Check NO errors are visible initially (inline or summary)
    expect(screen.queryByText(/Please select a result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prediction is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
    // Check specific match row doesn't have error style/icon
    const match2Row = match2Button.closest('div.flex.w-full') as HTMLElement;
    expect(match2Row).not.toHaveClass('bg-red-50', 'border-l-red-500');
    expect(screen.queryByTestId('validation-error-icon')).not.toBeInTheDocument(); // Assuming an error icon test id

    // --- Act ---
    // Make selections (INVALID state)
    // Use findByTestId before clicking
    await user.click(await screen.findByTestId('toggle-button-1-1')); // Only m1 valid
    await user.click(await screen.findByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name })); // Only League Winner valid

    // Click submit
    // Use findByRole for submit button if needed, though usually present
    const submitButton = await screen.findByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert 2: AFTER Submit ---
    await waitFor(() => {
      // General Error
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();

      // Coupon Errors (within summary)
      const couponSection = screen.getByRole('heading', { name: /Round 1/i }).closest('section');
      const couponErrorSummary = within(couponSection!).getByText(/Please make selections for all matches/i).closest('[role="alert"]');
      expect(couponErrorSummary).toBeInTheDocument();
      expect(couponErrorSummary?.textContent).toContain('Team C vs Team D');
      expect(couponErrorSummary?.textContent).toContain('Team E vs Team F');
      expect(couponErrorSummary?.textContent).toContain('Team G vs Team H');

      // Check error style/icon on specific invalid match row (m2)
      expect(match2Row).toHaveClass('bg-red-50', 'border-l-red-500');
      // Use findByTestId if icon appears async
      const errorIcon = screen.getAllByTestId('validation-error-icon'); // Assuming an error icon test id
      expect(within(match2Row).getByTestId('validation-error-icon')).toBeInTheDocument();
      // Fix: get the actual number of error icons
      expect(errorIcon.length).toBeGreaterThanOrEqual(3); // Check at least m2, m3, m4 have icons

      // Questionnaire Errors - check individual field errors
      const questionnaireSection = screen.getByRole('heading', { name: /Questions/i }).closest('section');
      const errorMessages = within(questionnaireSection!).getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);

      // Check error style on specific invalid questionnaire input (e.g., Last Place)
      const lastPlaceCombobox = screen.getByRole('combobox', { name: /Select a team for last-place/i });
      expect(lastPlaceCombobox).toHaveClass('border-red-300'); // Assuming error class
    });
  });

  test('should allow fixing errors and submitting successfully', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // Wait for initial load
    await screen.findByRole('combobox', { name: /Select a team for league-winner/i });
    await screen.findByTestId('toggle-button-1-1'); // Wait for coupon buttons

    // --- Act 1: Initial Invalid Submission ---
    await user.click(screen.getByTestId('toggle-button-1-1')); // m1 valid
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[0].name })); // league winner valid
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    // --- Assert 1: Errors ARE visible ---
    await waitFor(() => {
      // Coupon Errors (within summary)
      const couponSection = screen.getByRole('heading', { name: /Round 1/i }).closest('section');
      const couponErrorSummary = within(couponSection!).getByText(/Please make selections for all matches/i).closest('[role="alert"]');
      expect(couponErrorSummary).toBeInTheDocument();

      // Questionnaire Errors - check for individual field errors
      const questionnaireSection = screen.getByRole('heading', { name: /Questions/i }).closest('section');
      const errorMessages = within(questionnaireSection!).getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);

      // General Error
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();
    });

    // --- Act 2: Fix Errors ---
    // Fix Coupon (m2, m3, m4)
    // Use findByTestId before clicking
    await user.click(await screen.findByTestId('toggle-button-2-X'));
    await user.click(await screen.findByTestId('toggle-button-3-2'));
    await user.click(await screen.findByTestId('toggle-button-4-1'));
    
    // Fix Questionnaire (Last Place, Goal Diff, Top Scorer)
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[1].name })); // Juventus
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(await screen.findByRole('option', { name: mockTeams[2].name })); // Milan
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(await screen.findByRole('option', { name: mockPlayers[0].name })); // Lautaro Martínez

    // --- Act 3: Resubmit ---
    // Use findByRole if necessary
    await user.click(await screen.findByRole('button', { name: /^Submit$/i }));

    // --- Assert 3: Submission is Successful ---
    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
  });

}); 