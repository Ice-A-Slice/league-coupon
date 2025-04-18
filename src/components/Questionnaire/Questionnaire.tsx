"use client";

import React, { useState, forwardRef, useImperativeHandle } from "react";
import TeamSelect from "./TeamSelect";
import PlayerSelect from "./PlayerSelect";
import { Prediction, QuestionnaireProps } from "./types";
import SectionContainer from "../SectionContainer";

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
    
    const isValid = Object.keys(newErrors).length === 0;
    
    // Only update state if there are errors (avoids unnecessary renders)
    if (!isValid) {
      setErrors(newErrors);
    }
    
    return isValid;
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
      </div>
      
      {/* Last Place Selection */}
      <div className="pt-3 sm:pt-4">
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
      </div>
      
      {/* Best Goal Difference Selection */}
      <div className="pt-3 sm:pt-4">
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
      </div>
      
      {/* Top Scorer Selection */}
      <div className="pt-3 sm:pt-4">
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
      </div>
    </div>
  );

  // Footer content explaining scoring
  const footerContent = (
    <p>
      <span className="font-semibold">How scoring works:</span> You receive 3 points for each correct prediction in addition to your match points.
    </p>
  );

  return (
    <SectionContainer
      title="Questions"
      subtitle="Complete all questions for bonus points"
      collapsible={true}
      initialCollapsed={!isContentVisible}
      onToggleVisibility={handleToggleContent}
      footer={footerContent}
    >
      {questionnaireContent}
    </SectionContainer>
  );
});

Questionnaire.displayName = "Questionnaire";

export default Questionnaire; 