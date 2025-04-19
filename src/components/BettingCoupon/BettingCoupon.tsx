"use client";

import React, { useState, useEffect } from 'react';
import type { BettingCouponProps, Match, SelectionType, Selections } from './types'; // Import types
import SectionContainer from '@/components/layout';
import ToggleButton from '../ui/toggle-button'; // Updated import

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
};

export default BettingCoupon; 