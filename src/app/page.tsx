"use client";

import React, { useEffect, useRef, useState } from 'react';
// Remove unused Image import
// Import the component and types
import BettingCoupon from '@/components/BettingCoupon/BettingCoupon';
import { Match, Selections } from "@/components/BettingCoupon/types";
import Questionnaire from '@/components/Questionnaire/Questionnaire';
import { Prediction, Team, Player } from "@/components/Questionnaire/types";
import { Button } from "@/components/ui/button";

// Sample data for the demo
const sampleMatches: Match[] = [
  { id: '1', homeTeam: "Real Madrid", awayTeam: "Arsenal" },
  { id: '2', homeTeam: "Inter", awayTeam: "Bayern München" },
  { id: '3', homeTeam: "Newcastle", awayTeam: "Crystal Palace" },
  { id: '4', homeTeam: "Rapid Wien", awayTeam: "Djurgården" },
  { id: '5', homeTeam: "Manchester United", awayTeam: "Lyon" },
  { id: '6', homeTeam: "Frankfurt", awayTeam: "Tottenham" },
];

const initialSampleSelections: Selections = {
  '1': '1',
  '3': 'X',
};

// Sample teams for the demo - Updated IDs to strings
const sampleTeams: Team[] = [
  { id: '1', name: "Real Madrid" },
  { id: '2', name: "Arsenal" },
  { id: '3', name: "Inter" },
  { id: '4', name: "Bayern München" },
  { id: '5', name: "Newcastle" },
  { id: '6', name: "Crystal Palace" },
  { id: '7', name: "Rapid Wien" },
  { id: '8', name: "Djurgården" },
  { id: '9', name: "Manchester United" },
  { id: '10', name: "Lyon" },
  { id: '11', name: "Frankfurt" },
  { id: '12', name: "Tottenham" },
];

// Sample players for the demo - Updated IDs to strings
const samplePlayers: Player[] = [
  { id: '1', name: "Harry Kane", teamId: '4' },
  { id: '2', name: "Kylian Mbappé", teamId: '1' },
  { id: '3', name: "Bukayo Saka", teamId: '2' },
  { id: '4', name: "Lautaro Martínez", teamId: '3' },
  { id: '5', name: "Alexander Isak", teamId: '5' },
  { id: '6', name: "Marcus Rashford", teamId: '9' },
  { id: '7', name: "Karim Adeyemi", teamId: '11' },
  { id: '8', name: "Heung-min Son", teamId: '12' },
  { id: '9', name: "Eberechi Eze", teamId: '6' },
  { id: '10', name: "Guido Burgstaller", teamId: '7' },
  { id: '11', name: "Victor Edvardsen", teamId: '8' },
  { id: '12', name: "Alexandre Lacazette", teamId: '10' },
];

// Initial predictions (empty for demo)
const initialPredictions: Prediction = {
  leagueWinner: null,
  lastPlace: null,
  bestGoalDifference: null,
  topScorer: null
};

// Interface for structured validation errors
interface ErrorsState {
  coupon?: Record<string, string>;
  questionnaire?: Record<string, string>; // Allows for specific field errors later
  summary?: string;
}

export default function Home() {
  // State for selections and predictions
  const [selections, setSelections] = useState<Selections>(initialSampleSelections);
  const [predictions, setPredictions] = useState<Prediction>(initialPredictions);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showQuestionnaire, setShowQuestionnaire] = useState(true);
  const [isQuestionnaireContentVisible, setIsQuestionnaireContentVisible] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Use the new structured error state
  const [validationErrors, setValidationErrors] = useState<ErrorsState>({});
  
  // Log initial selections on mount
  useEffect(() => {
    console.log('Initial selections loaded:', initialSampleSelections);
    console.log('Current selections state:', selections);
  }, [selections]);
  
  // Create ref for the questionnaire component with proper type
  interface QuestionnaireRef {
    validatePredictions: () => { isValid: boolean; errors?: Record<string, string> };
  }
  const questionnaireRef = useRef<QuestionnaireRef>(null);
  
  // Create ref for the betting coupon component
  interface BettingCouponRef {
    validate: () => { isValid: boolean; errors?: Record<string, string> };
  }
  const bettingCouponRef = useRef<BettingCouponRef>(null);
  
  // Handler for selection changes
  const handleSelectionChange = (newSelections: Selections) => {
    console.log('Selection change detected:', newSelections);
    setSelections({...newSelections});
    setValidationErrors({}); // Reset structured errors
  };
  
  // Handler for prediction changes
  const handlePredictionChange = (newPredictions: Prediction) => {
    setPredictions(newPredictions);
    setValidationErrors({}); // Reset structured errors
  };
  
  // Handler for questionnaire content toggle
  const handleQuestionnaireToggle = () => {
    setIsQuestionnaireContentVisible(!isQuestionnaireContentVisible);
  };
  
  // Handler for form submission
  const handleSubmit = () => {
    console.log(`🚀 Form submission started`);
    setIsSubmitting(true);
    setValidationErrors({}); // Reset errors to an empty object
    
    let isFormValid = true;
    const combinedErrors: ErrorsState = {}; // Use const

    console.log("🧾 Current selections:", JSON.stringify(selections, null, 2));
    console.log("🔮 Current predictions:", JSON.stringify(predictions, null, 2));
    
    // Validate betting coupon
    if (bettingCouponRef.current) {
      console.log(`🧪 Validating betting coupon...`);
      const couponValidation = bettingCouponRef.current.validate();
      console.log("📋 Coupon validation result:", JSON.stringify(couponValidation, null, 2));
      
      if (!couponValidation.isValid) {
        isFormValid = false;
        if (couponValidation.errors) {
          combinedErrors.coupon = couponValidation.errors; // Store detailed coupon errors
          console.log(`❌ Found coupon validation errors:`, JSON.stringify(couponValidation.errors, null, 2));
        }
      } else {
        console.log(`✅ Coupon validation passed`);
      }
    }
    
    // Validate questionnaire
    if (showQuestionnaire && questionnaireRef.current) {
       console.log(`🧪 Validating questionnaire...`);
      // Assuming validatePredictions now returns { isValid, errors? }
      const questionnaireValidation = questionnaireRef.current.validatePredictions(); 
      console.log("❓ Questionnaire validation result:", JSON.stringify(questionnaireValidation, null, 2));
      
      if (!questionnaireValidation.isValid) {
        isFormValid = false;
        // Store questionnaire errors (assuming generic for now, but could be detailed)
        combinedErrors.questionnaire = questionnaireValidation.errors || { form: "Please complete all predictions" }; 
        console.log(`❌ Found questionnaire validation errors:`, JSON.stringify(combinedErrors.questionnaire, null, 2));
      }
       else {
         console.log(`✅ Questionnaire validation passed`);
      }
    }
    
    // Update state with combined errors and potentially a summary
    if (!isFormValid) {
      combinedErrors.summary = "Please fix all errors in both sections before submitting";
      setValidationErrors(combinedErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Submit logic... 
      console.log("Submitting coupon...");
      console.log("Selections:", selections);
      console.log("Predictions:", predictions);
      setIsSubmitted(true);
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 sm:p-8 pb-20 gap-8 sm:gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] overflow-x-hidden">
      {/* Header (simplified for demo) */}
      {/* <header className="row-start-1 mb-4 sm:mb-8 w-full text-center">
        <h1 className="text-2xl font-bold text-center">Round 1</h1>
      </header> */}

      {/* Main content area with the coupon */}
      <main className="flex flex-col gap-4 sm:gap-[32px] row-start-2 items-center justify-center w-full max-w-full">
        {!isSubmitted ? (
          <>
            <div className="flex justify-center w-full">
              <div className="w-full max-w-lg">
                <BettingCoupon 
                  ref={bettingCouponRef}
                  matches={sampleMatches} 
                  initialSelections={initialSampleSelections} 
                  onSelectionChange={handleSelectionChange} 
                />
              </div>
            </div>
            
            <div className="flex justify-center w-full">
              <div className="w-full max-w-lg">
                <Questionnaire
                  ref={questionnaireRef}
                  showQuestionnaire={true}
                  teams={sampleTeams}
                  players={samplePlayers}
                  initialPredictions={initialPredictions}
                  onPredictionChange={handlePredictionChange}
                  onToggleVisibility={handleQuestionnaireToggle}
                />
              </div>
            </div>
            
            <div className="w-full max-w-lg px-4 sm:px-0 flex justify-center items-center flex-col">
              {/* Display Summary Error */}
              {validationErrors.summary && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm w-full">
                  <p className="font-bold">{validationErrors.summary}</p>
                </div>
              )}

              {/* Display Detailed Coupon Errors (if any) */}
              {validationErrors.coupon && Object.keys(validationErrors.coupon).length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full">
                  <p className="font-semibold mb-1">Coupon Errors:</p>
                  <ul className="list-disc pl-5">
                    {Object.entries(validationErrors.coupon).map(([matchId, error]) => {
                       // Find match details to show more context (optional)
                       const match = sampleMatches.find(m => m.id.toString() === matchId);
                       const matchLabel = match ? `${match.homeTeam} vs ${match.awayTeam}` : `Match ${matchId}`;
                      return <li key={`coupon-err-${matchId}`}>{matchLabel}: {error}</li>;
                    })}
                  </ul>
                </div>
              )}

              {/* Display Questionnaire Errors (if any) */}
              {validationErrors.questionnaire && Object.keys(validationErrors.questionnaire).length > 0 && (
                 <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full">
                  <p className="font-semibold mb-1">Questionnaire Errors:</p>
                  <ul className="list-disc pl-5">
                     {/* Assuming generic error for now, but could map specific fields */}
                     {Object.entries(validationErrors.questionnaire).map(([field, error]) => (
                      <li key={`q-err-${field}`}>{error}</li> // Display the generic message or field-specific error
                    ))}
                  </ul>
                </div>
              )}
              
              <Button
                type="button"
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-center w-full">
            <div className="text-center p-8 bg-green-50 rounded-lg border border-green-200 w-full max-w-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-2xl font-bold text-green-800 mb-2">Success!</h2>
              <p className="text-green-700 mb-6">Your coupon and predictions have been submitted.</p>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setIsSubmitted(false);
                  setSelections(initialSampleSelections);
                  setPredictions(initialPredictions);
                  setValidationErrors({});
                }}
                style={{ 
                  backgroundColor: 'rgb(22 163 74)', // bg-green-600
                  color: 'white'
                }}
              >
                Submit Another Coupon
              </Button>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer (simplified for demo) */}
      {/* <footer className="row-start-3 mt-8 text-center text-sm text-gray-500">
        Original Next.js footer links omitted for demo clarity.
      </footer> */}
    </div>
  );
}
