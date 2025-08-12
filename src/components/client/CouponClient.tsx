'use client';

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { LoginButton } from '@/components/auth';
import { Spinner } from "@/components/ui/spinner"; 
import BettingCoupon, { BettingCouponRef } from '@/components/BettingCoupon/BettingCoupon';
import type { Selections } from "@/components/BettingCoupon/types"; 
import Questionnaire, { QuestionnaireRef as ImportedQuestionnaireRef } from '@/components/Questionnaire/Questionnaire';
import type { Prediction, PredictionKeys } from "@/components/Questionnaire/types"; 
import { toast } from "sonner"

// Import types/functions needed from server-side fetch (passed as props)
// import type { Match } from '@/components/BettingCoupon/types'; // Removed unused import
import type { CurrentRoundFixturesResult } from '@/lib/supabase/queries'; // Type for the prop

// Client-side specific imports
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuestionnaireData } from '@/features/questionnaire/hooks/useQuestionnaireData';
import { useBettingFormStorage } from '@/lib/hooks/useLocalStorage';
import { getStoredSession } from '@/utils/auth/storage';
import {
  validateCouponSelections,
  validateQuestionnaireAnswers,
  // prepareBetSubmissionData, // Removed unused import
  // prepareAnswersSubmissionData // Removed unused import
} from '@/features/betting/utils/submissionHelpers';
import { submitPredictions } from '@/services/submissionService'; 

// --- Component Definition ---

// Interface for props passed from Server Component (Page)
interface CouponClientProps {
  initialRoundData: CurrentRoundFixturesResult | null;
  currentLeagueId: number;
  currentSeasonYear: number;
  questionnaireVisible: boolean;
}

// Initial states 
const initialSampleSelections: Selections = {};

interface ErrorsState {
  coupon?: Record<string, string>;
  questionnaire?: Record<string, string>; 
  summary?: string;
}

// Define the Client Component
export default function CouponClient({ 
  initialRoundData,
  currentLeagueId,
  currentSeasonYear,
  questionnaireVisible 
}: CouponClientProps) {
  // Client-side hooks and state management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<ErrorsState>({});
  const { user, isLoading: authLoading } = useAuth();
  
  // LocalStorage management for form persistence
  const { clearAllFormData } = useBettingFormStorage();
  
  // Questionnaire data hook
  const { 
    teams: teamsForQuestionnaire,
    players: playersForQuestionnaire,
    isLoading: questionnaireDataLoading,
    error: questionnaireDataError, 
  } = useQuestionnaireData({ 
    leagueId: currentLeagueId, 
    season: currentSeasonYear 
  }); // Use dynamic values from props

  // Refs 
  const questionnaireRef = useRef<ImportedQuestionnaireRef>(null);
  const bettingCouponRef = useRef<BettingCouponRef>(null);

  // Extract data from props
  const roundNameForTitle = initialRoundData?.roundName ?? 'Current Round';
  const matchesForCoupon = initialRoundData?.matches ?? [];
  
  // State for user season answers (now fetched client-side)
  const [userSeasonAnswers, setUserSeasonAnswers] = useState(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  
  // Transform user season answers to initial predictions format
  const initialPredictionsWithUserAnswers: Prediction = {
    leagueWinner: userSeasonAnswers?.league_winner?.toString() ?? null,
    topScorer: userSeasonAnswers?.top_scorer?.toString() ?? null,
    bestGoalDifference: userSeasonAnswers?.best_goal_difference?.toString() ?? null,
    lastPlace: userSeasonAnswers?.last_place?.toString() ?? null
  };

  // Debug logging for the predictions
  console.log('🔍 CouponClient data debug:', {
    userSeasonAnswers,
    initialPredictionsWithUserAnswers,
    hasAnswers: !!userSeasonAnswers,
    answersKeys: userSeasonAnswers ? Object.keys(userSeasonAnswers) : []
  });

  // Fetch user season answers when user is authenticated
  useEffect(() => {
    console.log('🔍 CouponClient useEffect triggered:', { 
      hasUser: !!user, 
      userEmail: user?.email,
      answersLoading, 
      hasUserSeasonAnswers: !!userSeasonAnswers 
    });

    async function fetchUserAnswers() {
      if (!user) {
        console.log('🔍 No user authenticated yet, skipping answer fetch');
        return;
      }
      
      if (answersLoading) {
        console.log('🔍 Already loading answers, skipping');
        return;
      }
      
      if (userSeasonAnswers) {
        console.log('🔍 Already have user answers, skipping');
        return;
      }

      console.log('🔍 Starting to fetch user season answers for:', user.email);
      setAnswersLoading(true);
      
      try {
        // Get auth token from localStorage using our auth utility
        const storedSession = getStoredSession();
        const authToken = storedSession?.access_token;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        console.log('🔍 Fetching user season answers...');
        const response = await fetch('/api/user-season-answers', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 User season answers response:', data);
          
          if (data.userSeasonAnswers) {
            setUserSeasonAnswers(data.userSeasonAnswers);
            console.log('✅ User season answers loaded for pre-population');
          } else {
            console.log('ℹ️ No previous answers found for user');
          }
        } else {
          console.warn('Failed to fetch user season answers:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching user season answers:', error);
      } finally {
        setAnswersLoading(false);
      }
    }

    fetchUserAnswers();
  }, [user, answersLoading, userSeasonAnswers]);
  
  // Handlers
  const handleSelectionChange = (newSelections: Selections, matchId: string) => {
    setValidationErrors(prev => {
      const updatedErrors = { ...prev };
      const updatedCouponErrors = prev.coupon ? { ...prev.coupon } : {};
      let specificCouponErrorCleared = false;
      const matchKey1 = `match_${matchId}`;
      const matchKey2 = matchId;

      if (updatedCouponErrors[matchKey1]) {
        delete updatedCouponErrors[matchKey1];
        specificCouponErrorCleared = true;
      } else if (updatedCouponErrors[matchKey2]) {
        delete updatedCouponErrors[matchKey2];
        specificCouponErrorCleared = true;
      }

      updatedErrors.coupon = updatedCouponErrors;
      
      const remainingCouponErrors = Object.keys(updatedCouponErrors).filter(k => k !== 'form').length === 0;
      const remainingQuestionnaireErrors = !updatedErrors.questionnaire || Object.keys(updatedErrors.questionnaire).filter(k => k !== 'form').length === 0; 

      if (specificCouponErrorCleared && remainingCouponErrors && remainingQuestionnaireErrors && updatedErrors.summary) {
        delete updatedErrors.summary;
      }

      return updatedErrors;
    });
  };
  
  const handlePredictionChange = (questionKey: PredictionKeys) => {
    setValidationErrors(prev => {
      if (!prev.questionnaire) return prev;
      const updatedErrors = { ...prev };
      const updatedQuestionnaireErrors = { ...prev.questionnaire };

      if (updatedQuestionnaireErrors[questionKey]) {
        delete updatedQuestionnaireErrors[questionKey];
      }
      
      const allSpecificCleared = Object.keys(updatedQuestionnaireErrors).every(k => k === 'form' || !updatedQuestionnaireErrors[k]);
      if(allSpecificCleared && updatedQuestionnaireErrors.form){
          delete updatedQuestionnaireErrors.form;
      }

      const remainingCouponErrors = !updatedErrors.coupon || Object.keys(updatedErrors.coupon).filter(k => k !== 'form').length === 0;
      const remainingQuestionnaireErrors = Object.keys(updatedQuestionnaireErrors).length === 0;

      if (remainingCouponErrors && remainingQuestionnaireErrors && updatedErrors.summary) {
        delete updatedErrors.summary;
      }

      updatedErrors.questionnaire = updatedQuestionnaireErrors;
      return updatedErrors;
    });
  };
  
  const handleCombinedSubmit = async () => {
    if (!bettingCouponRef.current) {
      toast.error('An unexpected error occurred (refs). Please try again.');
      return;
    }
    if (questionnaireVisible && !questionnaireRef.current) {
      toast.error('An unexpected error occurred (questionnaire ref). Please try again.');
      return;
    }
    setValidationErrors({});
    setIsSubmitting(true);

    const currentSelections = bettingCouponRef.current.getSelections();
    const currentAnswers = questionnaireVisible && questionnaireRef.current ? questionnaireRef.current.getAnswers() : [];
    const currentMatches = matchesForCoupon; 

    const couponValidation = validateCouponSelections(currentSelections, currentMatches);
    const answersValidation = questionnaireVisible ? validateQuestionnaireAnswers(currentAnswers) : { isValid: true };

    const combinedErrors: ErrorsState = {};
    if (!couponValidation.isValid) {
      combinedErrors.coupon = couponValidation.errors ?? { form: 'Coupon is invalid' };
    }
    if (questionnaireVisible && !answersValidation.isValid) {
      combinedErrors.questionnaire = answersValidation.errors ?? { form: 'Questionnaire is invalid' };
    }

    if (!couponValidation.isValid || (questionnaireVisible && !answersValidation.isValid)) {
      combinedErrors.summary = 'Please fix the errors highlighted below.';
      setValidationErrors(combinedErrors);
      toast.error("Please fix the errors highlighted below.");
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    try {
      const submissionResult = await submitPredictions({ 
          couponData: currentSelections, 
          answersData: currentAnswers,  
      });

      if (submissionResult.betsResult && (submissionResult.answersResult || !questionnaireVisible)) {
        const successMessage = questionnaireVisible 
          ? (submissionResult.answersResult?.message || submissionResult.betsResult.message || 'Coupon and answers submitted successfully!')
          : (submissionResult.betsResult.message || 'Coupon submitted successfully!');
        toast.success(successMessage);
        setSubmitStatus({ type: 'success', message: successMessage });
        
        // Clear localStorage after successful submission
        clearAllFormData();
      } else { 
        console.error('Submission response format unexpected:', submissionResult);
        toast.error('An unexpected response was received from the server.');
        setValidationErrors(prev => ({ ...prev, summary: 'Unexpected server response.' }));
        setSubmitStatus({ type: 'error', message: 'An unexpected response was received from the server.' });
      }

    } catch (error: unknown) {
      console.error('Unexpected submission error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected network or server error occurred.';
      toast.error(message);
      setValidationErrors(prev => ({ ...prev, summary: message }));
      setSubmitStatus({ type: 'error', message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // --- Render Logic --- 
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  // Initial check from props if round data exists
  if (!initialRoundData && !isTestEnvironment) {
       return (
         <div className="flex-1 w-full flex flex-col gap-10 items-center px-4 py-8">
            <LoginButton />
            <div className="w-full max-w-4xl text-center">
               <h1 className="text-3xl font-bold mb-6">League Coupon</h1>
               <p className="text-xl text-gray-600">Ingen nuvarande bettingomgång hittades.</p> 
            </div>
         </div>
       );
  }

  // Combined loading state 
  if ((authLoading || questionnaireDataLoading) && !isTestEnvironment) {
    return (
      <div className="flex flex-1 justify-center items-center min-h-screen">
        <Spinner size={32} className="mr-2" />
        <p className="text-lg">Laddar...</p> 
      </div>
    );
  }

  // Main UI
  return (
    <div className="flex-1 w-full flex flex-col gap-10 items-center px-4 py-8">
      <LoginButton />
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center">League Coupon</h1>

        {validationErrors.summary && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
            {validationErrors.summary}
          </div>
        )}
        
        {questionnaireDataError && (
           <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm w-full" role="alert">
             Questionnaire Data Error: {questionnaireDataError}
           </div>
        )}

        {/* Questionnaire Section */}
        {questionnaireVisible && (
          <Suspense fallback={<div className="flex justify-center py-4"><Spinner /></div>}> 
            {!questionnaireDataError && (
              <Questionnaire
                ref={questionnaireRef}
                teams={teamsForQuestionnaire ?? []}
                players={playersForQuestionnaire ?? []}
                initialPredictions={initialPredictionsWithUserAnswers}
                onPredictionChange={handlePredictionChange}
                validationErrors={validationErrors.questionnaire}
              />
            )}
          </Suspense>
        )}

        {/* Betting Coupon Section */}
        <Suspense fallback={<div className="flex justify-center py-4"><Spinner /></div>}> 
          <BettingCoupon
            ref={bettingCouponRef}
            matches={matchesForCoupon} 
            title={roundNameForTitle}   
            initialSelections={initialSampleSelections}
            onSelectionChange={handleSelectionChange}
            validationErrors={validationErrors.coupon}
          />
        </Suspense>

        {/* Submit Status and Button */}
        {submitStatus && (
          <div className={`p-4 my-2 rounded-md ${submitStatus.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {submitStatus.message}
          </div>
        )}
        <Button
          onClick={handleCombinedSubmit}
          disabled={
            isSubmitting || 
            authLoading || 
            questionnaireDataLoading || 
            !user || 
            !!questionnaireDataError || 
            matchesForCoupon.length === 0 
          } 
          className="w-full md:w-auto self-center mt-4"
        >
          {(isSubmitting || authLoading || questionnaireDataLoading) ? 'Submitting...' : 'Submit Coupon'} 
        </Button>

      </div>
      {/* Footer */}
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