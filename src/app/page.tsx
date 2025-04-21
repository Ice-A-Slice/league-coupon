"use client";

import React, { useEffect, useRef, useState } from 'react';
// Remove unused Image import
// Import the component and types
import BettingCoupon from '@/components/BettingCoupon/BettingCoupon';
import { Selections } from "@/components/BettingCoupon/types";
import Questionnaire from '@/components/Questionnaire/Questionnaire';
// import { Prediction } from "@/components/Questionnaire/types"; // Removed unused import
import { Button } from "@/components/ui/button";
import { LoginButton } from '@/components/auth';

// Import mock data from the new file
import { 
  sampleMatches, 
  sampleTeams, 
  samplePlayers, 
  initialPredictions, 
  initialSampleSelections // Assuming this was also defined inline before
} from '@/data/mockData';

// Import supabase client
import { createClient } from '../utils/supabase/client';
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";


// Sample data for the demo - REMOVED
// const sampleMatches: Match[] = [...];
// const initialSampleSelections: Selections = {...};
// const sampleTeams: Team[] = [...];
// const samplePlayers: Player[] = [...];
// const initialPredictions: Prediction = {...};

// Interface for structured validation errors
interface ErrorsState {
  coupon?: Record<string, string>;
  questionnaire?: Record<string, string>; // Allows for specific field errors later
  summary?: string;
}

export default function Home() {

  // State for selections and predictions - Initial state uses imported value
  const [selections, setSelections] = useState<Selections>(initialSampleSelections);
  // const [predictions, setPredictions] = useState<Prediction>(initialPredictions); // Removed unused state
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
  
  // Remove unused Supabase client state
  // const [supabase, setSupabase] = useState<SupabaseClient | null>(null); 
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Handler for selection changes
  const handleSelectionChange = (newSelections: Selections) => {
    console.log('Selection change detected:', newSelections);
    setSelections({...newSelections});
    setValidationErrors({}); // Reset structured errors
  };
  
  // Handler for questionnaire content toggle
  const handleQuestionnaireToggle = () => {
    setIsQuestionnaireContentVisible(!isQuestionnaireContentVisible);
  };
  
  // Handler for form submission
  const handleSubmit = () => {
    setIsSubmitting(true); // State update
    setValidationErrors({}); // State update

    let isFormValid = true;
    const combinedErrors: ErrorsState = {}; // Use const

    // console.log("🧾 Current selections:", JSON.stringify(selections, null, 2));
    // console.log("🔮 Current predictions:", JSON.stringify(predictions, null, 2));

    // Validate betting coupon
    if (bettingCouponRef.current) {
      const couponValidation = bettingCouponRef.current.validate();
      if (!couponValidation.isValid) {
        isFormValid = false;
        if (couponValidation.errors) {
          combinedErrors.coupon = couponValidation.errors; // Store detailed coupon errors
        }
      }
    }

    // Validate questionnaire
    if (showQuestionnaire && questionnaireRef.current) {
      const questionnaireValidation = questionnaireRef.current.validatePredictions();
      if (!questionnaireValidation.isValid) {
        isFormValid = false;
        combinedErrors.questionnaire = questionnaireValidation.errors || { form: "Please complete all predictions" };
      }
    }

    // Update state with combined errors and potentially a summary
    if (!isFormValid) {
      combinedErrors.summary = "Please fix all errors in both sections before submitting";
      setValidationErrors(combinedErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Submit logic...
      setIsSubmitted(true);
    }

    setIsSubmitting(false);
  };
  
  // Authentication useEffect
  useEffect(() => {
    // Initialize supabase client inside useEffect
    const client = createClient();
    // setSupabase(client); // Remove setting unused state

    const getSession = async () => {
      // Use the local client variable for initialization
      const { data: { session }, error } = await client.auth.getSession(); 
      if (error) console.error('Auth error:', error);
      setUser(session?.user ?? null);
      setLoading(false);
    };
  
    getSession();

    // Use the local client variable for listener
    const { data: listener } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => { 
      setUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe(); 
    };
  }, []); // Empty dependency array: run only once on mount

  // Check if we're in a test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  // In test environment, bypass the loading and authentication check
  if (loading && !isTestEnvironment) return <p>Laddar...</p>;

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 sm:p-8 pb-20 gap-8 sm:gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] overflow-x-hidden">
      {/* Header (simplified for demo) */}
      {/* <header className="row-start-1 mb-4 sm:mb-8 w-full text-center">
        <h1 className="text-2xl font-bold text-center">Round 1</h1>
      </header> */}

      {/* Main content area with the coupon */}
      <main className="flex flex-col gap-4 sm:gap-[32px] row-start-2 items-center justify-center w-full max-w-full">
      <LoginButton />
      {/* In test environment, always show content regardless of auth state */}
      {user || isTestEnvironment ? (
        <>
          {!isSubmitted ? (
            <>
              <div className="flex justify-center w-full">
                <div className="w-full max-w-lg">
                  <BettingCoupon 
                    ref={bettingCouponRef}
                    matches={sampleMatches} // Use imported mock data
                    initialSelections={initialSampleSelections} // Use imported mock data
                    onSelectionChange={handleSelectionChange} 
                  />
                </div>
              </div>
              
              <div className="flex justify-center w-full">
                <div className="w-full max-w-lg">
                  <Questionnaire
                    ref={questionnaireRef}
                    showQuestionnaire={true}
                    teams={sampleTeams} // Use imported mock data
                    players={samplePlayers} // Use imported mock data
                    initialPredictions={initialPredictions} // Use imported mock data
                    onPredictionChange={() => setValidationErrors({})} // Simplified callback
                    onToggleVisibility={handleQuestionnaireToggle}
                  />
                </div>
              </div>
              
              <div className="w-full max-w-lg px-4 sm:px-0 flex justify-center items-center flex-col">
                {/* Display Summary Error */}
                {validationErrors.summary && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm w-full" role="alert">
                    <p className="font-bold">{validationErrors.summary}</p>
                  </div>
                )}

                {/* Display Detailed Coupon Errors (if any) */}
                {validationErrors.coupon && Object.keys(validationErrors.coupon).length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
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
                   <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
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
                    setSelections(initialSampleSelections); // Reset using imported value
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
        </>
      ) : (
        <p>Vänligen logga in för att tippa.</p>
      )}
     
      </main>
      
      {/* Footer (simplified for demo) */}
      {/* <footer className="row-start-3 mt-8 text-center text-sm text-gray-500">
        Original Next.js footer links omitted for demo clarity.
      </footer> */}
    </div>
  );
}
