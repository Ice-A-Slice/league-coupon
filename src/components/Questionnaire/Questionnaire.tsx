"use client";

import React, { useState, forwardRef, useImperativeHandle } from "react";
// import debounce from 'lodash.debounce'; // REMOVED debounce import
import TeamSelect from "./TeamSelect";
import PlayerSelect from "./PlayerSelect";
import { Prediction, QuestionnaireProps } from "./types";
import SectionContainer from "@/components/layout";
import { validatePrediction } from "@/schemas/questionnaireSchema";
import ValidationStatusIndicator from '@/components/ui/ValidationStatusIndicator';
import { cn } from '@/lib/utils';

// Update Ref type definition
export interface QuestionnaireRef {
  validatePredictions: () => { isValid: boolean; errors?: Record<string, string> };
}

const Questionnaire = forwardRef<QuestionnaireRef, QuestionnaireProps>(({
  showQuestionnaire = true,
  teams,
  players,
  initialPredictions = {
    leagueWinner: null,
    lastPlace: null,
    bestGoalDifference: null,
    topScorer: null
  },
  onPredictionChange = () => {},
  onToggleVisibility,
}, ref) => {
  // State for predictions
  const [predictions, setPredictions] = useState<Prediction>(initialPredictions);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isContentVisible, setIsContentVisible] = useState(true);
  
  // Expose validation method returning the detailed result
  useImperativeHandle(ref, () => ({
    validatePredictions: () => {
      // Directly call the imported validator and return its full result
      const result = validatePrediction(predictions);
      // Update internal errors state for inline display
      if (!result.isValid && result.errors) {
        setErrors(result.errors);
      } else {
        setErrors({});
      }
      return result; // Return the full { isValid, errors? } object
    }
  }));

  // Update a specific prediction field
  const updatePrediction = (field: keyof Prediction, value: string | null) => {
    // Restore immediate error clearing for the specific field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Update the prediction state immediately
    const updatedPredictions = {
      ...predictions,
      [field]: value
    };
    setPredictions(updatedPredictions);
    
    // Call the callback immediately
    onPredictionChange(updatedPredictions);

    // // Trigger debounced validation - REMOVED
    // debouncedValidate(updatedPredictions);
  };

  // Toggle content visibility
  const handleToggleContent = () => {
    if (onToggleVisibility) {
      onToggleVisibility();
    }
    setIsContentVisible(!isContentVisible);
  };

  if (!showQuestionnaire) {
    return null;
  }

  // Content for the questionnaire
  const questionnaireContent = (
    <div className="px-3 sm:px-4 py-3 sm:py-5 divide-y divide-gray-200 space-y-3 sm:space-y-4 w-full">
      {/* League Winner Selection */}
      <div className="pt-3 sm:pt-4 first:pt-0">
        <div className="flex items-center mb-1">
          <label htmlFor="league-winner" className="block text-sm font-medium text-gray-700 mr-2">
            1. Which team will win the league?
          </label>
          <ValidationStatusIndicator 
            hasError={!!errors.leagueWinner} 
            isValid={predictions.leagueWinner !== null && !errors.leagueWinner}
          />
        </div>
        {errors.leagueWinner && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="league-winner-error" role="alert">{errors.leagueWinner}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.leagueWinner}
          onSelect={(teamId) => updatePrediction('leagueWinner', teamId)}
          id="league-winner"
          placeholder="Select league winner..."
          className={cn(
            errors.leagueWinner ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
            (predictions.leagueWinner !== null && !errors.leagueWinner) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : ''
          )}
          aria-invalid={!!errors.leagueWinner}
          aria-describedby={errors.leagueWinner ? "league-winner-error" : undefined}
        />
      </div>
      
      {/* Last Place Selection */}
      <div className="pt-3 sm:pt-4">
        <div className="flex items-center mb-1">
          <label htmlFor="last-place" className="block text-sm font-medium text-gray-700 mr-2">
            2. Which team will finish in last place?
          </label>
           <ValidationStatusIndicator 
            hasError={!!errors.lastPlace} 
            isValid={predictions.lastPlace !== null && !errors.lastPlace}
          />
        </div>
        {errors.lastPlace && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="last-place-error" role="alert">{errors.lastPlace}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.lastPlace}
          onSelect={(teamId) => updatePrediction('lastPlace', teamId)}
          id="last-place"
          placeholder="Select last place team..."
          className={cn(
            errors.lastPlace ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.lastPlace !== null && !errors.lastPlace) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!errors.lastPlace}
          aria-describedby={errors.lastPlace ? "last-place-error" : undefined}
        />
      </div>
      
      {/* Best Goal Difference Selection */}
      <div className="pt-3 sm:pt-4">
         <div className="flex items-center mb-1">
           <label htmlFor="best-goal-difference" className="block text-sm font-medium text-gray-700 mr-2">
            3. Which team will have the best goal difference?
           </label>
            <ValidationStatusIndicator 
             hasError={!!errors.bestGoalDifference} 
             isValid={predictions.bestGoalDifference !== null && !errors.bestGoalDifference}
           />
         </div>
        {errors.bestGoalDifference && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="best-goal-difference-error" role="alert">{errors.bestGoalDifference}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.bestGoalDifference}
          onSelect={(teamId) => updatePrediction('bestGoalDifference', teamId)}
          id="best-goal-difference"
          placeholder="Select team with best goal difference..."
          className={cn(
            errors.bestGoalDifference ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.bestGoalDifference !== null && !errors.bestGoalDifference) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!errors.bestGoalDifference}
          aria-describedby={errors.bestGoalDifference ? "best-goal-difference-error" : undefined}
        />
      </div>
      
      {/* Top Scorer Selection */}
      <div className="pt-3 sm:pt-4">
         <div className="flex items-center mb-1">
          <label htmlFor="top-scorer" className="block text-sm font-medium text-gray-700 mr-2">
            4. Who will be the top scorer in the league?
          </label>
           <ValidationStatusIndicator 
             hasError={!!errors.topScorer} 
             isValid={predictions.topScorer !== null && !errors.topScorer}
           />
        </div>
        {errors.topScorer && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="top-scorer-error" role="alert">{errors.topScorer}</p>
        )}
        <PlayerSelect
          players={players}
          selectedPlayerId={predictions.topScorer}
          onSelect={(playerId) => updatePrediction('topScorer', playerId)}
          id="top-scorer"
          placeholder="Select top scorer..."
          className={cn(
            errors.topScorer ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.topScorer !== null && !errors.topScorer) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!errors.topScorer}
          aria-describedby={errors.topScorer ? "top-scorer-error" : undefined}
        />
      </div>
    </div>
  );

  return (
    <SectionContainer 
      title="Questions"
      subtitle="Complete all questions for bonus points"
      collapsible={true}
      initialCollapsed={!isContentVisible}
      onToggleVisibility={handleToggleContent}
      aria-label="Questionnaire Section"
    >
      {questionnaireContent}
    </SectionContainer>
  );
});

Questionnaire.displayName = "Questionnaire";

export default Questionnaire; 