"use client";

import React, { useState, useEffect } from 'react';
import styles from './BettingCoupon.module.css';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types
import SectionContainer from '../SectionContainer';

// Define the component with props
const BettingCoupon: React.FC<BettingCouponProps> = ({ matches, initialSelections = {}, onSelectionChange }) => {
  // State for current selections
  const [selections, setSelections] = useState<Selections>(initialSelections);

  // Define button labels
  const selectionLabels: SelectionType[] = ['1', 'X', '2'];

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
    setSelections(newSelections);
    // Call the callback function if it exists
    onSelectionChange?.(newSelections);
  };

  // Sync state if initialSelections prop changes externally
  useEffect(() => {
    setSelections(initialSelections);
  }, [initialSelections]);

  // Content for the betting coupon
  const couponContent = (
    <div className="w-full">
      {matches.map((match: Match, index: number) => {
        const matchIdStr = match.id.toString();
        const currentSelection = selections[matchIdStr];

        return (
          // Adjusted padding and spacing, force full width
          <div key={matchIdStr} className="flex w-full items-center justify-between p-2 sm:p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150">
            {/* Match Info - Adjusted spacing */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 mr-2 sm:mr-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-xs font-semibold"> 
                {index + 1}
              </span>
              {/* Adjusted text size and weight */}
              <span className="text-sm sm:text-base font-medium text-gray-800 truncate">{match.homeTeam} - {match.awayTeam}</span>
            </div>
            {/* Selection Buttons - Adjusted spacing and button size */}
            <div className="flex space-x-1.5 sm:space-x-3 flex-shrink-0"> 
              {selectionLabels.map((label) => {
                const isSelected = currentSelection === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelect(match.id, label)}
                    // Enhanced sizing and touch targets for accessibility
                    className={`min-w-[44px] min-h-[44px] px-2 py-1.5 sm:px-3 sm:py-2 
                      border rounded-md flex items-center justify-center 
                      text-sm font-semibold transition-all duration-150 
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isSelected
                        ? 'bg-teal-600 text-white border-teal-700 shadow-inner hover:bg-teal-700' // Clearer selected state
                        : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-100 hover:border-gray-400' // Standard state
                      }`}
                  >
                    {label}
                  </button>
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
      title="1x2"
      subtitle="Select match outcomes to fill your coupon"
      collapsible={false}
    >
      {couponContent}
    </SectionContainer>
  );
};

export default BettingCoupon; 