"use client";

import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import TeamSelect from "./TeamSelect";
import PlayerSelect from "./PlayerSelect";
import { Prediction, QuestionnaireProps } from "./types";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const Questionnaire = forwardRef<{validatePredictions: () => boolean}, QuestionnaireProps>(({
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
  
  // Debugging console log to verify onToggleVisibility exists
  useEffect(() => {
    console.log("Questionnaire rendered with onToggleVisibility:", !!onToggleVisibility);
  }, [onToggleVisibility]);

  // Expose validation method to parent component
  useImperativeHandle(ref, () => ({
    validatePredictions: () => {
      return validatePredictions();
    }
  }));

  // Update a specific prediction field
  const updatePrediction = (field: keyof Prediction, value: string | number | null) => {
    // Clear any error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Update the prediction
    const updatedPredictions = {
      ...predictions,
      [field]: value
    };
    
    setPredictions(updatedPredictions);
    onPredictionChange(updatedPredictions);
  };

  // Validate predictions
  const validatePredictions = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // Check each prediction field
    if (predictions.leagueWinner === null) {
      newErrors.leagueWinner = "Please select a league winner";
    }
    
    if (predictions.lastPlace === null) {
      newErrors.lastPlace = "Please select a team for last place";
    }
    
    if (predictions.bestGoalDifference === null) {
      newErrors.bestGoalDifference = "Please select a team with best goal difference";
    }
    
    if (predictions.topScorer === null) {
      newErrors.topScorer = "Please select a top scorer";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  // Determine if content should be visible based on local state
  const contentVisible = isContentVisible;

  return (
    <div className="w-full max-w-lg bg-white rounded-lg overflow-hidden shadow-md border border-gray-200">
      <div 
        className="p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white flex justify-between items-center cursor-pointer"
        onClick={handleToggleContent}
        role="button"
        tabIndex={0}
        aria-expanded={contentVisible}
        aria-controls="predictions-content"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleContent();
          }
        }}
      >
        <div>
          <h2 className="text-lg font-bold">Questions</h2>
          <p className="text-xs opacity-90">Complete all questions for bonus points</p>
        </div>
        <button 
          type="button" 
          className="focus:outline-none"
          aria-label={contentVisible ? "Collapse questionnaire" : "Expand questionnaire"}
          onClick={(e) => {
            e.stopPropagation(); // Prevent duplicate event firing
            handleToggleContent();
          }}
        >
          {contentVisible ? (
            <ChevronUpIcon className="h-6 w-6 text-white" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="h-6 w-6 text-white" aria-hidden="true" />
          )}
        </button>
      </div>
      
      {contentVisible && (
        <div id="predictions-content" className="px-4 py-5 divide-y divide-gray-200 space-y-4">
          {/* League Winner Selection */}
          <div className="pt-4 first:pt-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. Which team will win the league?
            </label>
            {errors.leagueWinner && (
              <p className="text-red-500 text-xs mt-1">{errors.leagueWinner}</p>
            )}
            <TeamSelect
              teams={teams}
              selectedTeamId={predictions.leagueWinner}
              onSelect={(teamId) => updatePrediction('leagueWinner', teamId)}
              id="league-winner"
              placeholder="Select league winner..."
            />
            <p className="text-xs text-gray-500 mt-1">+10 points if correct</p>
          </div>
          
          {/* Last Place Selection */}
          <div className="pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. Which team will finish in last place?
            </label>
            {errors.lastPlace && (
              <p className="text-red-500 text-xs mt-1">{errors.lastPlace}</p>
            )}
            <TeamSelect
              teams={teams}
              selectedTeamId={predictions.lastPlace}
              onSelect={(teamId) => updatePrediction('lastPlace', teamId)}
              id="last-place"
              placeholder="Select last place team..."
            />
            <p className="text-xs text-gray-500 mt-1">+7 points if correct</p>
          </div>
          
          {/* Best Goal Difference Selection */}
          <div className="pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              3. Which team will have the best goal difference?
            </label>
            {errors.bestGoalDifference && (
              <p className="text-red-500 text-xs mt-1">{errors.bestGoalDifference}</p>
            )}
            <TeamSelect
              teams={teams}
              selectedTeamId={predictions.bestGoalDifference}
              onSelect={(teamId) => updatePrediction('bestGoalDifference', teamId)}
              id="best-goal-difference"
              placeholder="Select team with best goal difference..."
            />
            <p className="text-xs text-gray-500 mt-1">+5 points if correct</p>
          </div>
          
          {/* Top Scorer Selection */}
          <div className="pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              4. Who will be the top scorer in the league?
            </label>
            {errors.topScorer && (
              <p className="text-red-500 text-xs mt-1">{errors.topScorer}</p>
            )}
            <PlayerSelect
              players={players}
              teams={teams}
              selectedPlayerId={predictions.topScorer}
              onSelect={(playerId) => updatePrediction('topScorer', playerId)}
              id="top-scorer"
              placeholder="Select top scorer..."
            />
            <p className="text-xs text-gray-500 mt-1">+8 points if correct</p>
          </div>
        </div>
      )}
      
      {contentVisible && (
        <div className="bg-gray-50 p-3 text-xs text-gray-500">
          <p>
            <span className="font-semibold">How scoring works:</span> You receive points for each correct prediction in addition to your coupon points.
          </p>
        </div>
      )}
    </div>
  );
});

Questionnaire.displayName = "Questionnaire";

export default Questionnaire; 