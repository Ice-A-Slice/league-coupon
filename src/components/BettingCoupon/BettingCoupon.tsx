"use client";

import React, { useState, useEffect } from 'react';
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
    <div className="w-full flex flex-col items-stretch p-2 overflow-x-visible">
      {matches.map((match: Match) => {
        const matchIdStr = match.id.toString();
        const currentSelection = selections[matchIdStr];

        return (
          <div key={matchIdStr} className="flex w-full flex-row items-center justify-between p-2 sm:p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150">
            {/* Match Info - Left aligned team names on separate lines with equal styling */}
            <div className="flex-1 mr-2 sm:mr-3">
              <div className="flex flex-col text-left">
                <span className="text-sm sm:text-base text-gray-800">{match.homeTeam}</span>
                <span className="text-sm sm:text-base text-gray-800">{match.awayTeam}</span>
              </div>
            </div>
            {/* Selection Buttons */}
            <div className="flex space-x-1.5 sm:space-x-3 flex-shrink-0 self-center">
              {selectionLabels.map((label) => {
                const isSelected = currentSelection === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelect(match.id, label)}
                    // Enhanced styling with responsive accommodations
                    className={`touch-target-min px-1.5 py-1 sm:px-2.5 sm:py-1.5 
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
      title="Round 1"
      subtitle="Select match outcomes to fill your coupon"
      collapsible={false}
    >
      {couponContent}
    </SectionContainer>
  );
};

export default BettingCoupon; 