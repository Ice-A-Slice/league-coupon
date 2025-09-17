"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
// import debounce from 'lodash.debounce'; // REMOVED debounce import
import TeamSelect from "./TeamSelect";
import PlayerSelect from "./PlayerSelect";
import { Prediction, QuestionnaireProps, PredictionKeys } from "./types";
import SectionContainer from "@/components/layout";
import { validatePrediction } from "@/schemas/questionnaireSchema";
import ValidationStatusIndicator from '@/components/ui/ValidationStatusIndicator';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { AlertTriangle } from 'lucide-react';
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
  // Prefix unused parameter with underscore for default function
  onPredictionChange = (_questionKey: PredictionKeys) => {},
  onToggleVisibility,
  validationErrors
}, ref) => {
  // Use localStorage for predictions with fallback to initialPredictions
  const [predictions, setPredictions] = useLocalStorage<Prediction>(
    'betting-predictions',
    initialPredictions
  );
  // Use the passed-in errors for display, default to empty object
  const errors = validationErrors || {};
  // Keep internal errors for immediate feedback from Zod validation (optional)
  const [internalErrors, setInternalErrors] = useState<{[key: string]: string}>({});
  const [isContentVisible, setIsContentVisible] = useState(true);
  
  // Sync with initialPredictions if they change externally (only on mount with no existing data)
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    if (!hasMounted) {
      setHasMounted(true);
      return;
    }
    
    const hasInitialData = Object.values(initialPredictions).some(value => value !== null);
    const isStorageEmpty = Object.values(predictions).every(value => value === null);
    
    // Only set initial predictions if we have server data and localStorage is empty
    // Skip this entirely in test environment to avoid interfering with test setup
    if (hasInitialData && isStorageEmpty && process.env.NODE_ENV !== 'test') {
      console.log('🔄 Questionnaire: Setting initial predictions from server data:', initialPredictions);
      setPredictions(initialPredictions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPredictions, setPredictions, hasMounted]); // predictions intentionally omitted to prevent dependency loop
  
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
      // Update internal errors state for immediate inline display
      if (!result.isValid && result.errors) {
        setInternalErrors(result.errors);
      } else {
        setInternalErrors({});
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

  // Update a specific prediction field and notify parent about the specific field changed
  const updatePrediction = (field: PredictionKeys, value: string | null) => {
    // Restore immediate *internal* error clearing for the specific field
    if (internalErrors[field]) {
      setInternalErrors(prev => {
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
    
    // Call the callback immediately with the specific key that changed
    onPredictionChange(field);

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
    <div className="px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-4 w-full [&>*]:!border-b-0">
      {/* Last Chance Alert Banner - TEMPORARY: Remove or comment out this entire block after the deadline round */}
      {/* TODO: Comment out or remove this alert after the last round for editing dynamic questions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-4 rounded-r-md">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Last round with the questions!
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Dear friends remember that this is the final round where you can add or edit your answers for the seasons questions below.
            </p>
          </div>
        </div>
      </div>
      {/* END: Last Chance Alert Banner */}
      
      {/* League Winner Selection - Reverted to use TeamSelect */}
      <div className="pt-3 sm:pt-4 first:pt-0">
        <div className="flex items-center mb-1">
          <label htmlFor="league-winner" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            1. Which team will win the league?
          </label>
          <ValidationStatusIndicator 
            // Use internal error for immediate feedback, passed error for submission validation
            hasError={!!internalErrors.leagueWinner || !!errors.leagueWinner} 
            isValid={predictions.leagueWinner !== null && !internalErrors.leagueWinner && !errors.leagueWinner}
          />
        </div>
        {/* Show internal error preferentially for immediate feedback */}
        {(internalErrors.leagueWinner || errors.leagueWinner) && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="league-winner-error" role="alert">{internalErrors.leagueWinner || errors.leagueWinner}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.leagueWinner}
          onSelect={(teamId) => updatePrediction('leagueWinner', teamId)}
          id="league-winner"
          placeholder="Select league winner..."
          className={cn(
            (internalErrors.leagueWinner || errors.leagueWinner) ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
            (predictions.leagueWinner !== null && !internalErrors.leagueWinner && !errors.leagueWinner) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : ''
          )}
          aria-invalid={!!internalErrors.leagueWinner || !!errors.leagueWinner}
          aria-describedby={(internalErrors.leagueWinner || errors.leagueWinner) ? "league-winner-error" : undefined}
        />
      </div>
      
      {/* Last Place Selection */}
      <div className="pt-3 sm:pt-4">
        <div className="flex items-center mb-1">
          <label htmlFor="last-place" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            2. Which team will finish in last place?
          </label>
           <ValidationStatusIndicator 
            // Use internal error for immediate feedback, passed error for submission validation
            hasError={!!internalErrors.lastPlace || !!errors.lastPlace} 
            isValid={predictions.lastPlace !== null && !internalErrors.lastPlace && !errors.lastPlace}
          />
        </div>
        {(internalErrors.lastPlace || errors.lastPlace) && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="last-place-error" role="alert">{internalErrors.lastPlace || errors.lastPlace}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.lastPlace}
          onSelect={(teamId) => updatePrediction('lastPlace', teamId)}
          id="last-place"
          placeholder="Select last place team..."
          className={cn(
            (internalErrors.lastPlace || errors.lastPlace) ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.lastPlace !== null && !internalErrors.lastPlace && !errors.lastPlace) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!internalErrors.lastPlace || !!errors.lastPlace}
          aria-describedby={(internalErrors.lastPlace || errors.lastPlace) ? "last-place-error" : undefined}
        />
      </div>
      
      {/* Best Goal Difference Selection */}
      <div className="pt-3 sm:pt-4">
         <div className="flex items-center mb-1">
           <label htmlFor="best-goal-difference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            3. Which team will have the best goal difference?
           </label>
            <ValidationStatusIndicator 
             // Use internal error for immediate feedback, passed error for submission validation
             hasError={!!internalErrors.bestGoalDifference || !!errors.bestGoalDifference} 
             isValid={predictions.bestGoalDifference !== null && !internalErrors.bestGoalDifference && !errors.bestGoalDifference}
           />
         </div>
        {(internalErrors.bestGoalDifference || errors.bestGoalDifference) && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="best-goal-difference-error" role="alert">{internalErrors.bestGoalDifference || errors.bestGoalDifference}</p>
        )}
        <TeamSelect
          teams={teams}
          selectedTeamId={predictions.bestGoalDifference}
          onSelect={(teamId) => updatePrediction('bestGoalDifference', teamId)}
          id="best-goal-difference"
          placeholder="Select team with best goal difference..."
          className={cn(
            (internalErrors.bestGoalDifference || errors.bestGoalDifference) ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.bestGoalDifference !== null && !internalErrors.bestGoalDifference && !errors.bestGoalDifference) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!internalErrors.bestGoalDifference || !!errors.bestGoalDifference}
          aria-describedby={(internalErrors.bestGoalDifference || errors.bestGoalDifference) ? "best-goal-difference-error" : undefined}
        />
      </div>
      
      {/* Top Scorer Selection */}
      <div className="pt-3 sm:pt-4">
         <div className="flex items-center mb-1">
          <label htmlFor="top-scorer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            4. Who will be the top scorer in the league?
          </label>
           <ValidationStatusIndicator 
             // Use internal error for immediate feedback, passed error for submission validation
             hasError={!!internalErrors.topScorer || !!errors.topScorer} 
             isValid={predictions.topScorer !== null && !internalErrors.topScorer && !errors.topScorer}
           />
        </div>
        {(internalErrors.topScorer || errors.topScorer) && (
          <p className="text-red-500 text-xs mt-1 mb-1" id="top-scorer-error" role="alert">{internalErrors.topScorer || errors.topScorer}</p>
        )}
        <PlayerSelect
          players={players}
          selectedPlayerId={predictions.topScorer}
          onSelect={(playerId) => updatePrediction('topScorer', playerId)}
          id="top-scorer"
          placeholder="Select top scorer..."
          className={cn(
            (internalErrors.topScorer || errors.topScorer) ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 
            (predictions.topScorer !== null && !internalErrors.topScorer && !errors.topScorer) ? 'border-green-300 focus:ring-green-500 focus:border-green-500' : 
            ''
          )}
          aria-invalid={!!internalErrors.topScorer || !!errors.topScorer}
          aria-describedby={(internalErrors.topScorer || errors.topScorer) ? "top-scorer-error" : undefined}
        />
      </div>
    </div>
  );

  return (
    <SectionContainer 
      title="Questions"
      subtitle={
        <>
          Complete all questions for bonus points.
          <br className="sm:hidden" />
          <span className="sm:inline block"> 3 points for every correct question.</span>
        </>
      }
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