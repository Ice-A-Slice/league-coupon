import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Home from '../page';

// Mock the BettingCoupon and Questionnaire components
jest.mock('@/components/BettingCoupon', () => {
  return jest.fn(({ ref }) => {
    // Expose validate method through ref
    if (ref) {
      ref.current = {
        validate: jest.fn().mockReturnValue({ isValid: false, errors: { '1': 'No selection made', '2': 'No selection made' } })
      };
    }
    return <div data-testid="betting-coupon">Betting Coupon Mock</div>;
  });
});

jest.mock('@/components/Questionnaire/Questionnaire', () => {
  return jest.fn(({ ref }) => {
    // Expose validatePredictions method through ref
    if (ref) {
      ref.current = {
        validatePredictions: jest.fn().mockReturnValue(false)
      };
    }
    return <div data-testid="questionnaire">Questionnaire Mock</div>;
  });
});

describe('Home Page', () => {
  it('renders both BettingCoupon and Questionnaire components', () => {
    render(<Home />);
    
    expect(screen.getByTestId('betting-coupon')).toBeInTheDocument();
    expect(screen.getByTestId('questionnaire')).toBeInTheDocument();
  });
  
  it('validates both components on submission and shows aggregated errors', async () => {
    render(<Home />);
    
    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // Check for error messages
    await waitFor(() => {
      // Should show both component errors
      expect(screen.getByText(/please make selections for all 2 unselected matches/i)).toBeInTheDocument();
      expect(screen.getByText(/please complete all predictions in the questionnaire/i)).toBeInTheDocument();
      
      // Should show summary error
      expect(screen.getByText(/please fix all errors in both sections before submitting/i)).toBeInTheDocument();
    });
  });
  
  it('does not proceed with submission when validation fails', async () => {
    render(<Home />);
    
    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // Success message should not be shown
    expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your coupon and predictions have been submitted/i)).not.toBeInTheDocument();
  });
}); 