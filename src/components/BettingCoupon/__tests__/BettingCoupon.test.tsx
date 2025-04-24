import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BettingCoupon, { BettingCouponRef } from '../BettingCoupon';
import type { Match, Selections } from '../types';

// Mock matches for testing with real team names
const mockMatches: Match[] = [
  { id: '1', homeTeam: 'Real Madrid', awayTeam: 'Arsenal' },
  { id: '2', homeTeam: 'Inter', awayTeam: 'Bayern München' },
  { id: '3', homeTeam: 'Newcastle', awayTeam: 'Crystal Palace' }
];

describe('BettingCoupon', () => {
  it('renders all matches', () => {
    render(<BettingCoupon matches={mockMatches} />);
    
    // Check that all team names are displayed
    expect(screen.getByText('Real Madrid')).toBeInTheDocument();
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Inter')).toBeInTheDocument();
    expect(screen.getByText('Bayern München')).toBeInTheDocument();
    expect(screen.getByText('Newcastle')).toBeInTheDocument();
    expect(screen.getByText('Crystal Palace')).toBeInTheDocument();
    
    // Check that all selection buttons are displayed
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(9); // 3 buttons per match, 3 matches
  });
  
  it('allows selection of match outcomes', () => {
    const handleSelectionChange = jest.fn();
    render(
      <BettingCoupon 
        matches={mockMatches} 
        onSelectionChange={handleSelectionChange} 
      />
    );
    
    // Select home win for first match
    const homeWinButton = screen.getAllByText('1')[0];
    fireEvent.click(homeWinButton);
    
    // Check that the callback was called with the first selection
    expect(handleSelectionChange).toHaveBeenCalledTimes(1);
    expect(handleSelectionChange.mock.calls[0][0]).toEqual({
      '1': '1'
    });
    
    // Select draw for second match
    const drawButton = screen.getAllByText('X')[1];
    fireEvent.click(drawButton);
    
    // Check that the callback was called a second time
    expect(handleSelectionChange).toHaveBeenCalledTimes(2);
    // Verify the second call has at least the second selection
    expect(handleSelectionChange.mock.calls[1][0]).toHaveProperty('2', 'X');
  });
  
  it('de-selects when clicking the same button twice', () => {
    const handleSelectionChange = jest.fn();
    const initialSelections: Selections = {
      '1': '1',
      '2': 'X'
    };
    
    render(
      <BettingCoupon 
        matches={mockMatches} 
        initialSelections={initialSelections}
        onSelectionChange={handleSelectionChange} 
      />
    );
    
    // Click the already selected home win button for first match
    const homeWinButton = screen.getAllByText('1')[0];
    fireEvent.click(homeWinButton);
    
    // Check that the selection was removed
    expect(handleSelectionChange).toHaveBeenCalledWith({
      '2': 'X'
    });
  });
  
  it('exposes validation function via ref', async () => {
    // Create a ref
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon 
        ref={ref}
        matches={mockMatches} 
      />
    );
    
    // Validate with no selections (should be invalid)
    let emptyResult;
    await act(async () => {
      emptyResult = ref.current?.validate();
    });
    expect(emptyResult).toBeDefined();
    expect(emptyResult?.isValid).toBe(false);
    expect(emptyResult?.errors).toBeDefined();
    
    // We should have errors for all three matches
    expect(Object.keys(emptyResult?.errors || {})).toHaveLength(3);
    
    // Properly select options using fireEvent instead of accessing React internals
    const homeWinButtons = screen.getAllByText('1');
    const drawButton = screen.getAllByText('X')[1];
    const awayWinButton = screen.getAllByText('2')[2];
    
    // Make selections for all three matches
    await act(async () => {
      fireEvent.click(homeWinButtons[0]); // 1 for first match
      fireEvent.click(drawButton); // X for second match
      fireEvent.click(awayWinButton); // 2 for third match
    });
    
    // Check that validation function runs and returns expected structure
    let validResult;
    await act(async () => {
      validResult = ref.current?.validate();
    });
    expect(validResult).toBeDefined();
    expect(typeof validResult?.isValid).toBe('boolean');
  });
  
  it('applies error styling when validation errors are passed', () => {
    // Create a ref
    const ref = React.createRef<BettingCouponRef>();
    
    // Mock errors passed from parent
    const mockErrors = {
      'match_1': 'Error for match 1',
      'match_3': 'Error for match 3'
    };

    render(
      <BettingCoupon 
        ref={ref}
        matches={mockMatches} 
        validationErrors={mockErrors} // Pass mock errors
      />
    );

    // Find the match rows. We expect the rows for match 1 and 3 to have error styling.
    // Let's check for the border class `border-l-red-500` which is applied to the main div of the row.
    const matchRows = screen.getAllByText(/Real Madrid|Inter|Newcastle/).map(el => el.closest('div.flex.w-full'));

    // Match 1 row (index 0)
    expect(matchRows[0]).toHaveClass('border-l-red-500');

    // Match 2 row (index 1) - Should NOT have error styling
    expect(matchRows[1]).not.toHaveClass('border-l-red-500');

    // Match 3 row (index 2)
    expect(matchRows[2]).toHaveClass('border-l-red-500');
  });
  
  it('applies error styling but does not display summary text internally', () => {
    // Create a ref
    const ref = React.createRef<BettingCouponRef>();
    const mockErrors = {
      form: 'General form error from parent',
      match_2: 'Error for match 2'
    };
    
    render(
      <BettingCoupon 
        ref={ref}
        matches={mockMatches} 
        validationErrors={mockErrors}
      />
    );

    // Check that the error summary passed via props IS NOT displayed by this component
    const summaryHeading = screen.queryByText('General form error from parent');
    expect(summaryHeading).not.toBeInTheDocument();

    const summaryHeadingDefault = screen.queryByText('Please make selections for all matches:'); // Check old message too
    expect(summaryHeadingDefault).not.toBeInTheDocument();
    
    // Check that specific error message TEXT is NOT displayed by this component
    const specificErrorText = screen.queryByText('Error for match 2');
    expect(specificErrorText).not.toBeInTheDocument();
    
    // Check that error styling IS applied to the correct match row (match 2)
    const matchRows = screen.getAllByText(/Real Madrid|Inter|Newcastle/).map(el => el.closest('div.flex.w-full'));
    expect(matchRows[0]).not.toHaveClass('border-l-red-500');
    expect(matchRows[1]).toHaveClass('border-l-red-500');
    expect(matchRows[2]).not.toHaveClass('border-l-red-500');
  });
  
  it('maintains multiple selections across different matches', () => {
    const handleSelectionChange = jest.fn();
    render(
      <BettingCoupon 
        matches={mockMatches} 
        onSelectionChange={handleSelectionChange} 
      />
    );
    
    // Select home win for first match
    const homeWinButton = screen.getAllByText('1')[0];
    fireEvent.click(homeWinButton);
    
    // Select draw for second match
    const drawButton = screen.getAllByText('X')[1];
    fireEvent.click(drawButton);
    
    // Select away win for third match
    const awayWinButton = screen.getAllByText('2')[2];
    fireEvent.click(awayWinButton);
    
    // Check that the callback was called three times
    expect(handleSelectionChange).toHaveBeenCalledTimes(3);
    
    // Verify the final selection state includes all three selections
    const finalSelections = handleSelectionChange.mock.calls[2][0];
    expect(finalSelections).toHaveProperty('1', '1');
    expect(finalSelections).toHaveProperty('2', 'X');
    expect(finalSelections).toHaveProperty('3', '2');
  });
}); 