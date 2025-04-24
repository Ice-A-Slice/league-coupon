import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers

// Import the component to test
import Page from './page'; 

// Import the service function to mock it
import { submitPredictions } from '@/services/submissionService';

// Import types for mock data
import type { Selections } from "@/components/BettingCoupon/types";
// Removed unused SeasonAnswers import
// import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";
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

// --- Mock Child Components and Refs ---
// Mock implementation needs to provide the ref methods
const mockSelections: Selections = { '1': '1' };
const mockAnswers: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 10, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: 11, answered_player_id: null },
  { question_type: 'best_goal_difference', answered_team_id: 12, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
];

jest.mock('@/components/BettingCoupon/BettingCoupon', () => {
  const MockBettingCoupon = React.forwardRef<BettingCouponRef, BettingCouponProps>((props, ref) => {
    // Expose necessary ref methods
    React.useImperativeHandle(ref, () => ({
      validate: jest.fn(() => ({ isValid: true, errors: {} })), // Assume valid for happy path
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
     // Expose necessary ref methods
    React.useImperativeHandle(ref, () => ({
      validatePredictions: jest.fn(() => ({ isValid: true, errors: {} })), // Assume valid for happy path
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

  // Add more tests later for:
  // - Validation failures (coupon or questionnaire)
  // - Submission service failure
  // - Displaying loading states when hooks are loading
  // - Displaying error messages when hooks return errors
}); 