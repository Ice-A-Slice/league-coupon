import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers

// Import the component to test
import Page from './page'; 

// Import the service function to mock it
import { submitPredictions } from '@/services/submissionService';
// Import helper functions to mock them
import { validateCouponSelections, validateQuestionnaireAnswers } from '@/features/betting/utils/submissionHelpers';

// Import types for mock data
import type { Selections } from "@/components/BettingCoupon/types";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";
// Import Prop and Ref types for component mocks
// Corrected imports for Ref/Props
import type { BettingCouponProps } from "@/components/BettingCoupon/types";
import type { BettingCouponRef } from "@/components/BettingCoupon/BettingCoupon"; 
import type { QuestionnaireProps } from "@/components/Questionnaire/types";
import type { QuestionnaireRef } from "@/components/Questionnaire/Questionnaire";

// --- Mock Custom Hooks ---
// Mock the useAuth hook
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' }, // Provide a mock user
    isLoading: false,
    error: null,
    // Mock any other functions returned by the hook if needed by the component
  })),
}));

// Mock the useFixtures hook
jest.mock('@/features/betting/hooks/useFixtures', () => ({
  useFixtures: jest.fn(() => ({
    matches: [{ id: '1', homeTeam: 'Team A', awayTeam: 'Team B' }], // Provide at least one match for validation
    isLoading: false,
    error: null,
    refetch: jest.fn(), // Mock the refetch function
  })),
}));

// Mock the useQuestionnaireData hook
jest.mock('@/features/questionnaire/hooks/useQuestionnaireData', () => ({
  useQuestionnaireData: jest.fn(() => ({
    teams: [{ id: 10, name: 'Team X'}], // Provide minimal data
    players: [{ id: 101, name: 'Player Y'}],
    isLoading: false,
    error: null,
    // No refetch needed based on previous check
  })),
}));

// --- Mock Service --- 
// Mock the submission service function
jest.mock('@/services/submissionService', () => ({
  submitPredictions: jest.fn(), // We'll configure return value per test
}));

// --- Mock Helper Functions ---
jest.mock('@/features/betting/utils/submissionHelpers', () => ({
  validateCouponSelections: jest.fn(),
  validateQuestionnaireAnswers: jest.fn(),
  // Keep original implementation for data preparation functions
  prepareBetSubmissionData: jest.requireActual('@/features/betting/utils/submissionHelpers').prepareBetSubmissionData,
  prepareAnswersSubmissionData: jest.requireActual('@/features/betting/utils/submissionHelpers').prepareAnswersSubmissionData,
}));

// --- Mock Child Components and Refs ---
// Mock implementation needs to provide the ref methods
const mockSelections: Selections = { '1': '1' };
const mockAnswers: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 10, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: 11, answered_player_id: null },
  { question_type: 'best_goal_difference', answered_team_id: 12, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
];

// We need to store the props passed to the mocks to access callbacks
let mockBettingCouponProps: BettingCouponProps | null = null;
let mockQuestionnaireProps: QuestionnaireProps | null = null;

jest.mock('@/components/BettingCoupon/BettingCoupon', () => {
  const MockBettingCoupon = React.forwardRef<BettingCouponRef, BettingCouponProps>((props, ref) => {
    // Store props to access callbacks later
    mockBettingCouponProps = props;
    // Expose necessary ref methods
    React.useImperativeHandle(ref, () => ({
      // Mock validate - not directly used by handleCombinedSubmit logic path for errors
      validate: jest.fn(() => ({ isValid: true, errors: {} })), 
      getSelections: jest.fn(() => mockSelections),
      // resetSelections: jest.fn(), // Mock if needed
    }));
    return <div data-testid="mock-betting-coupon">Betting Coupon</div>;
  });
  MockBettingCoupon.displayName = 'MockBettingCoupon';
  return MockBettingCoupon;
});

jest.mock('@/components/Questionnaire/Questionnaire', () => {
  const MockQuestionnaire = React.forwardRef<QuestionnaireRef, QuestionnaireProps>((props, ref) => {
    // Store props to access callbacks later
    mockQuestionnaireProps = props;
    // Expose necessary ref methods
    React.useImperativeHandle(ref, () => ({
      // Mock validatePredictions - not directly used by handleCombinedSubmit logic path for errors
      validatePredictions: jest.fn(() => ({ isValid: true, errors: {} })), 
      getAnswers: jest.fn(() => mockAnswers),
      // resetAnswers: jest.fn(), // Mock if needed
    }));
    return <div data-testid="mock-questionnaire">Questionnaire</div>;
  });
  MockQuestionnaire.displayName = 'MockQuestionnaire';
  return MockQuestionnaire;
});

// Mock window.scrollTo
global.scrollTo = jest.fn();

// --- Test Suite ---
describe('Page Component', () => {

  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset helper mocks to default valid state
    (validateCouponSelections as jest.Mock).mockReturnValue({ isValid: true });
    (validateQuestionnaireAnswers as jest.Mock).mockReturnValue({ isValid: true });
    mockBettingCouponProps = null;
    mockQuestionnaireProps = null;
    // Set default mock resolve value for happy path
    (submitPredictions as jest.Mock).mockResolvedValue({
      betsResult: { message: 'Bets OK' },
      answersResult: { message: 'Answers OK' }
    });
  });

  it('renders the main heading', () => {
    // Render the component
    render(<Page />);

    // Assert that the main heading is present
    // Using a case-insensitive match for flexibility
    const heading = screen.getByRole('heading', { name: /league coupon/i }); 
    expect(heading).toBeInTheDocument();

    // You could add more basic assertions here, e.g., checking for the submit button
    // const submitButton = screen.getByRole('button', { name: /submit coupon/i });
    // expect(submitButton).toBeInTheDocument();
  });

  // --- Test handleCombinedSubmit --- 
  it('should call submitPredictions and show success on valid submission', async () => {
    render(<Page />);

    // Find the submit button (ensure it's enabled)
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });
    expect(submitButton).toBeEnabled();

    // Simulate click
    fireEvent.click(submitButton);

    // Check if submit button becomes disabled (optional, good check)
    // await waitFor(() => expect(submitButton).toBeDisabled());

    // Check if the submission service was called
    await waitFor(() => {
      expect(submitPredictions).toHaveBeenCalledTimes(1);
    });

    // Check if it was called with correctly prepared data
    expect(submitPredictions).toHaveBeenCalledWith({
      couponData: mockSelections, // From the ref mock
      answersData: mockAnswers     // From the ref mock
    });

    // Check for success message
    // Use findBy* which includes waitFor
    const successMessage = await screen.findByText(/Answers OK/i);
    expect(successMessage).toBeInTheDocument();

    // Check if submit button is enabled again
    expect(submitButton).toBeEnabled();
  });

  // --- Tests for Validation and Error Handling ---

  it('should display coupon errors and summary when coupon is invalid', async () => {
    // Arrange: Mock the helper to return validation errors
    (validateCouponSelections as jest.Mock).mockReturnValue({
      isValid: false,
      errors: {
        form: 'Coupon general error', // Simulate form error from helper
        match_1: 'Selection missing for Team A vs Team B'
      }
    });

    render(<Page />);
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });

    // Act: Click submit
    fireEvent.click(submitButton);

    // Assert: Check for summary error and that specific coupon error is NOT shown here
    // (Inline errors are responsibility of child component, not tested here)
    await waitFor(() => {
      expect(screen.getByText('Please fix the errors highlighted below.')).toBeInTheDocument();
      expect(screen.queryByText('Selection missing for Team A vs Team B')).not.toBeInTheDocument();
    });
    // Ensure submit wasn't called
    expect(submitPredictions).not.toHaveBeenCalled();
  });

  it('should display questionnaire errors and summary when questionnaire is invalid', async () => {
    // Arrange: Mock the helper to return validation errors
    (validateQuestionnaireAnswers as jest.Mock).mockReturnValue({
      isValid: false,
      errors: {
        form: 'Questionnaire general error', // Simulate form error from helper
        leagueWinner: 'Please select an answer.'
      }
    });

    render(<Page />);
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });

    // Act: Click submit
    fireEvent.click(submitButton);

    // Assert: Check for summary error and that specific question error is NOT shown here
    await waitFor(() => {
      expect(screen.getByText('Please fix the errors highlighted below.')).toBeInTheDocument();
      expect(screen.queryByText('Please select an answer.')).not.toBeInTheDocument();
    });
    // Ensure submit wasn't called
    expect(submitPredictions).not.toHaveBeenCalled();
  });

  it('should clear specific coupon error state when selection changes', async () => {
    // Arrange: Mock the helper to return coupon errors initially
    (validateCouponSelections as jest.Mock).mockReturnValue({
      isValid: false,
      errors: { match_1: 'Error for match 1' }
    });
    render(<Page />);
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });

    // Act 1: Submit to show initial errors
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText('Please fix the errors highlighted below.')).toBeInTheDocument();
    });

    // Act 2: Simulate selection change callback from the mocked child
    // Ensure the prop function exists before calling it
    expect(mockBettingCouponProps?.onSelectionChange).toBeDefined();
    if (mockBettingCouponProps?.onSelectionChange) {
        // Simulate user selecting '1' for match '1'
        const newSelections: Selections = { '1': '1' }; 
        act(() => {
            mockBettingCouponProps!.onSelectionChange!(newSelections, '1');
        });
    }

    // Assert: Check that the summary error remains (as we haven't resubmitted/revalidated)
    // This test primarily confirms the callback can be called and potentially updates state
    // without crashing. Verifying the *visual* disappearance of the inline error 
    // requires testing the child component or E2E tests.
    await waitFor(() => {
        expect(screen.queryByText('Please fix the errors highlighted below.')).not.toBeInTheDocument();
    });
  });

  it('should clear specific questionnaire error state when prediction changes', async () => {
    // Arrange: Mock the helper to return questionnaire errors initially
    (validateQuestionnaireAnswers as jest.Mock).mockReturnValue({
      isValid: false,
      errors: { leagueWinner: 'Error for league winner' }
    });
    render(<Page />);
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });

    // Act 1: Submit to show initial errors
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText('Please fix the errors highlighted below.')).toBeInTheDocument();
    });

    // Act 2: Simulate prediction change callback
    expect(mockQuestionnaireProps?.onPredictionChange).toBeDefined();
    if (mockQuestionnaireProps?.onPredictionChange) {
      act(() => {
        mockQuestionnaireProps!.onPredictionChange!('leagueWinner');
      });
    }

    // Assert: Check summary error remains (as above)
    await waitFor(() => {
      expect(screen.queryByText('Please fix the errors highlighted below.')).not.toBeInTheDocument();
    });
  });

  it('should clear summary error when last specific questionnaire error is cleared', async () => {
    // Arrange: Mock questionnaire helper invalid, coupon helper valid
    (validateCouponSelections as jest.Mock).mockReturnValue({ isValid: true });
    (validateQuestionnaireAnswers as jest.Mock).mockReturnValue({
      isValid: false,
      errors: { 
        form: 'Questionnaire general error', 
        leagueWinner: 'Error for league winner' 
      }
    });
    render(<Page />);
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });

    // Act 1: Submit to show initial error
    fireEvent.click(submitButton);
    const summaryError = await screen.findByText('Please fix the errors highlighted below.');
    expect(summaryError).toBeInTheDocument();

    // Act 2: Simulate prediction change for the last error
    expect(mockQuestionnaireProps?.onPredictionChange).toBeDefined();
    if (mockQuestionnaireProps?.onPredictionChange) {
      act(() => {
        mockQuestionnaireProps!.onPredictionChange!('leagueWinner');
      });
    }

    // Assert: The summary error should disappear because all errors are resolved
    await waitFor(() => {
        expect(screen.queryByText('Please fix the errors highlighted below.')).not.toBeInTheDocument();
    });
  });

  // TODO: Add tests for loading/error states from hooks

  it('should display fixture error when useFixtures hook returns an error', async () => {
    // Arrange: Mock useFixtures to return an error
    (jest.requireMock('@/features/betting/hooks/useFixtures') as {
      useFixtures: jest.Mock;
    }).useFixtures.mockReturnValue({
      matches: [],
      isLoading: false,
      error: 'Network Error fetching fixtures',
      refetch: jest.fn(),
    });

    render(<Page />);

    // Assert: Check that the specific fixture error message is displayed
    const errorMessage = await screen.findByText(/Fixtures Error: Network Error fetching fixtures/i);
    expect(errorMessage).toBeInTheDocument();
    // Assert: Check that the BettingCoupon component is NOT rendered
    expect(screen.queryByTestId('mock-betting-coupon')).not.toBeInTheDocument();
  });

  it('should display questionnaire data error when useQuestionnaireData hook returns an error', async () => {
    // Arrange: Mock useQuestionnaireData to return an error
    (jest.requireMock('@/features/questionnaire/hooks/useQuestionnaireData') as {
      useQuestionnaireData: jest.Mock;
    }).useQuestionnaireData.mockReturnValue({
      teams: [],
      players: [],
      isLoading: false,
      error: 'Database Error fetching questions',
    });

    render(<Page />);

    // Assert: Check that the specific questionnaire data error message is displayed
    const errorMessage = await screen.findByText(/Questionnaire Data Error: Database Error fetching questions/i);
    expect(errorMessage).toBeInTheDocument();
    // Assert: Check that the Questionnaire component is NOT rendered
    expect(screen.queryByTestId('mock-questionnaire')).not.toBeInTheDocument();
  });

  it('should disable submit button if fixture hook returns an error', async () => {
    // Arrange: Mock useFixtures to return an error
    (jest.requireMock('@/features/betting/hooks/useFixtures') as {
      useFixtures: jest.Mock;
    }).useFixtures.mockReturnValue({
      matches: [],
      isLoading: false,
      error: 'Network Error fetching fixtures',
      refetch: jest.fn(),
    });

    render(<Page />);

    // Assert: Check that the submit button is disabled
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });
    expect(submitButton).toBeDisabled();
  });

  it('should disable submit button if questionnaire data hook returns an error', async () => {
    // Arrange: Mock useQuestionnaireData to return an error
    (jest.requireMock('@/features/questionnaire/hooks/useQuestionnaireData') as {
      useQuestionnaireData: jest.Mock;
    }).useQuestionnaireData.mockReturnValue({
      teams: [],
      players: [],
      isLoading: false,
      error: 'Database Error fetching questions',
    });

    render(<Page />);

    // Assert: Check that the submit button is disabled
    const submitButton = screen.getByRole('button', { name: /submit coupon/i });
    expect(submitButton).toBeDisabled();
  });

  // TODO: Add tests for submission service failure

}); 