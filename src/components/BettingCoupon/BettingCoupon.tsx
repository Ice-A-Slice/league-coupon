"use client";

import React, { useState, useEffect } from 'react';
import styles from './BettingCoupon.module.css';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types

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

  return (
    <div className={`w-full ${styles.container} bg-white shadow-md rounded-lg overflow-hidden`}>
      {/* Header similar to Questionnaire */}
      <div className="w-full p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white">
        <h2 className="text-lg font-bold">1x2</h2>
        <p className="text-xs opacity-90">Select match outcomes to fill your coupon</p>
      </div>

      <div className="w-full">
        {matches.map((match: Match, index: number) => {
          const matchIdStr = match.id.toString();
          const currentSelection = selections[matchIdStr];

          return (
            // Adjusted padding and spacing, force full width
            <div key={matchIdStr} className="flex w-full items-center justify-between p-3 sm:p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors duration-150">
              {/* Match Info - Adjusted spacing */}
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 mr-2 sm:mr-3">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-xs font-semibold"> 
                  {index + 1}
                </span>
                {/* Adjusted text size and weight */}
                <span className="text-sm sm:text-base font-medium text-gray-800 truncate">{match.homeTeam} - {match.awayTeam}</span>
              </div>
              {/* Selection Buttons - Adjusted spacing and button size */}
              <div className="flex space-x-1 sm:space-x-2 flex-shrink-0"> 
                {selectionLabels.map((label) => {
                  const isSelected = currentSelection === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleSelect(match.id, label)}
                      // Enhanced styling: bigger touch target, better feedback
                      className={`w-9 h-9 sm:w-10 sm:h-10 border rounded-md flex items-center justify-center text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isSelected
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
    </div>
  );
};

export default BettingCoupon; 