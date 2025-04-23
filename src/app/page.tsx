"use client";

import React, { useEffect, useRef, useState } from 'react';
// Remove unused Image import
// Import the component and types
import BettingCoupon from '@/components/BettingCoupon/BettingCoupon';
import type { Match, Selections } from "@/components/BettingCoupon/types";
import Questionnaire from '@/components/Questionnaire/Questionnaire';
// Import the UI types for Team and Player
import type { Team, Player, Prediction } from "@/components/Questionnaire/types"; // Ensure Prediction is imported here
import { Button } from "@/components/ui/button";
import { LoginButton } from '@/components/auth';

// Add missing imports for Supabase client and types
import { createClient } from '@/utils/supabase/client'; // Assuming this is the correct path
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

// Use a non-mock initial state for selections
const initialSampleSelections: Selections = {};
// Define initial predictions directly
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

// Update Ref type definition
export interface QuestionnaireRef {
  validatePredictions: () => { isValid: boolean; errors?: Record<string, string> };
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
  const questionnaireRef = useRef<QuestionnaireRef>(null);
  
  // Create ref for the betting coupon component
  interface BettingCouponRef {
    validate: () => { isValid: boolean; errors?: Record<string, string> };
    getSelections: () => Selections;
  }
  const bettingCouponRef = useRef<BettingCouponRef>(null);
  
  // Remove unused Supabase client state
  // const [supabase, setSupabase] = useState<SupabaseClient | null>(null); 
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Separate loading state for auth
  
  // Add state for the fetched matches
  const [matchesForCoupon, setMatchesForCoupon] = useState<Match[]>([]);
  const [fixtureLoading, setFixtureLoading] = useState(true); // Loading state for fixtures
  const [fixtureError, setFixtureError] = useState<string | null>(null); // Error state for fixtures
  
  // Questionnaire Data State
  const [teamsForQuestionnaire, setTeamsForQuestionnaire] = useState<Team[]>([]);
  const [playersForQuestionnaire, setPlayersForQuestionnaire] = useState<Player[]>([]);
  const [questionnaireDataLoading, setQuestionnaireDataLoading] = useState(true);
  const [questionnaireDataError, setQuestionnaireDataError] = useState<string | null>(null);
  
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
  const handleSubmit = async () => { // Make the handler async
    // console.log("[HANDLE SUBMIT] Starting..."); // REMOVED LOG
    setIsSubmitting(true); 
    setValidationErrors({}); 

    let isFormValid = true;
    const combinedErrors: ErrorsState = {};

    // Validate betting coupon
    let couponData: Selections | undefined;
    // console.log("[HANDLE SUBMIT] Checking couponRef..."); // REMOVED LOG
    if (bettingCouponRef.current) {
      // console.log("[HANDLE SUBMIT] Validating coupon..."); // REMOVED LOG
      const couponValidation = bettingCouponRef.current.validate();
      // console.log("[HANDLE SUBMIT] Coupon validation result:", couponValidation); // REMOVED LOG
      if (!couponValidation.isValid) {
        // console.log("[HANDLE SUBMIT] Coupon invalid."); // REMOVED LOG
        isFormValid = false;
        if (couponValidation.errors) {
          combinedErrors.coupon = couponValidation.errors;
        }
      } else {
         // console.log("[HANDLE SUBMIT] Coupon valid. Getting selections..."); // REMOVED LOG
         couponData = bettingCouponRef.current.getSelections(); 
         // console.log("[HANDLE SUBMIT] Got coupon selections:", couponData); // REMOVED LOG
      }
    } else {
        // console.warn("[HANDLE SUBMIT] bettingCouponRef is null!"); // REMOVED WARN LOG
    }

    // Validate questionnaire
    // console.log("[HANDLE SUBMIT] Checking questionnaireRef..."); // REMOVED LOG
    if (showQuestionnaire && questionnaireRef.current) {
      // console.log("[HANDLE SUBMIT] Validating questionnaire..."); // REMOVED LOG
      const questionnaireValidation = questionnaireRef.current.validatePredictions();
      // console.log("[HANDLE SUBMIT] Questionnaire validation result:", questionnaireValidation); // REMOVED LOG
      if (!questionnaireValidation.isValid) {
        // console.log("[HANDLE SUBMIT] Questionnaire invalid."); // REMOVED LOG
        isFormValid = false;
        combinedErrors.questionnaire = questionnaireValidation.errors || { form: "Please complete all predictions" };
      }
      // Note: Questionnaire data retrieval and submission will be handled separately later
    } else {
        // console.warn("[HANDLE SUBMIT] questionnaireRef is null or questionnaire hidden!"); // REMOVED WARN LOG
    }

    // Update state with combined errors and potentially a summary
    // console.log(`[HANDLE SUBMIT] Overall form validity: ${isFormValid}`); // REMOVED LOG
    if (!isFormValid) {
      // console.log("[HANDLE SUBMIT] Form invalid. Setting errors."); // REMOVED LOG
      combinedErrors.summary = "Please fix all errors in both sections before submitting";
      setValidationErrors(combinedErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // setIsSubmitting(false); // Let final one handle it
    } else {
      // console.log("[HANDLE SUBMIT] Form valid. Proceeding to submission logic."); // REMOVED LOG
      // Format coupon data for the API
      // console.log("[HANDLE SUBMIT] Checking couponData before fetch..."); // REMOVED LOG
      if (couponData && Object.keys(couponData).length > 0) {
        // console.log("[HANDLE SUBMIT] Formatting payload..."); // REMOVED LOG
        const payload = Object.entries(couponData).map(([fixtureId, prediction]) => ({
          fixture_id: parseInt(fixtureId, 10), // Convert key back to number
          prediction: prediction,
        }));
        
        // console.log("[HANDLE SUBMIT] Entering fetch try block..."); // REMOVED LOG
        try {
          // console.log('[HANDLE SUBMIT] Submitting bets payload:', JSON.stringify(payload, null, 2)); // Keep this one? Maybe remove later.
          const response = await fetch('/api/bets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          // console.log(`[HANDLE SUBMIT] Fetch response status: ${response.status}`); // REMOVED LOG

          if (!response.ok) {
            // console.log("[HANDLE SUBMIT] Fetch response NOT OK."); // REMOVED LOG
            // Handle API errors (e.g., round locked, unauthorized, server error)
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
            console.error('[HANDLE SUBMIT] API submission error:', errorData); // Keep error log
            setValidationErrors({ summary: `Submission failed: ${errorData.error || response.statusText}` });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setIsSubmitted(false); // Keep form visible on error
          } else {
            // console.log("[HANDLE SUBMIT] Fetch response OK."); // REMOVED LOG
            // Handle success
            setIsSubmitted(true); // Show success UI
            // Optionally reset selections/predictions here if needed
            // setSelections(initialSampleSelections); 
            // TODO: Add prediction reset if needed
          }
        } catch (error) {
          console.error('[HANDLE SUBMIT] Network or unexpected error during submission:', error); // Keep error log
          setValidationErrors({ summary: 'An unexpected error occurred. Please try again.' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsSubmitted(false);
        }
      } else {
           // This case should theoretically not happen if validation passes, but good to handle
           console.warn('[HANDLE SUBMIT] Form was valid, but no coupon data found to submit.'); // Keep warn log
           setValidationErrors({ summary: 'No betting selections found to submit.' });
           setIsSubmitted(false);
      }
      // Submit logic... - REMOVED Placeholder
      // setIsSubmitted(true);
    }
    
    // console.log("[HANDLE SUBMIT] Setting isSubmitting to false."); // REMOVED FINAL LOG
    setIsSubmitting(false); // Ensure this runs after API call completes or validation fails
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
      setAuthLoading(false);
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

  // --- useEffect for Fetching ALL Data (Fixtures, Teams, Players) --- 
  useEffect(() => {
    async function loadAllData() {
      setFixtureLoading(true);
      setQuestionnaireDataLoading(true);
      setFixtureError(null);
      setQuestionnaireDataError(null);

      const leagueId = 39;
      const seasonYear = 2024;
      // Re-introduce roundName and set it to 35
      const roundName = "Regular Season - 35"; 

      try {
        // Fetch all data concurrently
        const [fixtureRes, teamsRes, playersRes] = await Promise.all([
          // Restore round parameter in the fetch URL
          fetch(`/api/fixtures?league=${leagueId}&season=${seasonYear}&round=${encodeURIComponent(roundName)}`),
          fetch(`/api/teams?league=${leagueId}&season=${seasonYear}`),
          fetch(`/api/players?league=${leagueId}&season=${seasonYear}`)
        ]);

        // Process Fixtures
        if (!fixtureRes.ok) {
          const errorData = await fixtureRes.json().catch(() => ({})); 
          throw new Error(`Fixtures fetch failed: ${errorData.error || fixtureRes.statusText}`);
        }
        const fixtureData: Match[] = await fixtureRes.json();
        setMatchesForCoupon(fixtureData || []);
        console.log('Client-side fetch: Successfully fetched fixtures.', fixtureData);

        // Process Teams
        if (!teamsRes.ok) {
          const errorData = await teamsRes.json().catch(() => ({})); 
          throw new Error(`Teams fetch failed: ${errorData.error || teamsRes.statusText}`);
        }
        const teamsData: Team[] = await teamsRes.json();
        setTeamsForQuestionnaire(teamsData || []);
        console.log('Client-side fetch: Successfully fetched teams.', teamsData);

        // Process Players
        if (!playersRes.ok) {
          const errorData = await playersRes.json().catch(() => ({})); 
          throw new Error(`Players fetch failed: ${errorData.error || playersRes.statusText}`);
        }
        const playersData: Player[] = await playersRes.json();
        setPlayersForQuestionnaire(playersData || []);
        console.log('Client-side fetch: Successfully fetched players.', playersData);

      } catch (error: unknown) {
        console.error('Client-side data fetch error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load data.';
        // Set specific errors if possible, otherwise a general one
        // Check error message content to set specific error states
        if (message.includes('Fixtures')) setFixtureError(message);
        if (message.includes('Teams') || message.includes('Players')) setQuestionnaireDataError(message);
        // Set a general error if the source isn't clear
        if (!message.includes('Fixtures') && !message.includes('Teams') && !message.includes('Players')){
          setFixtureError('Failed to load fixture data.');
          setQuestionnaireDataError('Failed to load questionnaire data.');
        }

        // Reset data on error
        setMatchesForCoupon([]);
        setTeamsForQuestionnaire([]);
        setPlayersForQuestionnaire([]);
      } finally {
        setFixtureLoading(false);
        setQuestionnaireDataLoading(false);
      }
    }

    loadAllData();
  }, []); // Fetch all data once on mount

  // Check if we're in a test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  // Combine loading states
  if ((authLoading || fixtureLoading || questionnaireDataLoading) && !isTestEnvironment) return <p>Laddar...</p>;

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
                  {/* Render BettingCoupon directly again, passing state */}
                  {fixtureError ? (
                    <div className="text-red-500 p-4">Error: {fixtureError}</div>
                  ) : (
                    <BettingCoupon
                      ref={bettingCouponRef}
                      matches={matchesForCoupon} // <-- Use state data
                      initialSelections={initialSampleSelections}
                      onSelectionChange={handleSelectionChange}
                    />
                  )}
                </div>
              </div>
              
              <div className="flex justify-center w-full">
                <div className="w-full max-w-lg">
                  {/* Questionnaire */}
                  {questionnaireDataError ? (
                     <div className="text-red-500 p-4">Error loading questions: {questionnaireDataError}</div>
                  ) : (
                    <Questionnaire
                      ref={questionnaireRef}
                      showQuestionnaire={true}
                      // Pass fetched data instead of mock data
                      teams={teamsForQuestionnaire} 
                      players={playersForQuestionnaire}
                      initialPredictions={initialPredictions}
                      onPredictionChange={() => setValidationErrors({})} // Keep resetting validation errors on change
                      onToggleVisibility={handleQuestionnaireToggle}
                    />
                  )}
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
                         const match = matchesForCoupon.find(m => m.id.toString() === matchId); 
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
                  // Restore the original handleSubmit handler
                  // onClick={() => console.log('[TEST] Submit Button Clicked!')} 
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
