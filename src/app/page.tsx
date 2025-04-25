import React from 'react';
// Removed 'use client'
// Removed unused client-side imports (useState, useRef, Suspense, client hooks, components, types)

// Keep server-side imports
import { getCurrentBettingRoundFixtures, CurrentRoundFixturesResult } from '@/lib/supabase/queries';

// Import the new Client Component
import CouponClient from '@/components/client/CouponClient';

// --- Server Component Definition ---

export default async function Page() {
  let currentRoundData: CurrentRoundFixturesResult | null = null;
  let error: string | null = null;

  try {
    // Fetch data on the server
    currentRoundData = await getCurrentBettingRoundFixtures();
  } catch (fetchError) {
    console.error("Error fetching current round fixtures:", fetchError);
    error = fetchError instanceof Error ? fetchError.message : 'Failed to load round data.';
    // Set currentRoundData to null explicitly on error to avoid passing undefined
    currentRoundData = null; 
  }
  
  // If there was an error during fetch, we can optionally render an error state here
  // or pass null to CouponClient which will handle it.
  if (error) {
      // You could render a specific server-side error message here if desired
      console.error("Server-side fetch failed:", error);
      // Fallback to rendering CouponClient which should handle null data
  }

  // Render the Client Component, passing fetched data (or null on error) as props
  // CouponClient now needs to handle the case where initialRoundData might be null
  return <CouponClient initialRoundData={currentRoundData} />;
}

// --- Removed Client Component Logic ---
// The CouponClient component and its associated logic (state, refs, handlers, JSX) 
// have been moved to src/components/client/CouponClient.tsx