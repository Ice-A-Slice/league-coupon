"use client";

import React, { useState, useMemo, forwardRef, useImperativeHandle } from "react";
// import debounce from 'lodash.debounce'; // REMOVED debounce import
import TeamSelect from "./TeamSelect";
import PlayerSelect from "./PlayerSelect";
import { Prediction, QuestionnaireProps } from "./types";
import SectionContainer from "@/components/layout";
import { validatePrediction } from "@/schemas/questionnaireSchema";
import ValidationStatusIndicator from '@/components/ui/ValidationStatusIndicator';
import { cn } from '@/lib/utils';
import { Team } from '@/lib/types';
// import { Combobox } from '@headlessui/react';
// import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

// Define the structure of the answers this component will provide
export interface SeasonAnswers {
  question_type: string;
  answered_team_id: number | null;
  answered_player_id: number | null; // Keep for future player questions
}

// Define the type for the exposed methods via the ref
export interface QuestionnaireRef {
  validatePredictions: () => { isValid: boolean; errors?: Record<string, string> };
  getAnswers: () => SeasonAnswers[];
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
  // Remove state related to the direct Headless UI combobox
  // const [query, setQuery] = useState('');
  // const [selectedLeagueWinner, setSelectedLeagueWinner] = useState<Team | null>(null);
  // const [selectedRelegation1, setSelectedRelegation1] = useState<Team | null>(null);
  // const [selectedRelegation2, setSelectedRelegation2] = useState<Team | null>(null);
  // const [selectedRelegation3, setSelectedRelegation3] = useState<Team | null>(null);
  
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
    },
    getAnswers: () => {
      // Base getAnswers on the existing predictions state
      const answers: SeasonAnswers[] = [];
      if (predictions.leagueWinner) {
        answers.push({ question_type: 'league_winner', answered_team_id: parseInt(predictions.leagueWinner, 10), answered_player_id: null });
      }
      // Assuming we add state/logic for relegation questions similarly to leagueWinner/lastPlace eventually
      // For now, only include what's in the predictions state
      if (predictions.lastPlace) {
          answers.push({ question_type: 'last_place', answered_team_id: parseInt(predictions.lastPlace, 10), answered_player_id: null });
      }
      if (predictions.bestGoalDifference) {
          answers.push({ question_type: 'best_goal_difference', answered_team_id: parseInt(predictions.bestGoalDifference, 10), answered_player_id: null });
      }
      if (predictions.topScorer) {
          // Assuming topScorer stores player ID as string
          answers.push({ question_type: 'top_scorer', answered_team_id: null, answered_player_id: parseInt(predictions.topScorer, 10) });
      }

      return answers;
    }
  }), [predictions]); // Depend on predictions state

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

  // Remove filteredTeams memo as it was only for the Headless UI combobox
  // const filteredTeams = useMemo(() => ... );

  if (!showQuestionnaire) {
    return null;
  }

  // Content for the questionnaire
  const questionnaireContent = (
    <div className="px-3 sm:px-4 py-3 sm:py-5 divide-y divide-gray-200 space-y-3 sm:space-y-4 w-full">
      {/* League Winner Selection - Reverted to use TeamSelect */}
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