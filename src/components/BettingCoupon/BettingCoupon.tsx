"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types
import SectionContainer from '@/components/layout';
import ToggleButton from '../ui/toggle-button'; // Updated import
import { validateCoupon } from '@/schemas/bettingCouponSchema';
import ValidationStatusIndicator from '@/components/ui/ValidationStatusIndicator'; // Added import

// Define the ref interface
export interface BettingCouponRef {
  validate: () => { isValid: boolean; errors?: Record<string, string> };
}

// Define the component with props and ref
const BettingCoupon = forwardRef<BettingCouponRef, BettingCouponProps>(({ 
  matches, 
  initialSelections = {}, 
  onSelectionChange 
}, ref) => {
  // State for current selections
  const [selections, setSelections] = useState<Selections>(initialSelections);
  // State for validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Define button labels
  const selectionLabels: SelectionType[] = ['1', 'X', '2'];

  // Expose validation method via ref
  useImperativeHandle(ref, () => ({
    validate: () => {
      const result = validateSelections();
      return result;
    }
  }));

  // Validate selections using the Zod schema (for immediate validation on demand)
  const validateSelections = () => {
    // Use the new validateCoupon function that combines structure and completeness validation
    const result = validateCoupon(matches, selections);
    
    if (!result.isValid && result.errors) {
      setErrors(result.errors);
    } else {
      setErrors({});
    }
    
    return result;
  };

  // Handle button click
  const handleSelect = (matchId: string | number, selection: SelectionType) => {
    const matchIdStr = matchId.toString();
    
    // Create new selections object
    let newSelections: Selections;
    
    if (selections[matchIdStr] === selection) {
      // If the same option is clicked again, toggle it off (remove the selection)
      
      // Create a copy and remove the key for this match
      newSelections = { ...selections };
      delete newSelections[matchIdStr];
      
    } else {
      
      // Create new selections object with the new selection
      newSelections = {
        ...selections,
        [matchIdStr]: selection,
      };
    }
    
    // Restore immediate error clearing for the specific match
    if (errors[matchIdStr]) {
      setErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [matchIdStr]: _, ...rest } = prev;
        return rest;
      });
    }
    
    // Update state immediately
    setSelections(newSelections);
    
    // Call the callback function immediately if it exists
    if (onSelectionChange) {
      onSelectionChange(newSelections);
    } else {
    }
  };

  // Sync state if initialSelections prop changes externally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (initialSelections && JSON.stringify(initialSelections) !== JSON.stringify({})) {
      // Only update if there are actual initialSelections and they differ from current
      if (JSON.stringify(selections) !== JSON.stringify(initialSelections)) {
        setSelections(initialSelections);
      }
    }
  }, [initialSelections]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Content for the betting coupon
  const couponContent = (
    <div className="w-full flex flex-col items-stretch p-2 overflow-x-visible">
      {/* Summary error message when validation errors exist */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
          <p className="font-semibold mb-1">Please make selections for all matches:</p>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([matchId, error]) => {
              const match = matches.find(m => m.id.toString() === matchId);
              return (
                <li key={matchId}>
                  {match ? `${match.homeTeam} vs ${match.awayTeam}` : `Match ${matchId}`}: {error}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {matches.map((match: Match) => {
        const matchIdStr = match.id.toString();
        const currentSelection = selections[matchIdStr];
        const hasError = !!errors[matchIdStr];
        const isSelected = currentSelection !== null && currentSelection !== undefined;

        return (
          <div 
            key={matchIdStr} 
            className={`flex w-full flex-row items-center justify-between p-2 sm:p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150 ${
              hasError ? 'bg-red-50 border-l-4 border-l-red-500' : 
              (isSelected && !hasError) ? 'bg-green-50 border-l-4 border-l-green-500' : ''
            }`}
          >
            {/* Match Info - Left aligned team names on separate lines with equal styling */}
            <div className="flex-1 mr-2 sm:mr-3 flex items-center">
              <ValidationStatusIndicator 
                hasError={hasError}
                isValid={isSelected && !hasError}
                className="mr-2 flex-shrink-0"
              />
              <div className="flex flex-col text-left">
                <span className={`text-sm sm:text-base ${hasError ? 'text-red-700 font-medium' : 'text-gray-800'}`}>
                  {match.homeTeam}
                </span>
                <span className={`text-sm sm:text-base ${hasError ? 'text-red-700 font-medium' : 'text-gray-800'}`}>
                  {match.awayTeam}
                </span>
                {hasError && (
                  <span className="text-xs text-red-500 mt-1 font-medium">{errors[matchIdStr]}</span>
                )}
                {isSelected && !hasError && (
                  <span className="text-xs text-green-600 mt-1 font-medium">
                    You selected: {currentSelection}
                  </span>
                )}
                {!isSelected && !hasError && (
                  <span className="text-xs text-gray-400 mt-1">
                    Choose: 1 (Home win), X (Draw), or 2 (Away win)
                  </span>
                )}
              </div>
            </div>
            {/* Selection Buttons using ToggleButton */}
            <div className="flex space-x-1.5 sm:space-x-3 flex-shrink-0 self-center">
              {selectionLabels.map((label) => {
                const isSelected = currentSelection === label;
                return (
                  <ToggleButton
                    key={label}
                    label={label}
                    isSelected={isSelected}
                    onClick={() => handleSelect(match.id, label)}
                    className={hasError ? "ring-1 ring-red-300" : ""}
                    data-match-id={matchIdStr}
                    data-selection={label}
                    data-testid={`toggle-button-${matchIdStr}-${label}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <SectionContainer
      title="Round 1"
      subtitle="Select match outcomes to fill your coupon"
      collapsible={false}
      aria-label="Round 1 Betting Coupon"
    >
      {couponContent}
    </SectionContainer>
  );
});

BettingCoupon.displayName = "BettingCoupon";

export default BettingCoupon; 