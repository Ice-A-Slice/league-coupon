import React from 'react';
// Removed 'use client'
// Removed unused client-side imports (useState, useRef, Suspense, client hooks, components, types)

// Keep server-side imports
import { getCurrentBettingRoundFixtures } from '@/lib/supabase/queries';
import { createClient } from '@/utils/supabase/server';

// Import the new Client Component
import CouponClient from '@/components/client/CouponClient';

// --- Server Component Definition ---

export default async function Index() {
  const supabase = await createClient();

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the current season to determine the active league and season year
  const { data: currentSeasonData, error: seasonError } = await supabase
    .from('seasons')
    .select(`
      api_season_year,
      competitions (
        api_league_id
      )
    `)
    .eq('is_current', true)
    .single();

  // Provide default/fallback values if the query fails or returns no data
  const currentLeagueId = currentSeasonData?.competitions?.api_league_id ?? 39; // Default to Premier League
  const currentSeasonYear = currentSeasonData?.api_season_year ?? 2024; // Default to 2024 season

  if (seasonError) {
    console.error("Error fetching current season:", seasonError.message);
    // Decide how to handle this error - maybe fall back to defaults or show an error page
  }

  // Fetch data for the current betting round - this function returns the data directly or null
  // Pass the user ID if authenticated
  const currentRoundData = await getCurrentBettingRoundFixtures(user?.id);

  // Render the client component, passing down all necessary data
  return (
    <CouponClient 
      initialRoundData={currentRoundData} 
      currentLeagueId={currentLeagueId}
      currentSeasonYear={currentSeasonYear}
    />
  );
}

// --- Removed Client Component Logic ---
// The CouponClient component and its associated logic (state, refs, handlers, JSX) 
// have been moved to src/components/client/CouponClient.tsx