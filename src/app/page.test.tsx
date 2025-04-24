import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers

// Import the component to test
import Page from './page'; 

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
    matches: [], // Provide empty array for initial render test
    isLoading: false,
    error: null,
    refetch: jest.fn(), // Mock the refetch function
  })),
}));

// Mock the useQuestionnaireData hook
jest.mock('@/features/questionnaire/hooks/useQuestionnaireData', () => ({
  useQuestionnaireData: jest.fn(() => ({
    teams: [], // Provide empty arrays
    players: [],
    isLoading: false,
    error: null,
    // No refetch needed based on previous check
  })),
}));

// --- Mock Child Components (if they cause issues, otherwise optional) ---
// jest.mock('@/components/BettingCoupon/BettingCoupon', () => {
//   // Forward refs if the parent component interacts with them
//   const MockBettingCoupon = React.forwardRef((props, ref) => (
//     <div data-testid="mock-betting-coupon">{JSON.stringify(props)}</div>
//   ));
//   MockBettingCoupon.displayName = 'MockBettingCoupon';
//   return MockBettingCoupon;
// });

// jest.mock('@/components/Questionnaire/Questionnaire', () => {
//  // Forward refs if the parent component interacts with them
//   const MockQuestionnaire = React.forwardRef((props, ref) => (
//     <div data-testid="mock-questionnaire">{JSON.stringify(props)}</div>
//   ));
//   MockQuestionnaire.displayName = 'MockQuestionnaire';
//   return MockQuestionnaire;
// });


// --- Test Suite ---
describe('Page Component', () => {
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

  // Add more tests later for:
  // - Displaying loading states when hooks are loading
  // - Displaying error messages when hooks return errors
  // - Interaction with BettingCoupon and Questionnaire (if not mocked)
  // - Form submission logic (requires mocking fetch/API calls)
}); 