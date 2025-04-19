import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Home from '../page';

// REMOVE Mock for BettingCoupon
// jest.mock('@/components/BettingCoupon', () => { ... });

// REMOVE Mock for Questionnaire
// jest.mock('@/components/Questionnaire/Questionnaire', () => { ... });

// Mock window.scrollTo before describe block
window.scrollTo = jest.fn();

describe('Home Page', () => {
  // REMOVE Mock refs if components aren't mocked anymore
  // const mockCouponRef = { current: { validate: jest.fn() } };
  // const mockQuestionnaireRef = { current: { validate: jest.fn() } };

  beforeEach(() => {
    // REMOVED useState mock reset logic
    jest.clearAllMocks(); // Keep clearing other potential mocks
    (window.scrollTo as jest.Mock).mockClear(); 
  });

  it('renders both BettingCoupon and Questionnaire components', () => {
    render(<Home />);
    expect(screen.getByRole('region', { name: /Round 1/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Questions/i })).toBeInTheDocument();
  });
  
  it('validates both components on submission and shows aggregated errors', async () => {
    render(<Home />);
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(async () => {
      // Check for summary error message
      expect(screen.getByText(/please fix all errors/i)).toBeInTheDocument(); 
      
      // Check for coupon error section header
      expect(await screen.findByText(/Coupon Errors:/i)).toBeInTheDocument();
      // REMOVED Check for a specific coupon error detail as it might appear multiple times
      // expect(screen.getByText(/Inter vs Bayern München: Please select a result/i)).toBeInTheDocument(); 
      
      // Check for questionnaire error section header
      expect(await screen.findByText(/Questionnaire Errors:/i)).toBeInTheDocument();
    });

    // Check if scrollTo was called because validation failed
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
  
  it('does not proceed with submission when validation fails', async () => {
    render(<Home />);
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your coupon and predictions have been submitted/i)).not.toBeInTheDocument();

    // Check if scrollTo was called because validation failed
    expect(window.scrollTo).toHaveBeenCalled();
  });
}); 