import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Home from '../page';

// Define mock functions in the outer scope
const mockCouponValidate = jest.fn();
const mockQuestionnaireValidate = jest.fn();

// Mock Child Components using the outer scope mocks
jest.mock('@/components/BettingCoupon/BettingCoupon', () => {
  const MockBettingCoupon = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      validate: mockCouponValidate, // Use the mock function directly
    }));
    return <div data-testid="mock-coupon">Mock Coupon</div>;
  });
  MockBettingCoupon.displayName = 'MockBettingCoupon';
  return MockBettingCoupon;
});

jest.mock('@/components/Questionnaire/Questionnaire', () => {
  const MockQuestionnaire = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      validatePredictions: mockQuestionnaireValidate, // Use the mock function directly
    }));
    return <section aria-label="Questions" data-testid="mock-questionnaire">Mock Questionnaire</section>;
  });
  MockQuestionnaire.displayName = 'MockQuestionnaire';
  return MockQuestionnaire;
});

// Mock window.scrollTo before describe block
window.scrollTo = jest.fn();

describe('Home Page', () => {
  beforeEach(() => {
    // Reset mock function state and set default return value
    mockCouponValidate.mockReset().mockReturnValue({ isValid: true, errors: {} });
    mockQuestionnaireValidate.mockReset().mockReturnValue({ isValid: true, errors: {} });

    jest.clearAllMocks(); // Clear other general mocks like window.scrollTo
    (window.scrollTo as jest.Mock).mockClear();
  });

  it('renders both mocked BettingCoupon and Questionnaire components', async () => {
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-coupon')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Questions/i })).toBeInTheDocument();
      expect(screen.getByTestId('mock-questionnaire')).toBeInTheDocument();
    });
  });
  
  it('validates both components on submission and shows aggregated errors', async function() {
    mockCouponValidate.mockReturnValue({
      isValid: false, 
      errors: { 'match1': 'Coupon Error 1' } 
    });
    mockQuestionnaireValidate.mockReturnValue({
      isValid: false, 
      errors: { 'leagueWinner': 'Questionnaire Error 1' }
    });

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Questions/i })).toBeInTheDocument();
    });
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(async () => {
      expect(screen.getByText(/please fix all errors/i)).toBeInTheDocument(); 
      expect(mockCouponValidate).toHaveBeenCalledTimes(1);
      expect(mockQuestionnaireValidate).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/Coupon Errors:/i)).toBeInTheDocument();
      expect(await screen.findByText(/Questionnaire Errors:/i)).toBeInTheDocument();
      expect(await screen.findByText(/Coupon Error 1/i)).toBeInTheDocument();
      expect(await screen.findByText(/Questionnaire Error 1/i)).toBeInTheDocument();
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
  
  it('does not proceed with submission when validation fails', async function() {
    mockCouponValidate.mockReturnValue({
      isValid: false, 
      errors: { 'match1': 'Coupon Error 1' }
    });
    mockQuestionnaireValidate.mockReturnValue({
      isValid: false, 
      errors: { 'leagueWinner': 'Questionnaire Error 1' }
    });
    
    render(<Home />);
    
    await waitFor(() => {
       expect(screen.getByRole('region', { name: /Questions/i })).toBeInTheDocument();
    });
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/please fix all errors/i)).toBeInTheDocument(); 
    });
    expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your coupon and predictions have been submitted/i)).not.toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('proceeds with submission when validation passes', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Questions/i })).toBeInTheDocument();
    });
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
      expect(screen.getByText(/Your coupon and predictions have been submitted./i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/please fix all errors/i)).not.toBeInTheDocument(); 
    expect(screen.queryByText(/Coupon Errors:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Questionnaire Errors:/i)).not.toBeInTheDocument();
    expect(mockCouponValidate).toHaveBeenCalledTimes(1);
    expect(mockQuestionnaireValidate).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
}); 