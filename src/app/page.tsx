'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import BettingCoupon, { BettingCouponRef } from '@/components/BettingCoupon/BettingCoupon';
// Correct type imports from component definitions
import type { /* Match, */ Selections, SelectionType } from "@/components/BettingCoupon/types"; 
import Questionnaire, { QuestionnaireRef as ImportedQuestionnaireRef } from '@/components/Questionnaire/Questionnaire'; // Removed SeasonAnswers import here
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire"; // Import SeasonAnswers directly
import type { /* Team as QuestionnaireTeam, Player, */ Prediction } from "@/components/Questionnaire/types"; 
import { Button } from "@/components/ui/button"; // Verified location
import { LoginButton } from '@/components/auth'; // Verified location

// Import the new hooks
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useFixtures } from '@/features/betting/hooks/useFixtures'; // Import useFixtures
// Import useQuestionnaireData
import { useQuestionnaireData } from '@/features/questionnaire/hooks/useQuestionnaireData';

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
  const handleSelectionChange = (newSelections: Selections) => {
    console.log('Selection change detected:', newSelections);
    setValidationErrors({});
  };

  const handleQuestionnaireToggle = () => {
    setIsQuestionnaireContentVisible(!isQuestionnaireContentVisible);
  };

  // --- Effects --- 

  // Realtime listener useEffect - (Will be updated in Task 6)
  useEffect(() => {
    // ... existing realtime logic ...
  }, []); 

  // Combined handler for submitting Coupon and Questionnaire (Will be updated later)
  const handleCombinedSubmit = async () => {
    if (!bettingCouponRef.current || !questionnaireRef.current) return;

    setSubmitStatus(null);
    setValidationErrors({});
    const combinedErrors: ErrorsState = {};
    let couponData: Selections | undefined;
    const answersData: SeasonAnswers[] | undefined = questionnaireRef.current.getAnswers();
    let isCouponValid = false;
    let isQuestionnaireValid = false;

    // 1. Validate Coupon
    const { isValid: couponIsValid, errors: couponErrors } = bettingCouponRef.current.validate();
    if (!couponIsValid) {
      console.error('Coupon Validation failed', couponErrors);
      combinedErrors.coupon = couponErrors ?? { form: 'Coupon is invalid' };
    } else {
      couponData = bettingCouponRef.current.getSelections();
      if (!couponData || Object.keys(couponData).length === 0) {
        console.warn('Coupon valid, but no selections found.');
        combinedErrors.coupon = { form: 'No selections made.' };
      } else {
        isCouponValid = true;
      }
    }

    // 2. Validate Questionnaire
    const allAnswered = answersData?.every(ans => ans.answered_team_id !== null || ans.answered_player_id !== null);
    if (!allAnswered || !answersData || answersData.length < 4) {
        console.error('Questionnaire Validation failed', answersData);
        combinedErrors.questionnaire = { form: 'Please answer all season questions.' };
    } else {
        isQuestionnaireValid = true;
    }

    // 3. Check Overall Validity & Update Summary Error
    if (!isCouponValid || !isQuestionnaireValid) {
      combinedErrors.summary = 'Please fix all errors before submitting.';
      setValidationErrors(combinedErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 4. Prepare and Submit if both are valid
    if (!couponData || !answersData) {
      console.error('Data retrieval failed after validation passed. This should not happen.');
      setSubmitStatus({ type: 'error', message: 'Internal error preparing data.' });
      return;
    }

    setIsSubmitting(true);
    let submissionError = null;

    try {
      // Submit Bets
      const bets = Object.entries(couponData).map(([fixtureId, prediction]) => ({
        fixture_id: parseInt(fixtureId, 10),
        prediction: prediction as SelectionType,
      }));
      const betsResponse = await fetch('/api/bets', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(bets),
      });
      const betsResult = await betsResponse.json();
      if (!betsResponse.ok) {
        submissionError = `Coupon submission failed: ${betsResult.error || 'Unknown error'}`;
        throw new Error(submissionError);
      }
      console.log('Coupon submission successful:', betsResult);

      // Submit Season Answers (only if coupon succeeded)
      const answersResponse = await fetch('/api/season-answers', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(answersData),
      });
      const answersResult = await answersResponse.json();
      if (!answersResponse.ok) {
        submissionError = `Season answers submission failed: ${answersResult.error || 'Unknown error'}`;
        // Note: Bets might have succeeded, but answers failed. Consider rollback or notification.
        throw new Error(submissionError);
      }
      console.log('Season answers submission successful:', answersResult);

      // Both succeeded
      setSubmitStatus({ type: 'success', message: 'Coupon and answers submitted successfully!' });

    } catch (error) {
      console.error('Combined submission error:', error);
      const errorMsg = submissionError || (error as Error).message || 'An error occurred during submission.';
      setSubmitStatus({ type: 'error', message: errorMsg });
      setValidationErrors(prev => ({ ...prev, summary: errorMsg }));
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
        {/* Questionnaire Section (uses data from useQuestionnaireData hook) */}
        <Suspense fallback={<div>Loading Questionnaire...</div>}>
          <Questionnaire
            ref={questionnaireRef}
            teams={teamsForQuestionnaire ?? []} // Use data from hook, provide fallback
            players={playersForQuestionnaire ?? []} // Use data from hook, provide fallback
            initialPredictions={initialPredictions}
            onPredictionChange={() => { /* Handle if needed */ }}
            onToggleVisibility={handleQuestionnaireToggle}
          />
        </Suspense>

        {/* Use validationErrors state */}
        {validationErrors.summary && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            {validationErrors.summary}
          </div>
        )}

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
            onSelectionChange={handleSelectionChange}
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