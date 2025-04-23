'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import BettingCoupon, { BettingCouponRef } from '@/components/BettingCoupon/BettingCoupon';
// Correct type imports from component definitions
import type { Match, Selections, SelectionType } from "@/components/BettingCoupon/types"; // Correct type name
import Questionnaire, { QuestionnaireRef as ImportedQuestionnaireRef, SeasonAnswers } from '@/components/Questionnaire/Questionnaire';
import type { Team as QuestionnaireTeam, Player, Prediction } from "@/components/Questionnaire/types"; // Verified location
import { Button } from "@/components/ui/button"; // Verified location
import { LoginButton } from '@/components/auth'; // Verified location

import { createClient } from '@/utils/supabase/client';
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

// Removed ServerProps interface as it's no longer needed
// interface ServerProps { ... }

// Refactored component: Removed ServerComponentWrapper and initialProps
export default function Page() {
  // State initialization no longer relies on props
  // const [props, setProps] = useState(initialProps); // Removed
  const [isLoading, setIsLoading] = useState(false);
  // Renamed state for combined submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State for selections and predictions - Initial state uses imported value
  const [selections, setSelections] = useState<Selections>(initialSampleSelections);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showQuestionnaire, setShowQuestionnaire] = useState(true);
  const [isQuestionnaireContentVisible, setIsQuestionnaireContentVisible] = useState(true);
  // Use the new structured error state
  const [validationErrors, setValidationErrors] = useState<ErrorsState>({});

  // Log initial selections on mount
  useEffect(() => {
    console.log('Initial selections loaded:', initialSampleSelections);
    console.log('Current selections state:', selections);
  }, [selections]);

  // Create ref for the questionnaire component with proper IMPORTED type
  const questionnaireRef = useRef<ImportedQuestionnaireRef>(null);

  // Create ref for the betting coupon component with proper IMPORTED type
  const bettingCouponRef = useRef<BettingCouponRef>(null);

  // Initialize user state to null
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Separate loading state for auth

  // Add state for the fetched matches
  const [matchesForCoupon, setMatchesForCoupon] = useState<Match[]>([]); // Use Match type from BettingCoupon types
  const [fixtureLoading, setFixtureLoading] = useState(true); // Loading state for fixtures
  const [fixtureError, setFixtureError] = useState<string | null>(null); // Error state for fixtures

  // Questionnaire Data State
  const [teamsForQuestionnaire, setTeamsForQuestionnaire] = useState<QuestionnaireTeam[]>([]); // Use Team type from Questionnaire types
  const [playersForQuestionnaire, setPlayersForQuestionnaire] = useState<Player[]>([]);
  const [questionnaireDataLoading, setQuestionnaireDataLoading] = useState(true);
  const [questionnaireDataError, setQuestionnaireDataError] = useState<string | null>(null);

  // Handler for selection changes
  const handleSelectionChange = (newSelections: Selections) => {
    console.log('Selection change detected:', newSelections);
    setSelections({...newSelections});
    // Reset validation errors on any change for simplicity, or be more granular
    setValidationErrors({});
  };

  // Handler for questionnaire content toggle
  const handleQuestionnaireToggle = () => {
    setIsQuestionnaireContentVisible(!isQuestionnaireContentVisible);
  };

  // Authentication useEffect - Sets user state directly
  useEffect(() => {
    const client = createClient();
    // Set loading true initially, outside the async/listener logic
    setAuthLoading(true);

    // Perform initial user check
    client.auth.getUser().then(({ data: { user: initialUser } }) => {
        setUser(initialUser ?? null); // Set user state directly
        setAuthLoading(false); // Set loading false after initial check
    });

    // Set up the listener
    const { data: { subscription } } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser); // Update user state on change
        // We don't need to manage authLoading here anymore, initial check handles it
    });

    // Cleanup listener on unmount
    return () => {
        subscription?.unsubscribe();
    };
  }, []); // Use empty dependency array to run once on mount


  // --- useEffect for Fetching ALL Data (Fixtures, Teams, Players) --- Corrected paths
  useEffect(() => {
    async function loadAllData() {
      setFixtureLoading(true);
      setQuestionnaireDataLoading(true);
      setFixtureError(null);
      setQuestionnaireDataError(null);

      const leagueId = 39;
      const seasonYear = 2024;
      const roundName = "Regular Season - 35";

      try {
        // Fetch all data concurrently using direct API calls
        const [fixtureRes, teamsRes, playersRes] = await Promise.all([
          fetch(`/api/fixtures?league=${leagueId}&season=${seasonYear}&round=${encodeURIComponent(roundName)}`),
          fetch(`/api/teams?league=${leagueId}&season=${seasonYear}`),
          fetch(`/api/players?league=${leagueId}&season=${seasonYear}`)
        ]);

        // Process Fixtures
        if (!fixtureRes.ok) {
          const errorData = await fixtureRes.json().catch(() => ({}));
          throw new Error(`Fixtures fetch failed: ${errorData.error || fixtureRes.statusText}`);
        }
        const fixtureData: Match[] = await fixtureRes.json(); // Use Match type from BettingCoupon
        setMatchesForCoupon(fixtureData || []);
        console.log('Client-side fetch: Successfully fetched fixtures.', fixtureData);

        // Process Teams
        if (!teamsRes.ok) {
          const errorData = await teamsRes.json().catch(() => ({}));
          throw new Error(`Teams fetch failed: ${errorData.error || teamsRes.statusText}`);
        }
        const teamsData: QuestionnaireTeam[] = await teamsRes.json(); // Use QuestionnaireTeam type
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
        if (message.includes('Fixtures')) setFixtureError(message);
        if (message.includes('Teams') || message.includes('Players')) setQuestionnaireDataError(message);
        if (!message.includes('Fixtures') && !message.includes('Teams') && !message.includes('Players')){
          setFixtureError('Failed to load fixture data.');
          setQuestionnaireDataError('Failed to load questionnaire data.');
        }
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

  // Realtime listener useEffect - Simplified dependencies
  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel('realtime fixtures')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fixtures' },
        async (payload) => {
          console.log('Realtime Change received!', payload);
          if (payload.new) {
            setIsLoading(true);
            // Re-fetch data or update state based on payload
            // Example: Re-fetch all fixtures for simplicity
            try {
                const fixtureResponse = await fetch(`/api/fixtures?league=39&season=2024&round=${encodeURIComponent("Regular Season - 35")}`);
                if (!fixtureResponse.ok) throw new Error('Failed to re-fetch fixtures');
                const fixturesData = await fixtureResponse.json();
                setMatchesForCoupon(fixturesData || []);
                // Removed setProps update
            } catch (err) {
                console.error("Error re-fetching fixtures after realtime update:", err);
            }
            setIsLoading(false);
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []); // Simplified dependency array


  // Combined handler for submitting Coupon and Questionnaire
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

  // Combine loading states - Use local component state
  // Use authLoading directly here instead of relying on potentially stale props.user
  if ((authLoading || fixtureLoading || questionnaireDataLoading) && !isTestEnvironment) return <p>Laddar...</p>;

  // JSX return block - Use the corrected version provided previously
  return (
    <div className="flex-1 w-full flex flex-col gap-10 items-center px-4 py-8">
      <LoginButton />
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center">League Coupon</h1>

        {/* Display Questionnaire Data Error */}
        {questionnaireDataError && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            Error loading questionnaire data: {questionnaireDataError}
          </div>
        )}
        {/* Questionnaire Section */}
        <Suspense fallback={<div>Loading Questionnaire...</div>}>
          <Questionnaire
            ref={questionnaireRef}
            teams={teamsForQuestionnaire}
            players={playersForQuestionnaire}
            initialPredictions={initialPredictions}
            onPredictionChange={() => { /* Handle if needed */ }}
            onToggleVisibility={handleQuestionnaireToggle}
          />
        </Suspense>

        {/* Display General Validation Summary Error */}
        {validationErrors.summary && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            {validationErrors.summary}
          </div>
        )}

        {/* Display Fixture Data Error */}
        {fixtureError && (
          <div className="p-4 rounded-md bg-red-100 text-red-700 mt-4">
            Error loading fixtures: {fixtureError}
          </div>
        )}
        {/* Betting Coupon Section */}
        <Suspense fallback={<div>Loading Betting Coupon...</div>}>
          <BettingCoupon
            ref={bettingCouponRef}
            matches={matchesForCoupon} // Use Match type from coupon
            initialSelections={initialSampleSelections}
            onSelectionChange={handleSelectionChange}
          />
        </Suspense>

        {/* Combined Submit Button and Status Display */}
        {submitStatus && (
          <div className={`p-4 my-2 rounded-md ${submitStatus.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {submitStatus.message}
          </div>
        )}
        <Button
          onClick={handleCombinedSubmit} // Use the new combined handler
          disabled={isSubmitting || isLoading || !user} // Use renamed loading state
          className="w-full md:w-auto self-center mt-4"
        >
          {isSubmitting || isLoading ? 'Submitting...' : 'Submit Coupon'} {/* Updated button text */}
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