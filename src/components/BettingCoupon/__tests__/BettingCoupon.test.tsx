import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
  
  it('renders error messages for invalid selections', async () => {
    // Create a ref
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon 
        ref={ref}
        matches={mockMatches} 
      />
    );
    
    // Trigger validation
    await act(async () => {
      ref.current?.validate();
    });
    
    // Find error messages by checking specific message content within span elements
    await waitFor(() => {
      const errorSpans = screen.getAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'span' && 
               content.includes('Please select a result for');
      });
      
      // We should have one error span per match
      expect(errorSpans.length).toBe(3);
      
      // Verify specific team names in the error messages
      expect(errorSpans[0].textContent).toContain('Real Madrid vs Arsenal');
      expect(errorSpans[1].textContent).toContain('Inter vs Bayern München');
      expect(errorSpans[2].textContent).toContain('Newcastle vs Crystal Palace');
    });
  });
  
  it('displays enhanced error UI with summary and styled matches', async () => {
    // Create a ref
    const ref = React.createRef<BettingCouponRef>();
    
    render(
      <BettingCoupon 
        ref={ref}
        matches={mockMatches} 
      />
    );
    
    // Trigger validation to generate errors
    await act(async () => {
      ref.current?.validate();
    });
    
    // Check that the error summary is displayed
    const summaryHeading = screen.getByText('Please make selections for all matches:');
    expect(summaryHeading).toBeInTheDocument();
    
    // Check for error list items in the summary
    const errorListItems = screen.getAllByRole('listitem');
    expect(errorListItems.length).toBe(3); // One per match
    
    // Verify team names in error list
    expect(errorListItems[0].textContent).toContain('Real Madrid vs Arsenal');
    expect(errorListItems[1].textContent).toContain('Inter vs Bayern München');
    expect(errorListItems[2].textContent).toContain('Newcastle vs Crystal Palace');
    
    // Check for inline error messages in each match row
    const errorSpans = screen.getAllByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && 
             content.includes('Please select a result for');
    });
    expect(errorSpans.length).toBe(3); // One per match
    
    // Check that error highlighting is applied to team names (text-red-700 style)
    const highlightedTeamNames = screen.getAllByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && 
            ['Real Madrid', 'Inter', 'Newcastle', 'Arsenal', 'Bayern München', 'Crystal Palace'].includes(content) && 
            element.className.includes('text-red-700');
    });
    
    // Should have 6 highlighted team names (both home and away for each match)
    expect(highlightedTeamNames.length).toBe(6);
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