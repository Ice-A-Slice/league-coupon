"use client";

import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types
import SectionContainer from '@/components/layout';
import ToggleButton from '../ui/toggle-button'; // Updated import
import { validateCoupon } from '@/schemas/bettingCouponSchema';
import ValidationStatusIndicator from '@/components/ui/ValidationStatusIndicator'; // Added import
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';

// Define the ref interface
export interface BettingCouponRef {
  validate: () => { isValid: boolean; errors?: Record<string, string> };
  getSelections: () => Selections;
}

// Define the component with props and ref
const BettingCoupon = forwardRef<BettingCouponRef, BettingCouponProps>(({ 
  matches, 
  title = 'Current Round',
  initialSelections = {}, 
  onSelectionChange = () => {}, // Add default empty function
  validationErrors
}, ref) => {
  // Use localStorage for selections with fallback to initialSelections
  const [selections, setSelections] = useLocalStorage<Selections>(
    `betting-selections-${title}`, // Use title to make key unique per round
    initialSelections
  );
  // Use the passed-in errors, default to empty object
  const errors = validationErrors || {};

  // Define button labels
  const selectionLabels: SelectionType[] = ['1', 'X', '2'];

  // Expose validation method via ref
  useImperativeHandle(ref, () => ({
    validate: () => {
      const result = validateSelections();
      return result;
    },
    getSelections: () => {
      return selections;
    }
  }));

  // Validate selections using the Zod schema (for immediate validation on demand)
  const validateSelections = () => {
    // Use the new validateCoupon function that combines structure and completeness validation
    const result = validateCoupon(matches, selections);
    
    // NOTE: Internal validation might still be useful for immediate feedback,
    // but the primary validation now happens in the parent via helpers.
    // We'll rely on the passed-in `validationErrors` for display.
    // if (!result.isValid && result.errors) {
    //   setInternalErrors(result.errors);
    // } else {
    //   setInternalErrors({});
    // }
    
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
      // NOTE: Clearing errors passed via props isn't ideal here.
      // The parent component (`page.tsx`) is now responsible for clearing errors
      // when handleCombinedSubmit is called again. We remove the internal clearing.
      // setInternalErrors(prev => { ... }); 
    }
    
    // Update state immediately
    setSelections(newSelections);
    
    // Call the callback function immediately if it exists
    // Pass both the new selections object and the specific matchId that changed
    onSelectionChange(newSelections, matchIdStr); 
  };

  // Sync with initialSelections if they change externally (only if localStorage is empty)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    // Only override localStorage if there are actual initialSelections and localStorage is empty
    const hasStoredData = Object.keys(selections).length > 0;
    const hasInitialData = initialSelections && Object.keys(initialSelections).length > 0;
    
    if (hasInitialData && !hasStoredData) {
      setSelections(initialSelections);
    }
  }, [initialSelections]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Content for the betting coupon
  const couponContent = (
    <div className="w-full flex flex-col items-stretch p-2 overflow-x-visible">
      {matches.map((match: Match) => {
        const matchIdStr = match.id.toString();
        const currentSelection = selections[matchIdStr];
        // Check for specific match error from props
        const hasError = !!errors[`match_${matchIdStr}`] || !!errors[matchIdStr]; // Check both formats potentially used by helper
        const isSelected = currentSelection !== null && currentSelection !== undefined;

        return (
          <div 
            key={matchIdStr} 
            className={`flex w-full flex-row items-center justify-between border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150 py-2 sm:py-3`}
          >
            {/* Match Info - Apply conditional background/border/padding here */}
            <div className={`flex-1 mr-2 sm:mr-3 flex items-center rounded-md transition-colors duration-150 ${
              hasError 
                ? 'border-l-4 border-l-red-500 px-2 sm:px-3 py-1'
                : (isSelected && !hasError) 
                  ? 'border-l-4 border-l-green-500 px-2 sm:px-3 py-1'
                  : 'px-2 sm:px-3 py-1'
            }`}>
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
                {!isSelected && !hasError && (
                  <span className="text-xs text-gray-400 mt-1">
                    Choose: 1 (Home win), X (Draw), or 2 (Away win)
                  </span>
                )}
              </div>
            </div>
            {/* Selection Buttons using ToggleButton - Add padding to match inner div's horizontal padding */}
            <div className="flex space-x-1.5 sm:space-x-3 flex-shrink-0 self-center px-2 sm:px-3">
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
      title={title}
      subtitle="Select match outcomes to fill your coupon"
      collapsible={false}
      aria-label={`${title} Betting Coupon`}
    >
      {couponContent}
    </SectionContainer>
  );
});

BettingCoupon.displayName = "BettingCoupon";

export default BettingCoupon; 