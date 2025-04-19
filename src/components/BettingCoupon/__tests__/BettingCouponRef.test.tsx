import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import BettingCoupon, { BettingCouponRef } from '../BettingCoupon';
import type { Match } from '../types';

// Mock matches for testing
const mockMatches: Match[] = [
  { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' },
  { id: '2', homeTeam: 'Team C', awayTeam: 'Team D' },
  { id: '3', homeTeam: 'Team E', awayTeam: 'Team F' }
];

describe('BettingCoupon Ref Integration', () => {
  it('exposes validation function through ref that returns correct structure', async () => {
    // Create a ref to access the validate method
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon
        ref={ref}
        matches={mockMatches}
      />
    );
    
    // Validate with no selections (should be invalid)
    await act(async () => {
      const validationResult = ref.current?.validate();
      expect(validationResult).toBeDefined();
      expect(validationResult?.isValid).toBe(false);
      expect(validationResult?.errors).toBeDefined();
      
      // We should have errors for all three matches
      expect(Object.keys(validationResult?.errors || {})).toHaveLength(3);
    });
  });
  
  it('validates as valid when all matches have selections', async () => {
    // Create a ref to access the validate method
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon
        ref={ref}
        matches={mockMatches}
        initialSelections={{
          '1': '1',
          '2': 'X',
          '3': '2'
        }}
      />
    );
    
    // Validate with all selections made (should be valid)
    await act(async () => {
      const validationResult = ref.current?.validate();
      expect(validationResult).toBeDefined();
      expect(validationResult?.isValid).toBe(true);
      expect(validationResult?.errors).toBeUndefined();
    });
  });
  
  it('updates validation result after user interactions', async () => {
    // Create a ref to access the validate method
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon
        ref={ref}
        matches={mockMatches}
      />
    );
    
    // Initial validation (should be invalid)
    await act(async () => {
      const initialResult = ref.current?.validate();
      expect(initialResult?.isValid).toBe(false);
    });
    
    // Make selections for all matches more explicitly
    const homeWinButtons = screen.getAllByText('1'); // 3 buttons with '1'
    const drawButtons = screen.getAllByText('X'); // 3 buttons with 'X'
    const awayWinButtons = screen.getAllByText('2'); // 3 buttons with '2'
    
    // Click each button one by one with separate act calls to ensure proper state updates
    await act(async () => {
      fireEvent.click(homeWinButtons[0]); // Select '1' for first match
    });
    
    await act(async () => {
      fireEvent.click(drawButtons[1]); // Select 'X' for second match
    });
    
    await act(async () => {
      fireEvent.click(awayWinButtons[2]); // Select '2' for third match
    });
    
    // Validate again after making selections (should be valid)
    await act(async () => {
      const finalResult = ref.current?.validate();
      expect(finalResult?.isValid).toBe(true);
      expect(finalResult?.errors).toBeUndefined();
    });
  });
}); 