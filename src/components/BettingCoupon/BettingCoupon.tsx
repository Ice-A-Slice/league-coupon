"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types
import SectionContainer from '@/components/layout';
import ToggleButton from '../ui/toggle-button'; // Updated import
import { SelectionsSchema, createSelectionsValidator } from '@/schemas/bettingCouponSchema';

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

  // Validate selections using the Zod schema
  const validateSelections = () => {
    // First validate the structure of the selections object
    const structureResult = SelectionsSchema.safeParse(selections);
    if (!structureResult.success) {
      // Handle structure validation errors
      const formattedErrors: Record<string, string> = {};
      structureResult.error.issues.forEach((issue) => {
        // For record validation, path will contain the key with the issue
        const matchId = issue.path.join('.');
        formattedErrors[matchId] = issue.message;
      });
      setErrors(formattedErrors);
      return { isValid: false, errors: formattedErrors };
    }

    // Then validate that all required matches have selections
    const validator = createSelectionsValidator(matches);
    const result = validator(selections);
    
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
    const currentSelection = selections[matchIdStr];
    let newSelections: Selections;

    if (currentSelection === selection) {
      // Deselect if the same button is clicked again
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [matchIdStr]: _, ...rest } = selections;
      newSelections = rest;
    } else {
      // Select the new option (or change selection)
      newSelections = {
        ...selections,
        [matchIdStr]: selection,
      };
    }
    
    // Clear any error for this match
    if (errors[matchIdStr]) {
      setErrors(prev => {
        const { [matchIdStr]: _, ...rest } = prev;
        return rest;
      });
    }
    
    setSelections(newSelections);
    // Call the callback function if it exists
    onSelectionChange?.(newSelections);
  };

  // Sync state if initialSelections prop changes externally
  useEffect(() => {
    if (initialSelections && JSON.stringify(initialSelections) !== JSON.stringify({})) {
      // Only update if there are actual initialSelections and they differ from current
      if (JSON.stringify(selections) !== JSON.stringify(initialSelections)) {
        setSelections(initialSelections);
      }
    }
  }, [initialSelections]);

  // Content for the betting coupon
  const couponContent = (
    <div className="w-full flex flex-col items-stretch p-2 overflow-x-visible">
      {matches.map((match: Match) => {
        const matchIdStr = match.id.toString();
        const currentSelection = selections[matchIdStr];
        const hasError = !!errors[matchIdStr];

        return (
          <div key={matchIdStr} className="flex w-full flex-row items-center justify-between p-2 sm:p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150">
            {/* Match Info - Left aligned team names on separate lines with equal styling */}
            <div className="flex-1 mr-2 sm:mr-3">
              <div className="flex flex-col text-left">
                <span className="text-sm sm:text-base text-gray-800">{match.homeTeam}</span>
                <span className="text-sm sm:text-base text-gray-800">{match.awayTeam}</span>
                {hasError && (
                  <span className="text-xs text-red-500 mt-1">{errors[matchIdStr]}</span>
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
    >
      {couponContent}
    </SectionContainer>
  );
});

BettingCoupon.displayName = "BettingCoupon";

export default BettingCoupon; 