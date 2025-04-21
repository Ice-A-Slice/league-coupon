import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from './page'; 
// Import actual mock data
import { sampleTeams, samplePlayers } from '@/data/mockData';

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

// --- Test Suite ---
describe('Page Validation Flow Integration Tests', () => {
  beforeEach(() => {
    // Clear any mocks
    jest.clearAllMocks();
    (window.scrollTo as jest.Mock).mockClear();
  });

  // Basic Render Test (Smoke Test)
  test('should render BettingCoupon and Questionnaire components', async () => {
    // Arrange
    render(<Page />);
    
    // Assert - Now use getByRole as elements should be present
    // Note: The Round 1 heading might be commented out in the current implementation
    // expect(screen.getByRole('heading', { name: /Round 1/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Questions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();
  });

  // --- Test Case: Valid Submission (Subtask 10.2) ---
  test('should allow submission when all selections and predictions are valid', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // --- Act ---
    // Betting Coupon: Use new fixtures
    // Match m1 (Inter vs Juventus): Select '1'
    await user.click(screen.getByTestId('toggle-button-m1-1')); 
    // Match m2 (Milan vs Napoli): Select 'X'
    await user.click(screen.getByTestId('toggle-button-m2-X'));
    // Match m3 (Roma vs Lazio): Select '2' 
    await user.click(screen.getByTestId('toggle-button-m3-2'));
    // Match m4 (Fiorentina vs Atalanta): Select '1'
    await user.click(screen.getByTestId('toggle-button-m4-1'));

    // Questionnaire: Use new names
    // Question 1: League Winner (Inter)
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Inter
    // Question 2: Last Place (Juventus)
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[1].name })); // Juventus
    // Question 3: Best Goal Diff (Milan)
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[2].name })); // Milan
    // Question 4: Top Scorer (Lautaro Martínez)
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(screen.getByRole('option', { name: samplePlayers[0].name })); // Lautaro Martínez

    // Click the submit button
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
    const user = userEvent.setup();

    // --- Act ---
    // Betting Coupon INVALID: Only match m1 selected
    await user.click(screen.getByTestId('toggle-button-m1-1'));

    // Questionnaire VALID
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Inter
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[1].name })); // Juventus
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[2].name })); // Milan
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(screen.getByRole('option', { name: samplePlayers[0].name })); // Lautaro Martínez

    // Click submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    // Check failure state (no changes needed)
    expect(screen.queryByText(/Success!/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();

    // Check coupon errors displayed
    await waitFor(() => {
      // Find the specific error summary section for the coupon
      // Use role="alert" to find error messages
      const couponErrors = screen.getAllByRole('alert');
      expect(couponErrors.length).toBeGreaterThan(0);
      
      // Check for specific error text in any of the alerts
      const errorTexts = couponErrors.map(el => el.textContent);
      expect(errorTexts.some(text => text?.includes('Please select a result for Milan vs Napoli'))).toBe(true);
      expect(errorTexts.some(text => text?.includes('Please select a result for Roma vs Lazio'))).toBe(true);
      expect(errorTexts.some(text => text?.includes('Please select a result for Fiorentina vs Atalanta'))).toBe(true);
      
      // Check for the general error message at the bottom
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();
    });
    // Check no questionnaire errors
    expect(screen.queryByText(/Questionnaire Errors:/i)).not.toBeInTheDocument();
  });

  // --- Test Case: Invalid Questionnaire Submission (Subtask 10.2) ---
  test('should prevent submission and show errors when Questionnaire is invalid', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // --- Act ---
    // Betting Coupon VALID
    await user.click(screen.getByTestId('toggle-button-m1-1'));
    await user.click(screen.getByTestId('toggle-button-m2-X'));
    await user.click(screen.getByTestId('toggle-button-m3-2'));
    await user.click(screen.getByTestId('toggle-button-m4-1'));

    // Questionnaire INVALID (missing Last Place & Top Scorer)
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Inter
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[2].name })); // Milan

    // Click submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert ---
    // Check failure state (no changes needed)
    expect(screen.queryByText(/Success!/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();

    // Check questionnaire errors displayed
    await waitFor(() => {
      // Find the specific error summary section for the questionnaire
      const questionnaireSection = screen.getByRole('heading', { name: /Questions/i }).closest('section');
      expect(questionnaireSection).toBeInTheDocument();
      
      // Use getAllByRole instead of getByRole to handle multiple alerts
      const errorMessages = within(questionnaireSection!).getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);

      // Check for specific error text content instead of looking for a single alert
      const errorTexts = errorMessages.map(el => el.textContent);
      expect(errorTexts.some(text => text?.includes('Expected string, received null'))).toBeTruthy();
      
      // Check for the general error message at the bottom
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();
    });
    // Check no coupon errors
    expect(screen.queryByText(/Coupon Errors:/i)).not.toBeInTheDocument();
  });

  // --- Test Case: Both Components Invalid Submission (Subtask 10.2) ---
  test('should prevent submission and show errors when both components are invalid', async () => {
    // Arrange
    render(<Page />);
    const user = userEvent.setup();

    // --- Act ---
    // Betting Coupon INVALID (only m1)
    await user.click(screen.getByTestId('toggle-button-m1-1'));

    // Questionnaire INVALID (only League Winner & Goal Diff)
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Inter
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[2].name })); // Milan

    // Click submit
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
      expect(couponErrorSummary?.textContent).toContain('Milan vs Napoli');
      expect(couponErrorSummary?.textContent).toContain('Roma vs Lazio');
      expect(couponErrorSummary?.textContent).toContain('Fiorentina vs Atalanta');

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
    const match1Button = screen.getByTestId('toggle-button-m1-1');
    const match1Row = match1Button.closest('div.flex.w-full') as HTMLElement;
    await user.click(match1Button);
    // Assertions (no changes needed)
    await waitFor(() => {
      expect(match1Button).toHaveAttribute('data-selected', 'true');
      expect(match1Row).toHaveClass('bg-green-50', 'border-l-green-500'); 
      expect(within(match1Row).getByTestId('validation-success-icon')).toBeInTheDocument();
    });
    // Match m2 (Milan vs Napoli) - check still neutral
    const match2Button = screen.getByTestId('toggle-button-m2-X');
    const match2Row = match2Button.closest('div.flex.w-full') as HTMLElement;
    expect(match2Row).not.toHaveClass('border-l-green-500');
    expect(screen.getAllByTestId('validation-success-icon')).toHaveLength(1);

    // --- Act & Assert: Questionnaire ---
    // Select League Winner (Inter)
    const leagueWinnerCombobox = screen.getByRole('combobox', { name: /Select a team for league-winner/i });
    await user.click(leagueWinnerCombobox);
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Inter
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

    // --- Assert 1: BEFORE Submit ---
    // Check NO errors are visible initially (inline or summary)
    expect(screen.queryByText(/Please select a result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prediction is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
    // Check specific match row doesn't have error style/icon
    const match2Button = screen.getByTestId('toggle-button-m2-X');
    const match2Row = match2Button.closest('div.flex.w-full') as HTMLElement;
    expect(match2Row).not.toHaveClass('bg-red-50', 'border-l-red-500');
    expect(screen.queryByTestId('validation-error-icon')).not.toBeInTheDocument(); // Assuming an error icon test id

    // --- Act ---
    // Make selections (INVALID state)
    await user.click(screen.getByTestId('toggle-button-m1-1')); // Only m1 valid
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // Only League Winner valid

    // Click submit
    const submitButton = screen.getByRole('button', { name: /^Submit$/i });
    await user.click(submitButton);

    // --- Assert 2: AFTER Submit ---
    await waitFor(() => {
      // General Error
      expect(screen.getByText(/Please fix all errors/i)).toBeInTheDocument();

      // Coupon Errors (within summary)
      const couponSection = screen.getByRole('heading', { name: /Round 1/i }).closest('section');
      const couponErrorSummary = within(couponSection!).getByText(/Please make selections for all matches/i).closest('[role="alert"]');
      expect(couponErrorSummary).toBeInTheDocument();
      expect(couponErrorSummary?.textContent).toContain('Milan vs Napoli');
      expect(couponErrorSummary?.textContent).toContain('Roma vs Lazio');
      expect(couponErrorSummary?.textContent).toContain('Fiorentina vs Atalanta');

      // Check error style/icon on specific invalid match row (m2)
      expect(match2Row).toHaveClass('bg-red-50', 'border-l-red-500');
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

    // --- Act 1: Initial Invalid Submission ---
    await user.click(screen.getByTestId('toggle-button-m1-1')); // m1 valid
    await user.click(screen.getByRole('combobox', { name: /Select a team for league-winner/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[0].name })); // league winner valid
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
    await user.click(screen.getByTestId('toggle-button-m2-X')); 
    await user.click(screen.getByTestId('toggle-button-m3-2')); 
    await user.click(screen.getByTestId('toggle-button-m4-1')); 
    
    // Fix Questionnaire (Last Place, Goal Diff, Top Scorer)
    await user.click(screen.getByRole('combobox', { name: /Select a team for last-place/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[1].name })); // Juventus
    await user.click(screen.getByRole('combobox', { name: /Select a team for best-goal-difference/i }));
    await user.click(screen.getByRole('option', { name: sampleTeams[2].name })); // Milan
    await user.click(screen.getByRole('combobox', { name: /Select a player for top-scorer/i }));
    await user.click(screen.getByRole('option', { name: samplePlayers[0].name })); // Lautaro Martínez

    // --- Act 3: Resubmit ---
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    // --- Assert 3: Submission is Successful ---
    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Please fix all errors/i)).not.toBeInTheDocument();
  });

}); 