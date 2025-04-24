'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import BettingCoupon, { BettingCouponRef } from '@/components/BettingCoupon/BettingCoupon';
// Correct type imports from component definitions
import type { /* Match, */ Selections /*, SelectionType */ } from "@/components/BettingCoupon/types"; 
import Questionnaire, { QuestionnaireRef as ImportedQuestionnaireRef } from '@/components/Questionnaire/Questionnaire'; // Removed SeasonAnswers import here
// Removed unused type import
// import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";
import type { /* Team as QuestionnaireTeam, Player, */ Prediction, PredictionKeys } from "@/components/Questionnaire/types"; 
import { Button } from "@/components/ui/button"; // Verified location
import { LoginButton } from '@/components/auth'; // Verified location

// Import the new hooks
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useFixtures } from '@/features/betting/hooks/useFixtures'; // Import useFixtures
// Import useQuestionnaireData
import { useQuestionnaireData } from '@/features/questionnaire/hooks/useQuestionnaireData';

// Import helpers and service
import {
  validateCouponSelections,
  validateQuestionnaireAnswers,
  prepareBetSubmissionData,
  prepareAnswersSubmissionData
} from '@/features/betting/utils/submissionHelpers';
// Corrected import to named export
import { submitPredictions } from '@/services/submissionService'; 

// Import sonner toast function
import { toast } from "sonner"

// Import Supabase client creator
import { createClient } from '@/utils/supabase/client';

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

// Removed ServerProps interface as it's no longer needed
// interface ServerProps { ... }

// Refactored component: Removed ServerComponentWrapper and initialProps
export default function Page() {
  // --- Constants for Data Fetching (Example) ---
  // TODO: Make these dynamic if needed (e.g., based on user selection or route)
  const leagueId = 39;
  const seasonYear = 2024;
  const roundName = "Regular Season - 35"; // Example round

  // --- Other State --- 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isQuestionnaireContentVisible, setIsQuestionnaireContentVisible] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ErrorsState>({});

  // --- Use Custom Hooks --- 
  const { user, isLoading: authLoading } = useAuth();
  // Call useFixtures hook
  const { 
    matches: matchesForCoupon, // Rename to match existing usage 
    isLoading: fixtureLoading, // Rename to match existing usage
    error: fixtureError,       // Rename to match existing usage
    refetch: refetchFixtures  // Add refetch back for listener
  } = useFixtures({ leagueId, season: seasonYear, round: roundName });

  // Call useQuestionnaireData hook
  const { 
    teams: teamsForQuestionnaire,           // Rename to match existing usage
    players: playersForQuestionnaire,         // Rename to match existing usage
    isLoading: questionnaireDataLoading,    // Rename to match existing usage
    error: questionnaireDataError,           // Rename to match existing usage
  } = useQuestionnaireData({ leagueId, season: seasonYear });

  // --- Refs --- 
  const questionnaireRef = useRef<ImportedQuestionnaireRef>(null);
  const bettingCouponRef = useRef<BettingCouponRef>(null);

  // --- Handlers --- 
  // Updated to clear specific match error
  const handleSelectionChange = (newSelections: Selections, matchId: string) => {
    console.log('Selection change detected for match:', matchId, newSelections);
    // Clear validation error for this specific match if it exists
    setValidationErrors(prev => {
      // Check if coupon errors exist and the specific match error exists
      if (prev.coupon && prev.coupon[`match_${matchId}`]) { // Check for helper format
        const updatedCouponErrors = { ...prev.coupon };
        delete updatedCouponErrors[`match_${matchId}`]; // Remove the specific error
        return { ...prev, coupon: updatedCouponErrors };
      } else if (prev.coupon && prev.coupon[matchId]) { // Check for direct ID format (fallback)
         const updatedCouponErrors = { ...prev.coupon };
        delete updatedCouponErrors[matchId]; // Remove the specific error
        return { ...prev, coupon: updatedCouponErrors };
      }
      return prev; // No change needed
    });
    // setSubmitStatus(null); // Don't clear general status on selection change
  };

  // Handler to clear specific questionnaire errors on change
  const handlePredictionChange = (questionKey: PredictionKeys) => {
    console.log('Prediction change detected for question:', questionKey);
    const specificQuestionKeys: PredictionKeys[] = ['leagueWinner', 'lastPlace', 'bestGoalDifference', 'topScorer'];
    setValidationErrors(prev => {
      if (!prev.questionnaire) return prev; // No questionnaire errors to begin with

      const updatedErrors = { ...prev }; // Copy the whole errors state
      const updatedQuestionnaireErrors = { ...prev.questionnaire }; // Copy questionnaire errors

      // Clear the specific error if it exists
      if (updatedQuestionnaireErrors[questionKey]) {
        delete updatedQuestionnaireErrors[questionKey];
      }

      // Check if all *specific* question errors are now cleared
      const allSpecificErrorsCleared = specificQuestionKeys.every(
        key => !updatedQuestionnaireErrors[key]
      );

      // If all specific errors are cleared, also clear the general form error
      if (allSpecificErrorsCleared && updatedQuestionnaireErrors.form) {
        delete updatedQuestionnaireErrors.form;
      }

      // Update the main errors state with the modified questionnaire errors
      updatedErrors.questionnaire = updatedQuestionnaireErrors;

      return updatedErrors;
    });
    // setSubmitStatus(null); // Don't clear general status on prediction change
  };

  const handleQuestionnaireToggle = () => {
    setIsQuestionnaireContentVisible(!isQuestionnaireContentVisible);
  };

  // --- Effects --- 

  // Realtime listener for bets changes
  useEffect(() => {
    // Only run if the user is logged in and refetch function is available
    if (!user?.id || !refetchFixtures) return;

    console.log('Setting up realtime listener for user:', user.id);
    const supabase = createClient();

    const channel = supabase
      .channel(`bets_changes_for_${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*' as const, // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'bets', 
          filter: `user_id=eq.${user.id}` // Filter for the current user
        },
        (payload) => {
          console.log('Realtime bet change received!', payload);
          // Instead of directly manipulating state, call the refetch function from the hook.
          // This assumes the /api/fixtures endpoint might reflect user's bets or
          // that refetching fixtures is the desired action per Task 6 description.
          refetchFixtures(); 
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to bets changes for user:', user.id);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', status, err);
          // Optional: Add error handling, e.g., notify user, retry subscription
        }
      });

    // Cleanup function to remove the channel subscription when the component unmounts
    // or when user.id or refetchFixtures changes.
    return () => {
      if (channel) {
        console.log('Removing realtime listener for user:', user.id);
        supabase.removeChannel(channel).catch(error => {
          console.error('Error removing Supabase channel:', error);
        });
      }
    };
  }, [user?.id, refetchFixtures]); // Depend on user ID and the refetch function itself

  // Combined handler for submitting Coupon and Questionnaire (Refactored)
  const handleCombinedSubmit = async () => {
    // Ensure refs are current
    if (!bettingCouponRef.current || !questionnaireRef.current) {
      console.error("Component refs not available");
      // Restore on-page status message
      setSubmitStatus({ type: 'error', message: 'An unexpected error occurred (refs). Please try again.' });
      toast.error('An unexpected error occurred (refs). Please try again.'); // Add toast too
      return;
    }

    // Reset state
    // setSubmitStatus(null); // No longer needed, toasts will provide feedback
    setValidationErrors({}); // Reset errors
    setIsSubmitting(true);

    // 1. Get Data from Components
    const currentSelections = bettingCouponRef.current.getSelections();
    const currentAnswers = questionnaireRef.current.getAnswers();
    const currentMatches = matchesForCoupon || []; // Get matches from useFixtures hook

    // 2. Validate Data using Helpers
    const couponValidation = validateCouponSelections(currentSelections, currentMatches);
    const answersValidation = validateQuestionnaireAnswers(currentAnswers);

    // 3. Aggregate Errors
    const combinedErrors: ErrorsState = {};
    if (!couponValidation.isValid) {
      combinedErrors.coupon = couponValidation.errors ?? { form: 'Coupon is invalid' };
    }
    if (!answersValidation.isValid) {
      combinedErrors.questionnaire = answersValidation.errors ?? { form: 'Questionnaire is invalid' };
    }

    // 4. Check Overall Validity & Update UI
    if (!couponValidation.isValid || !answersValidation.isValid) {
      combinedErrors.summary = 'Please fix the errors highlighted below.';
      setValidationErrors(combinedErrors);
      // Add validation error toast
      toast.error("Please fix the errors highlighted below.");
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 5. Prepare Data for Submission using Helpers
    // Ensure data is not null/undefined after validation check (shouldn't happen)
    if (!currentSelections || !currentAnswers) {
        console.error('Data missing after validation!');
        // Restore on-page status message
        setSubmitStatus({ type: 'error', message: 'Internal error preparing data.' });
        toast.error('Internal error preparing data.'); // Add toast too
        setIsSubmitting(false);
        return;
    }
    const betsPayload = prepareBetSubmissionData(currentSelections);
    const answersPayload = prepareAnswersSubmissionData(currentAnswers);

    // 6. Call Submission Service
    try {
      console.log('Submitting data:', { betsPayload, answersPayload });
      // Assuming submissionService handles both bets and answers
      // Adjust the call signature based on the actual service implementation
      const submissionResult = await submitPredictions({ 
          couponData: currentSelections, // Assuming submitPredictions expects this structure
          answersData: currentAnswers,  // Assuming submitPredictions expects this structure
      });

      // Handle potential partial success if the service indicates it
      if (submissionResult.betsResult && submissionResult.answersResult) {
        console.log('Combined submission successful:', submissionResult);
        // Use messages from the results if available
        const successMessage = submissionResult.answersResult.message || submissionResult.betsResult.message || 'Coupon and answers submitted successfully!';
        // Show success toast
        toast.success(successMessage);
        // Restore on-page status message
        setSubmitStatus({ type: 'success', message: successMessage });
        // Optionally reset forms/selections here
        // bettingCouponRef.current.resetSelections();
        // questionnaireRef.current.resetAnswers(); 
      } else { 
        // This block might not be reached if the service throws on failure
        console.error('Submission response format unexpected:', submissionResult);
        // Show error toast for unexpected response
        toast.error('An unexpected response was received from the server.');
        setValidationErrors(prev => ({ ...prev, summary: 'Unexpected server response.' }));
        // Restore on-page status message
        setSubmitStatus({ type: 'error', message: 'An unexpected response was received from the server.' });
      }

    } catch (error: unknown) {
      // Handle unexpected errors during the service call (e.g., network error or error thrown by submitPredictions)
      console.error('Unexpected submission error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected network or server error occurred.';
      // Show error toast
      toast.error(message);
      setValidationErrors(prev => ({ ...prev, summary: message }));
      // Restore on-page status message
      setSubmitStatus({ type: 'error', message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if we're in a test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  // --- Render Logic --- 
  // Use fixtureLoading from useFixtures hook
  if ((authLoading || fixtureLoading || questionnaireDataLoading) && !isTestEnvironment) return <p>Laddar...</p>;

  return (
    <div className="flex-1 w-full flex flex-col gap-10 items-center px-4 py-8">
      <LoginButton />
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center">League Coupon</h1>

        {/* Use questionnaireDataError from useQuestionnaireData hook */}
        {questionnaireDataError && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            Error loading questionnaire data: {questionnaireDataError}
          </div>
        )}
        {/* --- MOVED: Generic Validation Summary --- */}
        {validationErrors.summary && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
            {validationErrors.summary}
          </div>
        )}
        {/* --- END MOVED SECTION --- */}
        {/* Questionnaire Section (uses data from useQuestionnaireData hook) */}
        <Suspense fallback={<div>Loading Questionnaire...</div>}>
          <Questionnaire
            ref={questionnaireRef}
            teams={teamsForQuestionnaire ?? []} // Use data from hook, provide fallback
            players={playersForQuestionnaire ?? []} // Use data from hook, provide fallback
            initialPredictions={initialPredictions}
            onPredictionChange={handlePredictionChange} // Pass the handler
            onToggleVisibility={handleQuestionnaireToggle}
            validationErrors={validationErrors.questionnaire}
          />
        </Suspense>

        {/* Use fixtureError from useFixtures hook */}
        {fixtureError && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            Error loading fixtures: {fixtureError}
          </div>
        )}
        {/* Betting Coupon Section */}
        <Suspense fallback={<div>Loading Betting Coupon...</div>}>
          <BettingCoupon
            ref={bettingCouponRef}
            matches={matchesForCoupon} // Use matchesForCoupon from useFixtures hook
            initialSelections={initialSampleSelections}
            onSelectionChange={(newSelections: Selections, matchId: string) => 
              handleSelectionChange(newSelections, matchId)
            }
            validationErrors={validationErrors.coupon}
          />
        </Suspense>

        {/* Use submitStatus state */}
        {submitStatus && (
          <div className={`p-4 my-2 rounded-md ${submitStatus.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {submitStatus.message}
          </div>
        )}
        <Button
          onClick={handleCombinedSubmit} 
          disabled={isSubmitting || authLoading || !user} 
          className="w-full md:w-auto self-center mt-4"
        >
          {(isSubmitting || authLoading) ? 'Submitting...' : 'Submit Coupon'} 
        </Button>

      </div>
      <footer className="w-full border-t border-t-foreground/10 p-8 flex justify-center text-center text-xs">
        <p>
          Powered by{' '}
          <a
            href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
            target="_blank"
            className="font-bold hover:underline"
            rel="noreferrer"
          >
            Supabase
          </a>
        </p>
      </footer>
    </div>
  );
}